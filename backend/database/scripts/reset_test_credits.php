<?php

/**
 * Script de Reset de Datos de Prueba
 * Sistema de Tasas Variable con int_corriente_vencido
 */

require __DIR__ . '/../../vendor/autoload.php';

$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "====================================================================\n";
echo "Reset de Datos de Prueba - Sistema de Tasas Variable\n";
echo "====================================================================\n\n";

$cedulas = ['118280563', '207140827', '111110002', '111110003'];

try {
    DB::beginTransaction();

    // 1. Borrar pagos
    echo "1. Borrando credit_payments...\n";
    $deletedPayments = DB::table('credit_payments')
        ->whereIn('credit_id', function($query) use ($cedulas) {
            $query->select('id')->from('credits')
                ->whereIn('lead_id', function($q) use ($cedulas) {
                    $q->select('id')->from('persons')
                        ->whereIn('cedula', $cedulas)
                        ->where('person_type_id', 1);
                });
        })->delete();
    echo "   ✓ Pagos borrados: {$deletedPayments}\n\n";

    // 2. Borrar plan de pagos
    echo "2. Borrando plan_de_pagos...\n";
    $deletedPlans = DB::table('plan_de_pagos')
        ->whereIn('credit_id', function($query) use ($cedulas) {
            $query->select('id')->from('credits')
                ->whereIn('lead_id', function($q) use ($cedulas) {
                    $q->select('id')->from('persons')
                        ->whereIn('cedula', $cedulas)
                        ->where('person_type_id', 1);
                });
        })->delete();
    echo "   ✓ Planes borrados: {$deletedPlans}\n\n";

    // 3. Resetear créditos
    echo "3. Reseteando créditos a estado Aprobado (2025-11-15)...\n";
    $updatedCredits = DB::table('credits')
        ->whereIn('lead_id', function($query) use ($cedulas) {
            $query->select('id')->from('persons')
                ->whereIn('cedula', $cedulas)
                ->where('person_type_id', 1);
        })
        ->update([
            'status' => 'Aprobado',
            'formalized_at' => '2025-11-15',
            'saldo' => DB::raw('monto_credito'),
            'fecha_ultimo_pago' => null,
            'cuotas_atrasadas' => 0,
            'updated_at' => now()
        ]);
    echo "   ✓ Créditos resetados: {$updatedCredits}\n\n";

    DB::commit();

    // 4. Verificar resultados
    echo "====================================================================\n";
    echo "4. Verificación de Resultados\n";
    echo "====================================================================\n\n";

    $results = DB::select("
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
        WHERE p.cedula IN ('" . implode("','", $cedulas) . "')
            AND p.person_type_id = 1
        ORDER BY c.id
    ");

    foreach ($results as $r) {
        echo "┌─────────────────────────────────────────────────────────────────────\n";
        echo "│ Credit ID: {$r->credit_id} | {$r->numero_operacion}\n";
        echo "│ Lead: {$r->lead_name} ({$r->cedula})\n";
        echo "├─────────────────────────────────────────────────────────────────────\n";
        echo "│ Status: {$r->status}\n";
        echo "│ Formalizado: {$r->formalized_at}\n";
        echo "│ Monto: ₡" . number_format($r->monto_credito, 2) . " | Plazo: {$r->plazo} meses\n";
        echo "│ Saldo: ₡" . number_format($r->saldo, 2) . "\n";
        echo "├─────────────────────────────────────────────────────────────────────\n";
        echo "│ Tasa Anual: {$r->tasa_anual}%\n";
        echo "│ Tasa Máxima: {$r->tasa_maxima}%\n";
        echo "│ Tasa Mora: {$r->tasa_mora}% ";
        if ($r->tasa_mora > 0) {
            echo "(CASO 2: Se calcula interés moratorio)\n";
        } else {
            echo "(CASO 1: Solo int_corriente_vencido)\n";
        }
        echo "├─────────────────────────────────────────────────────────────────────\n";
        echo "│ Cuotas en plan: {$r->cuotas_plan} (debe regenerarse)\n";
        echo "│ Pagos registrados: {$r->pagos_registrados}\n";
        echo "└─────────────────────────────────────────────────────────────────────\n\n";
    }

    echo "====================================================================\n";
    echo "✓ Reset completado exitosamente\n";
    echo "====================================================================\n\n";
    echo "PRÓXIMOS PASOS:\n";
    echo "1. Regenerar el plan de pagos para cada crédito via Frontend\n";
    echo "2. O ejecutar comando Artisan si existe: php artisan credits:regenerar-plan\n";
    echo "3. El nuevo plan usará la lógica con int_corriente_vencido\n\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
