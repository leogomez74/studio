<?php

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Credit;
use App\Models\Deductora;
use App\Models\PlanDePago;
use App\Models\CreditPayment;
use Illuminate\Support\Facades\DB;

echo "=== RESET DE SIMULACION ===\n\n";

$deductora = Deductora::where('nombre', 'LIKE', '%COOPE%')->first();
if (!$deductora) { echo "No se encontro COOPENACIONAL\n"; exit(1); }

$credits = Credit::where('deductora_id', $deductora->id)
    ->whereIn('status', ['Formalizado', 'En Mora'])
    ->with('lead')
    ->get();

echo "Creditos encontrados: {$credits->count()}\n\n";

foreach ($credits as $credit) {
    $nombre = $credit->lead->name ?? 'N/A';
    echo "Procesando: {$nombre}\n";

    // 1. Borrar pagos
    CreditPayment::where('credit_id', $credit->id)->delete();

    // 2. Borrar cuotas desplazadas (numero_cuota > plazo)
    $plazo = (int) $credit->plazo;
    PlanDePago::where('credit_id', $credit->id)
        ->where('numero_cuota', '>', $plazo)
        ->delete();

    // 3. Obtener datos para regenerar plan frances
    $montoCredito = (float) $credit->monto_credito;
    $tasaAnual = (float) ($credit->tasa_anual ?? 54.00);
    $tasaMensual = $tasaAnual / 100 / 12;

    // Cuota fija (formula francesa)
    $cuotaFija = round($montoCredito * $tasaMensual / (1 - pow(1 + $tasaMensual, -$plazo)), 2);

    // 4. Regenerar cuotas 1..plazo
    $saldo = $montoCredito;

    for ($i = 1; $i <= $plazo; $i++) {
        $interes = round($saldo * $tasaMensual, 2);
        $amortizacion = round($cuotaFija - $interes, 2);

        // Ultima cuota: ajustar para que saldo = 0
        if ($i == $plazo) {
            $amortizacion = round($saldo, 2);
            $cuotaReal = round($amortizacion + $interes, 2);
        } else {
            $cuotaReal = $cuotaFija;
        }

        $saldoNuevo = round($saldo - $amortizacion, 2);

        // Obtener la poliza de la cuota existente
        $cuotaExistente = PlanDePago::where('credit_id', $credit->id)
            ->where('numero_cuota', $i)
            ->first();

        $poliza = $cuotaExistente ? (float) $cuotaExistente->poliza : 0;

        if ($cuotaExistente) {
            $cuotaExistente->update([
                'cuota' => $cuotaReal,
                'interes_corriente' => $interes,
                'int_corriente_vencido' => 0,
                'interes_moratorio' => 0,
                'amortizacion' => $amortizacion,
                'saldo_anterior' => $saldo,
                'saldo_nuevo' => $saldoNuevo,
                'estado' => 'Pendiente',
                'dias_mora' => 0,
                'fecha_pago' => null,
                'concepto' => null,
                'tasa_actual' => $tasaAnual,
                'movimiento_total' => 0,
                'movimiento_poliza' => 0,
                'movimiento_principal' => 0,
                'movimiento_interes_corriente' => 0,
                'movimiento_interes_moratorio' => 0,
                'movimiento_int_corriente_vencido' => 0,
                'movimiento_amortizacion' => 0,
            ]);
        }

        $saldo = $saldoNuevo;
    }

    // 5. Reset cuota 0
    PlanDePago::where('credit_id', $credit->id)
        ->where('numero_cuota', 0)
        ->update([
            'estado' => 'Pagado',
            'tasa_actual' => $tasaAnual,
            'movimiento_total' => 0,
            'movimiento_poliza' => 0,
            'movimiento_principal' => 0,
            'movimiento_interes_corriente' => 0,
            'movimiento_interes_moratorio' => 0,
        ]);

    // 6. Reset credito
    Credit::where('id', $credit->id)->update([
        'status' => 'Formalizado',
        'saldo' => $montoCredito,
    ]);

    echo "  Cuota fija: " . number_format($cuotaFija, 2) . "\n";
    echo "  Saldo reset a: " . number_format($montoCredito, 2) . "\n";
    echo "  Plan regenerado: {$plazo} cuotas\n\n";
}

echo "=== RESET COMPLETADO ===\n";
