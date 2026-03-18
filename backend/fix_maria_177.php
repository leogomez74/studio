<?php
/**
 * Corrige el plan de pagos del crédito 177 (MARIA DEL ROSARIO LEON)
 * que se regeneró sin póliza (¢4,950/cuota).
 */

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();




use App\Models\Credit;
use App\Models\PlanDePago;
use App\Models\LoanConfiguration;
use Illuminate\Support\Facades\DB;

$credit = Credit::findOrFail(177);
$polizaConfig = LoanConfiguration::where('tipo', 'regular')->first();
$polizaPorCuota = (float) ($polizaConfig->monto_poliza ?? 0);

echo "Crédito #{$credit->id} - {$credit->lead->name} {$credit->lead->apellido1}\n";
echo "Monto: {$credit->monto_credito} | Plazo: {$credit->plazo} | Tasa: {$credit->tasa_anual}% | Póliza: {$polizaPorCuota}\n";

DB::transaction(function () use ($credit, $polizaPorCuota) {
    $monto = (float) $credit->monto_credito;
    $plazo = (int) $credit->plazo;
    $tasaAnual = (float) $credit->tasa_anual;
    $tasaMensual = $tasaAnual / 12 / 100;

    $cuota0 = PlanDePago::where('credit_id', $credit->id)->where('numero_cuota', 0)->first();
    if (!$cuota0) { echo "No tiene cuota 0!\n"; return; }

    // Eliminar cuotas actuales
    $eliminadas = PlanDePago::where('credit_id', $credit->id)->where('numero_cuota', '>', 0)->delete();
    echo "Eliminadas {$eliminadas} cuotas\n";

    // PMT + póliza
    $factor = pow(1 + $tasaMensual, $plazo);
    $cuotaFija = round($monto * ($tasaMensual * $factor) / ($factor - 1), 2);
    $cuotaConPoliza = $cuotaFija + $polizaPorCuota;

    echo "PMT: {$cuotaFija} + Póliza: {$polizaPorCuota} = Cuota: {$cuotaConPoliza}\n";

    // Regenerar
    $saldoRestante = $monto;
    for ($i = 1; $i <= $plazo; $i++) {
        $saldo_anterior = round($saldoRestante, 2);
        $interes_corriente = round($saldo_anterior * $tasaMensual, 2);
        $amortizacion = $cuotaFija - $interes_corriente;

        if ($i === $plazo) {
            $amortizacion = $saldo_anterior;
            $cuota = round($amortizacion + $interes_corriente + $polizaPorCuota, 2);
        } else {
            $cuota = $cuotaConPoliza;
            $amortizacion = round($amortizacion, 2);
        }

        $saldo_nuevo = max(0, round($saldo_anterior - $amortizacion, 2));

        PlanDePago::create([
            'credit_id' => $credit->id,
            'linea' => $cuota0->linea,
            'numero_cuota' => $i,
            'proceso' => $cuota0->proceso,
            'fecha_inicio' => $cuota0->fecha_inicio,
            'fecha_corte' => $cuota0->fecha_inicio->copy()->addMonths($i)->endOfMonth(),
            'fecha_pago' => null,
            'tasa_actual' => $tasaAnual,
            'plazo_actual' => $plazo,
            'cuota' => $cuota,
            'cargos' => 0,
            'poliza' => $polizaPorCuota,
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
        ]);

        $saldoRestante = $saldo_nuevo;
    }

    $credit->update([
        'cuota' => $cuotaConPoliza,
        'saldo' => $monto,
    ]);

    echo "✓ Regeneradas {$plazo} cuotas. Cuota: {$cuotaConPoliza}\n";
});
