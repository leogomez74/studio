<?php

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "====================================================================\n";
echo "Estado Actual de Cuotas - Credit ID 8\n";
echo "====================================================================\n\n";

$cuotas = DB::table('plan_de_pagos')
    ->where('credit_id', 8)
    ->whereIn('numero_cuota', [1, 2, 3])
    ->orderBy('numero_cuota')
    ->get();

foreach ($cuotas as $c) {
    echo "Cuota #{$c->numero_cuota} - Estado: {$c->estado}\n";
    echo "  Int.Corr: " . number_format($c->interes_corriente, 2);
    echo " | Int.Venc: " . number_format($c->int_corriente_vencido, 2);
    echo " | Int.Mora: " . number_format($c->interes_moratorio, 2) . "\n";
    echo "  Amortización: " . number_format($c->amortizacion, 2) . "\n";
    echo "  Movimientos:\n";
    echo "    - Mov.Total: " . number_format($c->movimiento_total, 2) . "\n";
    echo "    - Mov.Int.Corr: " . number_format($c->movimiento_interes_corriente, 2) . "\n";
    echo "    - Mov.Int.Mora: " . number_format($c->movimiento_interes_moratorio, 2) . "\n";
    echo "    - Mov.Amort: " . number_format($c->movimiento_amortizacion, 2) . "\n";
    echo "\n";
}

$credit = DB::table('credits')->where('id', 8)->first();
echo "Credit:\n";
echo "  Saldo: ₡" . number_format($credit->saldo, 2) . "\n";
echo "  Status: {$credit->status}\n";
