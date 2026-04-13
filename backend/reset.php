<?php

/**
 * reset.php
 *
 * Script para resetear la base de datos:
 * - Elimina todos los pagos de créditos
 * - Elimina todos los planes de pago
 * - Elimina todos los créditos
 * - Elimina todas las oportunidades
 * - Convierte clientes (type=2) de vuelta a leads (type=1)
 *
 * USO: php reset.php
 * USO (confirmación automática): php reset.php --yes
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

// ─── Confirmación ────────────────────────────────────────────────────────────

$autoConfirm = in_array('--yes', $argv ?? []);

if (!$autoConfirm) {
    echo "\n";
    echo "╔══════════════════════════════════════════════════════╗\n";
    echo "║           RESET DE BASE DE DATOS - CREDIPEP          ║\n";
    echo "╚══════════════════════════════════════════════════════╝\n\n";
    echo "Este script realizará las siguientes acciones:\n";
    echo "  1. Eliminar todos los pagos de créditos\n";
    echo "  2. Eliminar todos los planes de pago\n";
    echo "  3. Eliminar todos los créditos\n";
    echo "  4. Eliminar todas las oportunidades\n";
    echo "  5. Eliminar todas las propuestas de crédito\n";
    echo "  6. Eliminar todos los analizados\n";
    echo "  7. Eliminar todos los saldos pendientes (sobrantes)\n";
    echo "  8. Eliminar historial de planillas\n";
    echo "  9. Eliminar todas las personas (leads y clientes)\n";
    echo " 10. Eliminar registros contables (accounting_entry_logs)\n";
    echo " 11. Eliminar todas las tareas (tasks)\n\n";

    // Mostrar conteos actuales
    $counts = [
        'credit_payments' => DB::table('credit_payments')->count(),
        'plan_de_pagos'   => DB::table('plan_de_pagos')->count(),
        'credits'         => DB::table('credits')->count(),
        'opportunities'   => DB::table('opportunities')->count(),
        'propuestas'      => DB::table('propuestas')->count(),
        'analisis'        => DB::table('analisis')->count(),
        'saldos_pendientes' => DB::table('saldos_pendientes')->count(),
        'planilla_uploads' => DB::table('planilla_uploads')->count(),
        'persons'          => DB::table('persons')->count(),
        'accounting_entry_logs'  => DB::table('accounting_entry_logs')->count(),
        'tasks'                  => DB::table('tasks')->count(),
    ];

    echo "Estado actual:\n";
    foreach ($counts as $tabla => $count) {
        echo "  - {$tabla}: {$count} registros\n";
    }

    echo "\n¿Deseas continuar? (escribe 'si' para confirmar): ";
    $input = trim(fgets(STDIN));

    if (strtolower($input) !== 'si') {
        echo "\nOperación cancelada.\n\n";
        exit(0);
    }
}

// ─── Ejecución ────────────────────────────────────────────────────────────────

echo "\n[RESET] Iniciando...\n\n";

DB::statement('SET FOREIGN_KEY_CHECKS=0;');

try {
    $tablas = [
        'credit_payments',
        'plan_de_pagos',
        'credits',
        'opportunities',
        'propuestas',
        'analisis',
        'saldos_pendientes',
        'planilla_uploads',
        'accounting_entry_logs',
        'tasks',
    ];

    foreach ($tablas as $tabla) {
        DB::statement("TRUNCATE TABLE `{$tabla}`");
        echo "[OK] {$tabla} truncada\n";
    }

} catch (\Exception $e) {
    echo "\n[ERROR] " . $e->getMessage() . "\n";
    DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    exit(1);
}

DB::statement('SET FOREIGN_KEY_CHECKS=1;');

// ─── Resumen final ────────────────────────────────────────────────────────────

echo "\n";
echo "╔══════════════════════════════════════════════════════╗\n";
echo "║                  RESET COMPLETADO                    ║\n";
echo "╚══════════════════════════════════════════════════════╝\n\n";

echo "Estado final:\n";
echo "  - credit_payments:  " . DB::table('credit_payments')->count() . "\n";
echo "  - plan_de_pagos:    " . DB::table('plan_de_pagos')->count() . "\n";
echo "  - credits:          " . DB::table('credits')->count() . "\n";
echo "  - opportunities:    " . DB::table('opportunities')->count() . "\n";
echo "  - propuestas:       " . DB::table('propuestas')->count() . "\n";
echo "  - analisis:         " . DB::table('analisis')->count() . "\n";
echo "  - saldos_pendientes:" . DB::table('saldos_pendientes')->count() . "\n";
echo "  - planilla_uploads: " . DB::table('planilla_uploads')->count() . "\n";
echo "  - persons:          " . DB::table('persons')->count() . "\n";
echo "  - accounting_entry_logs:  " . DB::table('accounting_entry_logs')->count() . "\n";
echo "  - tasks:                 " . DB::table('tasks')->count() . "\n";
echo "\n";
