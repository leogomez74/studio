<?php

/**
 * reset_inversiones.php
 *
 * Revierte todos los pagos de inversiones:
 *  - Resetea cupones Pagado → Pendiente (limpia fecha_pago)
 *  - Elimina todos los registros de investment_payments
 *
 * USO: php reset_inversiones.php
 * USO (sin confirmación): php reset_inversiones.php --yes
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$autoConfirm = in_array('--yes', $argv ?? []);

if (!$autoConfirm) {
    $cuponesCount  = DB::table('investment_coupons')->where('estado', 'Pagado')->count();
    $paymentsCount = DB::table('investment_payments')->count();

    echo "\n";
    echo "╔══════════════════════════════════════════════════════╗\n";
    echo "║        RESET PAGOS DE INVERSIONES - CREDIPEP         ║\n";
    echo "╚══════════════════════════════════════════════════════╝\n\n";
    echo "Este script realizará las siguientes acciones:\n";
    echo "  1. Resetear cupones Pagado → Pendiente (limpiar fecha_pago)\n";
    echo "  2. Eliminar todos los registros de investment_payments\n\n";
    echo "Estado actual:\n";
    echo "  - investment_coupons (Pagado): {$cuponesCount}\n";
    echo "  - investment_payments:         {$paymentsCount}\n\n";
    echo "¿Deseas continuar? (escribe 'si' para confirmar): ";
    $input = trim(fgets(STDIN));

    if (strtolower($input) !== 'si') {
        echo "\nOperación cancelada.\n\n";
        exit(0);
    }
}

echo "\n[RESET] Iniciando...\n\n";

try {
    $updated = DB::table('investment_coupons')
        ->where('estado', 'Pagado')
        ->update(['estado' => 'Pendiente', 'fecha_pago' => null]);
    echo "[OK] Cupones revertidos a Pendiente: {$updated}\n";

    $deleted = DB::table('investment_payments')->delete();
    echo "[OK] investment_payments eliminados: {$deleted}\n";

} catch (\Exception $e) {
    echo "\n[ERROR] " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n";
echo "╔══════════════════════════════════════════════════════╗\n";
echo "║                  RESET COMPLETADO                    ║\n";
echo "╚══════════════════════════════════════════════════════╝\n\n";
echo "Estado final:\n";
echo "  - Cupones Pagado:      " . DB::table('investment_coupons')->where('estado', 'Pagado')->count() . "\n";
echo "  - Cupones Pendiente:   " . DB::table('investment_coupons')->where('estado', 'Pendiente')->count() . "\n";
echo "  - investment_payments: " . DB::table('investment_payments')->count() . "\n\n";
