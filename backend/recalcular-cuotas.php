<?php

/**
 * recalcular-cuotas.php
 *
 * Recalcula la cuota de todos los créditos usando el monto completo (sin restar cargos).
 * Uso: php recalcular-cuotas.php
 */

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== Recalcular cuotas de créditos ===\n\n";

$credits = DB::table('credits')
    ->whereNotNull('monto_credito')
    ->whereNotNull('plazo')
    ->whereNotNull('tasa_anual')
    ->where('monto_credito', '>', 0)
    ->where('plazo', '>', 0)
    ->get();

$updated = 0;
$skipped = 0;

foreach ($credits as $credit) {
    $monto = (float) $credit->monto_credito;
    $plazo = (int) $credit->plazo;
    $tasaAnual = (float) $credit->tasa_anual;
    $tasaMensual = ($tasaAnual / 100) / 12;

    if ($tasaMensual > 0) {
        $potencia = pow(1 + $tasaMensual, $plazo);
        $cuotaNueva = round($monto * ($tasaMensual * $potencia) / ($potencia - 1), 2);
    } else {
        $cuotaNueva = round($monto / $plazo, 2);
    }

    // Sumar póliza si aplica
    if ($credit->poliza) {
        $loanConfig = DB::table('loan_configurations')->where('tipo', 'regular')->first();
        if ($loanConfig && $loanConfig->monto_poliza) {
            $cuotaNueva += (float) $loanConfig->monto_poliza;
        }
    }

    $cuotaActual = (float) $credit->cuota;

    if (abs($cuotaActual - $cuotaNueva) > 0.01) {
        echo "[FIX] {$credit->reference}: ₡" . number_format($cuotaActual, 2) . " → ₡" . number_format($cuotaNueva, 2) . "\n";
        DB::table('credits')->where('id', $credit->id)->update(['cuota' => $cuotaNueva]);
        $updated++;
    } else {
        $skipped++;
    }
}

echo "\n=== Resultado ===\n";
echo "Corregidos: {$updated}\n";
echo "Sin cambios: {$skipped}\n";
echo "Total: " . ($updated + $skipped) . "\n";
