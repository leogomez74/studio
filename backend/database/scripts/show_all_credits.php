<?php

require __DIR__ . '/../../vendor/autoload.php';

$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "====================================================================\n";
echo "Todos los Créditos en el Sistema\n";
echo "====================================================================\n\n";

$credits = DB::select("
    SELECT
        c.id as credit_id,
        c.numero_operacion,
        p.name as lead_name,
        p.cedula,
        c.status,
        c.formalized_at,
        c.monto_credito,
        c.plazo,
        c.saldo,
        t.tasa as tasa_anual,
        t.tasa_maxima,
        (t.tasa_maxima - t.tasa) as tasa_mora,
        (SELECT COUNT(*) FROM plan_de_pagos WHERE credit_id = c.id) as cuotas_plan,
        (SELECT COUNT(*) FROM credit_payments WHERE credit_id = c.id) as pagos_registrados
    FROM credits c
    JOIN persons p ON c.lead_id = p.id
    JOIN tasas t ON c.tasa_id = t.id
    ORDER BY c.id
    LIMIT 10
");

echo "Total de créditos mostrados: " . count($credits) . " (primeros 10)\n\n";

foreach ($credits as $r) {
    echo "┌─────────────────────────────────────────────────────────────────────\n";
    echo "│ Credit ID: {$r->credit_id} | {$r->numero_operacion}\n";
    echo "│ Lead: {$r->lead_name} ({$r->cedula})\n";
    echo "├─────────────────────────────────────────────────────────────────────\n";
    echo "│ Status: {$r->status} | Formalizado: {$r->formalized_at}\n";
    echo "│ Monto: ₡" . number_format($r->monto_credito, 2) . " | Plazo: {$r->plazo} meses | Saldo: ₡" . number_format($r->saldo, 2) . "\n";
    echo "├─────────────────────────────────────────────────────────────────────\n";
    echo "│ Tasa Anual: {$r->tasa_anual}% | Tasa Máx: {$r->tasa_maxima}% | Tasa Mora: {$r->tasa_mora}%\n";
    echo "│ Cuotas en plan: {$r->cuotas_plan} | Pagos: {$r->pagos_registrados}\n";
    echo "└─────────────────────────────────────────────────────────────────────\n\n";
}

// Mostrar resumen de cédulas para el usuario
echo "\n====================================================================\n";
echo "Para resetear créditos específicos, editar el script reset_test_credits.php\n";
echo "y cambiar el array \$cedulas con las cédulas correctas.\n";
echo "====================================================================\n";
