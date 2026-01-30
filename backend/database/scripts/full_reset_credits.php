<?php

/**
 * Reset COMPLETO de Créditos de Prueba
 * Borra TODO: pagos, plan de pagos, resetea créditos a Formalizado
 */

require __DIR__ . '/../../vendor/autoload.php';

$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "====================================================================\n";
echo "RESET COMPLETO - Borrar TODO y empezar de cero\n";
echo "====================================================================\n\n";

$cedulas = ['109920246', '112800778', '112910426', '205790114', '502670528'];

try {
    DB::beginTransaction();

    echo "1. Buscando créditos...\n";
    $creditIds = DB::table('credits')
        ->join('persons', 'credits.lead_id', '=', 'persons.id')
        ->whereIn('persons.cedula', $cedulas)
        ->where('persons.person_type_id', 1)
        ->pluck('credits.id');

    if ($creditIds->isEmpty()) {
        echo "❌ No se encontraron créditos\n";
        exit(1);
    }

    echo "   ✓ Encontrados: " . $creditIds->count() . " créditos\n\n";

    // 2. BORRAR TODOS LOS PAGOS
    echo "2. Borrando TODOS los credit_payments...\n";
    $deletedPayments = DB::table('credit_payments')
        ->whereIn('credit_id', $creditIds)
        ->delete();
    echo "   ✓ Pagos borrados: {$deletedPayments}\n\n";

    // 3. BORRAR TODO EL PLAN DE PAGOS
    echo "3. Borrando TODO el plan_de_pagos...\n";
    $deletedPlans = DB::table('plan_de_pagos')
        ->whereIn('credit_id', $creditIds)
        ->delete();
    echo "   ✓ Planes borrados: {$deletedPlans}\n\n";

    // 4. RESETEAR CRÉDITOS
    echo "4. Reseteando créditos a Formalizado...\n";
    DB::table('credits')
        ->whereIn('id', $creditIds)
        ->update([
            'status' => 'Formalizado',
            'formalized_at' => '2025-11-15',
            'saldo' => DB::raw('monto_credito'),
            'fecha_ultimo_pago' => null,
            'cuotas_atrasadas' => 0,
            'updated_at' => now()
        ]);
    echo "   ✓ Créditos reseteados: " . $creditIds->count() . "\n\n";

    DB::commit();

    // Verificación
    echo "====================================================================\n";
    echo "VERIFICACIÓN\n";
    echo "====================================================================\n\n";

    $results = DB::select("
        SELECT
            c.id,
            p.cedula,
            p.name,
            c.status,
            c.monto_credito,
            c.saldo,
            (SELECT COUNT(*) FROM plan_de_pagos WHERE credit_id = c.id) as plan_count,
            (SELECT COUNT(*) FROM credit_payments WHERE credit_id = c.id) as payment_count
        FROM credits c
        JOIN persons p ON c.lead_id = p.id
        WHERE p.cedula IN ('" . implode("','", $cedulas) . "')
          AND p.person_type_id = 1
    ");

    foreach ($results as $r) {
        echo "ID {$r->id} | {$r->cedula} | {$r->name}\n";
        echo "  Status: {$r->status} | Saldo: ₡" . number_format($r->saldo, 2) . "\n";
        echo "  Plan: {$r->plan_count} cuotas | Pagos: {$r->payment_count}\n\n";
    }

    echo "====================================================================\n";
    echo "✓ RESET COMPLETO EXITOSO\n";
    echo "====================================================================\n\n";
    echo "TODO LIMPIO. Ahora ejecuta:\n";
    echo "  php database/scripts/generate_payment_plans.php\n\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}
