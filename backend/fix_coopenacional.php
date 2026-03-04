<?php
/**
 * Script para corregir créditos de COOPENACIONAL que quedaron en mora
 * por ausencia en planillas (todas anuladas).
 *
 * Qué hace:
 * 1. Elimina TODAS las cuotas (1-N) de los créditos afectados
 * 2. Regenera el plan de pagos desde cero (sistema francés)
 * 3. Restaura el status del crédito a "Formalizado"
 * 4. Mantiene la cuota 0 (desembolso) intacta
 *
 * Uso: php fix_coopenacional.php
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Credit;
use App\Models\PlanDePago;
use Illuminate\Support\Facades\DB;

$deductoraId = 1; // COOPENACIONAL

// Créditos en mora de COOPENACIONAL sin pagos reales
$credits = Credit::where('deductora_id', $deductoraId)
    ->where('status', 'En Mora')
    ->whereNotNull('formalized_at')
    ->get();

if ($credits->isEmpty()) {
    echo "No hay créditos en mora para COOPENACIONAL.\n";
    exit(0);
}

echo "=== CORRECCIÓN DE CRÉDITOS COOPENACIONAL ===\n";
echo "Créditos encontrados: " . $credits->count() . "\n\n";

// Verificar que no tengan pagos reales (credit_payments no anulados)
foreach ($credits as $credit) {
    $pagosReales = \App\Models\CreditPayment::where('credit_id', $credit->id)
        ->where(function ($q) {
            $q->whereNull('estado_reverso')
              ->orWhere('estado_reverso', '!=', 'Anulado');
        })
        ->count();

    if ($pagosReales > 0) {
        echo "  ⚠ Crédito #{$credit->id} ({$credit->lead->name} {$credit->lead->apellido1}) tiene {$pagosReales} pagos activos. SE OMITE.\n";
        continue;
    }

    $lead = $credit->lead;
    echo "Procesando crédito #{$credit->id} - {$lead->name} {$lead->apellido1} (Cédula: {$lead->cedula})\n";
    echo "  Monto: {$credit->monto_credito} | Plazo: {$credit->plazo} | Tasa: {$credit->tasa_anual}%\n";

    // Contar cuotas actuales
    $totalCuotas = PlanDePago::where('credit_id', $credit->id)->count();
    $cuotasMora = PlanDePago::where('credit_id', $credit->id)->where('estado', 'Mora')->count();
    $cuotasDesplazadas = PlanDePago::where('credit_id', $credit->id)
        ->where('numero_cuota', '>', (int) $credit->plazo)->count();
    echo "  Estado actual: {$totalCuotas} cuotas total, {$cuotasMora} en mora, {$cuotasDesplazadas} desplazadas\n";

    DB::transaction(function () use ($credit) {
        $plazo = (int) $credit->plazo;
        $monto = (float) $credit->monto_credito;
        $tasaAnual = (float) $credit->tasa_anual;
        $tasaMensual = $tasaAnual / 12 / 100;

        // 1. Obtener cuota 0 para datos de referencia
        $cuota0 = PlanDePago::where('credit_id', $credit->id)
            ->where('numero_cuota', 0)
            ->first();

        if (!$cuota0) {
            echo "  ⚠ No tiene cuota 0. SE OMITE.\n";
            return;
        }

        // 2. Eliminar TODAS las cuotas excepto la 0
        $eliminadas = PlanDePago::where('credit_id', $credit->id)
            ->where('numero_cuota', '>', 0)
            ->delete();
        echo "  Eliminadas {$eliminadas} cuotas\n";

        // 3. Calcular cuota fija (sistema francés)
        if ($tasaMensual > 0) {
            $factor = pow(1 + $tasaMensual, $plazo);
            $cuotaFija = round($monto * ($tasaMensual * $factor) / ($factor - 1), 2);
        } else {
            $cuotaFija = round($monto / $plazo, 2);
        }

        // 4. Regenerar plan de pagos
        $saldoRestante = $monto;
        for ($i = 1; $i <= $plazo; $i++) {
            $saldo_anterior = round($saldoRestante, 2);
            $interes_corriente = round($saldo_anterior * $tasaMensual, 2);
            $amortizacion = $cuotaFija - $interes_corriente;

            if ($i === $plazo) {
                $amortizacion = $saldo_anterior;
                $cuota = round($amortizacion + $interes_corriente, 2);
            } else {
                $cuota = $cuotaFija;
                $amortizacion = round($amortizacion, 2);
            }

            $saldo_nuevo = max(0, round($saldo_anterior - $amortizacion, 2));
            $fechaCorte = $cuota0->fecha_inicio
                ? $cuota0->fecha_inicio->copy()->addMonths($i)->endOfMonth()
                : null;

            PlanDePago::create([
                'credit_id' => $credit->id,
                'linea' => $cuota0->linea,
                'numero_cuota' => $i,
                'proceso' => $cuota0->proceso,
                'fecha_inicio' => $cuota0->fecha_inicio,
                'fecha_corte' => $fechaCorte,
                'fecha_pago' => null,
                'tasa_actual' => $tasaAnual,
                'plazo_actual' => $plazo,
                'cuota' => $cuota,
                'cargos' => 0,
                'poliza' => 0,
                'interes_corriente' => $interes_corriente,
                'int_corriente_vencido' => 0,
                'interes_moratorio' => 0,
                'amortizacion' => $amortizacion,
                'saldo_anterior' => $saldo_anterior,
                'saldo_nuevo' => $saldo_nuevo,
                'dias' => 0,
                'estado' => 'Pendiente',
                'dias_mora' => 0,
                'fecha_movimiento' => null,
                'movimiento_total' => 0,
                'movimiento_cargos' => 0,
                'movimiento_poliza' => 0,
                'movimiento_interes_corriente' => 0,
                'movimiento_interes_moratorio' => 0,
                'movimiento_principal' => 0,
                'movimiento_amortizacion' => 0,
                'movimiento_caja_usuario' => null,
                'tipo_documento' => null,
                'numero_documento' => null,
                'concepto' => null,
            ]);

            $saldoRestante = $saldo_nuevo;
        }

        // 5. Restaurar saldo del crédito al monto original
        $credit->update([
            'status' => 'Formalizado',
            'saldo' => $monto,
        ]);

        echo "  ✓ Regeneradas {$plazo} cuotas. Cuota fija: {$cuotaFija}. Status → Formalizado\n";
    });

    echo "\n";
}

echo "=== CORRECCIÓN COMPLETADA ===\n";
