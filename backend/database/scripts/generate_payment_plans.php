<?php

/**
 * Script para Generar Planes de Pago Automáticamente
 * Crea la fila de inicialización y el evento booted() genera las cuotas
 */

require __DIR__ . '/../../vendor/autoload.php';

$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Credit;
use App\Models\PlanDePago;
use Illuminate\Support\Facades\DB;

echo "====================================================================\n";
echo "Generador Automático de Planes de Pago\n";
echo "====================================================================\n\n";

try {
    // Buscar créditos formalizados sin plan de pagos
    $credits = Credit::where('status', 'Formalizado')
        ->whereDoesntHave('planDePagos')
        ->with('tasa')
        ->get();

    if ($credits->isEmpty()) {
        echo "✓ No se encontraron créditos sin plan de pagos.\n";
        exit(0);
    }

    echo "Créditos encontrados: " . $credits->count() . "\n\n";

    DB::beginTransaction();

    foreach ($credits as $credit) {
        echo "┌─────────────────────────────────────────────────────────────────────\n";
        echo "│ Credit ID: {$credit->id} | {$credit->numero_operacion}\n";
        echo "│ Monto: ₡" . number_format($credit->monto_credito, 2) . " | Plazo: {$credit->plazo} meses\n";
        echo "│ Tasa: {$credit->tasa->tasa}% | Formalizado: {$credit->formalized_at}\n";
        echo "└─────────────────────────────────────────────────────────────────────\n";

        // Crear fila de inicialización (numero_cuota = 0)
        // El evento booted() detectará esto y generará automáticamente las cuotas
        $init = PlanDePago::create([
            'credit_id' => $credit->id,
            'linea' => $credit->category ?? 'N/A',
            'numero_cuota' => 0,
            'proceso' => 'Inicialización',
            'fecha_inicio' => $credit->formalized_at,
            'fecha_corte' => $credit->formalized_at,
            'fecha_pago' => null,
            'tasa_actual' => $credit->tasa->tasa ?? 0,
            'plazo_actual' => $credit->plazo,
            'cuota' => 0,
            'poliza' => 0,
            'interes_corriente' => 0,
            'int_corriente_vencido' => 0,
            'interes_moratorio' => 0,
            'amortizacion' => 0,
            'saldo_anterior' => 0,
            'saldo_nuevo' => $credit->monto_credito,
            'dias' => 0,
            'estado' => 'Inicialización',
            'dias_mora' => 0,
            'fecha_movimiento' => null,
            'movimiento_total' => 0,
            'movimiento_poliza' => 0,
            'movimiento_interes_corriente' => 0,
            'movimiento_interes_moratorio' => 0,
            'movimiento_principal' => $credit->monto_credito,
            'movimiento_amortizacion' => 0,
            'movimiento_caja_usuario' => 'Sistema',
            'tipo_documento' => null,
            'numero_documento' => null,
            'concepto' => 'Inicialización del plan de pagos',
        ]);

        // Contar cuotas generadas (el evento booted() las crea automáticamente)
        $cuotasGeneradas = PlanDePago::where('credit_id', $credit->id)
            ->where('numero_cuota', '>', 0)
            ->count();

        echo "   ✓ Fila de inicialización creada\n";
        echo "   ✓ Cuotas generadas automáticamente: {$cuotasGeneradas}\n\n";
    }

    DB::commit();

    echo "====================================================================\n";
    echo "✓ Planes de pago generados exitosamente\n";
    echo "====================================================================\n\n";

    // Verificación final
    echo "Verificación Final:\n\n";
    $results = DB::select("
        SELECT
            c.id,
            c.numero_operacion,
            c.monto_credito,
            c.plazo,
            c.status,
            COUNT(pp.id) - 1 as cuotas_generadas
        FROM credits c
        LEFT JOIN plan_de_pagos pp ON c.id = pp.credit_id AND pp.numero_cuota > 0
        WHERE c.status = 'Formalizado'
        GROUP BY c.id, c.numero_operacion, c.monto_credito, c.plazo, c.status
    ");

    echo sprintf(
        "%-4s | %-18s | %-15s | %-8s | %-12s\n",
        "ID", "Operación", "Monto", "Plazo", "Cuotas"
    );
    echo str_repeat("-", 70) . "\n";

    foreach ($results as $r) {
        echo sprintf(
            "%-4s | %-18s | ₡%-13s | %-8s | %-12s\n",
            $r->id,
            $r->numero_operacion ?: 'N/A',
            number_format($r->monto_credito, 2),
            $r->plazo . " meses",
            $r->cuotas_generadas
        );
    }

    echo "\n====================================================================\n";
    echo "LISTO PARA USAR:\n";
    echo "1. Los planes de pago están generados con la nueva columna int_corriente_vencido\n";
    echo "2. Puedes cargar la planilla del 27/1/2026\n";
    echo "3. El sistema aplicará la lógica de tasas variable automáticamente\n";
    echo "====================================================================\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}
