<?php

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "====================================================================\n";
echo "Cuotas Sistema Francés (Tasa 40% anual)\n";
echo "====================================================================\n\n";

echo sprintf(
    "%-12s | %-15s | %-15s | %-15s\n",
    "Cédula", "Cuota", "Int.Corr #1", "Amort #1"
);
echo str_repeat("-", 70) . "\n";

$credits = [7, 8, 9, 10, 11];

foreach ($credits as $creditId) {
    $credit = DB::table('credits')->where('id', $creditId)->first();
    $person = DB::table('persons')->where('id', $credit->lead_id)->first();
    $cuota1 = DB::table('plan_de_pagos')
        ->where('credit_id', $creditId)
        ->where('numero_cuota', 1)
        ->first();

    if ($cuota1) {
        echo sprintf(
            "%-12s | ₡%-14s | ₡%-14s | ₡%-14s\n",
            $person->cedula,
            number_format($cuota1->cuota, 2),
            number_format($cuota1->interes_corriente, 2),
            number_format($cuota1->amortizacion, 2)
        );
    }
}
