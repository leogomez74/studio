<?php

/**
 * Script de Reset con Ajuste de Monto Pagado
 * Borra pagos y plan, pero AJUSTA el monto del crédito restando lo pagado
 */

require __DIR__ . '/../../vendor/autoload.php';

$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "====================================================================\n";
echo "Reset de Créditos con Ajuste de Monto Pagado\n";
echo "====================================================================\n\n";

// Puedes cambiar estas cédulas por las que necesites
$cedulas = ['109920246', '112800778', '112910426', '205790114', '502670528'];

echo "Cédulas a procesar: " . implode(', ', $cedulas) . "\n\n";

try {
    DB::beginTransaction();

    // Obtener créditos
    $credits = DB::select("
        SELECT
            c.id,
            c.numero_operacion,
            p.name as lead_name,
            p.cedula,
            c.monto_credito,
            c.saldo,
            c.status,
            (SELECT SUM(movimiento_amortizacion)
             FROM credit_payments
             WHERE credit_id = c.id) as total_pagado
        FROM credits c
        JOIN persons p ON c.lead_id = p.id
        WHERE p.cedula IN ('" . implode("','", $cedulas) . "')
          AND p.person_type_id = 1
    ");

    if (empty($credits)) {
        echo "❌ No se encontraron créditos con esas cédulas.\n";
        DB::rollBack();
        exit(1);
    }

    echo "Créditos encontrados: " . count($credits) . "\n\n";

    foreach ($credits as $credit) {
        $totalPagado = (float) ($credit->total_pagado ?? 0);
        $montoOriginal = (float) $credit->monto_credito;
        $nuevoMonto = $montoOriginal - $totalPagado;

        echo "┌─────────────────────────────────────────────────────────────────────\n";
        echo "│ Credit ID: {$credit->id} | {$credit->numero_operacion}\n";
        echo "│ Lead: {$credit->lead_name} ({$credit->cedula})\n";
        echo "├─────────────────────────────────────────────────────────────────────\n";
        echo "│ Monto Original: ₡" . number_format($montoOriginal, 2) . "\n";
        echo "│ Total Pagado: ₡" . number_format($totalPagado, 2) . "\n";
        echo "│ Nuevo Monto: ₡" . number_format($nuevoMonto, 2) . "\n";
        echo "└─────────────────────────────────────────────────────────────────────\n";

        if ($nuevoMonto <= 0) {
            echo "⚠️  ADVERTENCIA: El crédito está completamente pagado. Se omite.\n\n";
            continue;
        }

        // 1. Borrar pagos
        $deletedPayments = DB::table('credit_payments')
            ->where('credit_id', $credit->id)
            ->delete();
        echo "   ✓ Pagos borrados: {$deletedPayments}\n";

        // 2. Borrar plan de pagos
        $deletedPlans = DB::table('plan_de_pagos')
            ->where('credit_id', $credit->id)
            ->delete();
        echo "   ✓ Planes borrados: {$deletedPlans}\n";

        // 3. Ajustar crédito con nuevo monto (restando lo pagado)
        DB::table('credits')
            ->where('id', $credit->id)
            ->update([
                'monto_credito' => $nuevoMonto,
                'saldo' => $nuevoMonto,
                'status' => 'Formalizado',
                'formalized_at' => '2025-11-15',
                'fecha_ultimo_pago' => null,
                'cuotas_atrasadas' => 0,
                'updated_at' => now()
            ]);
        echo "   ✓ Crédito ajustado con nuevo monto: ₡" . number_format($nuevoMonto, 2) . "\n\n";
    }

    DB::commit();

    echo "====================================================================\n";
    echo "✓ Reset completado exitosamente\n";
    echo "====================================================================\n\n";

    // Verificación final
    echo "Verificación Final:\n\n";
    $results = DB::select("
        SELECT
            c.id,
            c.numero_operacion,
            p.name,
            p.cedula,
            c.monto_credito,
            c.saldo,
            c.status,
            c.formalized_at,
            (SELECT COUNT(*) FROM plan_de_pagos WHERE credit_id = c.id) as cuotas_plan,
            (SELECT COUNT(*) FROM credit_payments WHERE credit_id = c.id) as pagos
        FROM credits c
        JOIN persons p ON c.lead_id = p.id
        WHERE p.cedula IN ('" . implode("','", $cedulas) . "')
          AND p.person_type_id = 1
    ");

    foreach ($results as $r) {
        echo "• ID {$r->id} ({$r->numero_operacion}) - {$r->name}\n";
        echo "  Monto: ₡" . number_format($r->monto_credito, 2) . " | Saldo: ₡" . number_format($r->saldo, 2) . "\n";
        echo "  Status: {$r->status} | Plan: {$r->cuotas_plan} cuotas | Pagos: {$r->pagos}\n\n";
    }

    echo "====================================================================\n";
    echo "PRÓXIMOS PASOS:\n";
    echo "1. Regenerar el plan de pagos para cada crédito via Frontend\n";
    echo "2. El nuevo plan se generará con el MONTO AJUSTADO (sin lo pagado)\n";
    echo "3. El sistema usará la nueva lógica con int_corriente_vencido\n";
    echo "====================================================================\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}
