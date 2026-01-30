<?php

require __DIR__ . '/../../vendor/autoload.php';

$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "====================================================================\n";
echo "Tabla de Créditos - Cuotas y Cédulas\n";
echo "====================================================================\n\n";

$credits = DB::select("
    SELECT
        c.id,
        c.numero_operacion,
        p.name as lead_name,
        p.cedula,
        c.monto_credito,
        c.plazo,
        ROUND(c.monto_credito / c.plazo, 2) as cuota_estimada,
        c.status,
        c.formalized_at,
        (SELECT COUNT(*) FROM plan_de_pagos WHERE credit_id = c.id) as cuotas_plan
    FROM credits c
    JOIN persons p ON c.lead_id = p.id
    WHERE p.person_type_id = 1
    ORDER BY c.id
");

echo sprintf(
    "%-4s | %-12s | %-20s | %-15s | %-10s | %-12s | %-12s\n",
    "ID", "Cédula", "Lead", "Monto", "Plazo", "Cuota Est.", "Status"
);
echo str_repeat("-", 110) . "\n";

foreach ($credits as $c) {
    echo sprintf(
        "%-4s | %-12s | %-20s | ₡%-13s | %-10s | ₡%-11s | %-12s\n",
        $c->id,
        $c->cedula,
        substr($c->lead_name, 0, 20),
        number_format($c->monto_credito, 2),
        $c->plazo . " meses",
        number_format($c->cuota_estimada, 2),
        $c->status
    );
}

echo "\n";
