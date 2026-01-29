<?php

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$credits = DB::select("
    SELECT
        p.cedula,
        pp.cuota
    FROM credits c
    JOIN persons p ON c.lead_id = p.id
    LEFT JOIN plan_de_pagos pp ON c.id = pp.credit_id AND pp.numero_cuota = 1
    WHERE p.person_type_id = 1
    ORDER BY c.id
");

echo "Cédula       | Cuota\n";
echo "-------------|-------------\n";
foreach ($credits as $c) {
    echo str_pad($c->cedula, 13) . "| ₡" . number_format($c->cuota ?? 0, 2) . "\n";
}
