<?php

/**
 * recalcular_plan_pagos.php
 *
 * Repara los campos base del plan de pagos (saldo_anterior, saldo_nuevo,
 * interes_corriente, amortizacion) para todas las cuotas Pendiente/Mora
 * que quedaron con valores incorrectos tras anulaciones de planillas.
 *
 * USO:
 *   php recalcular_plan_pagos.php           → preview (no ejecuta)
 *   php recalcular_plan_pagos.php --yes     → ejecuta
 *   php recalcular_plan_pagos.php CRED-XXX  → solo ese crédito (preview)
 *   php recalcular_plan_pagos.php CRED-XXX --yes → solo ese crédito
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Credit;
use App\Models\PlanDePago;
use Illuminate\Support\Facades\DB;

$autoYes   = in_array('--yes', $argv ?? []);
$soloRef   = collect($argv ?? [])->first(fn($a) => strpos($a, '--') !== 0 && $a !== $argv[0]);
$soloRef   = $soloRef && preg_match('/CRED-/i', $soloRef) ? $soloRef : null;

echo "\n";
echo "╔══════════════════════════════════════════════════════╗\n";
echo "║       RECALCULAR PLAN DE PAGOS — REPARACIÓN          ║\n";
echo "╚══════════════════════════════════════════════════════╝\n\n";

// Obtener créditos a reparar
$query = Credit::with(['planDePagos' => function($q) {
    $q->where('numero_cuota', '>', 0)->orderBy('numero_cuota');
}])->whereIn('status', ['Formalizado', 'En Mora', 'Cerrado', 'Finalizado'])
  ->whereNotNull('tasa_anual')
  ->where('tasa_anual', '>', 0);

if ($soloRef) {
    $query->where('reference', $soloRef);
    echo "Modo: solo crédito {$soloRef}\n\n";
}

$credits = $query->get();
echo "Créditos a revisar: {$credits->count()}\n\n";

$totalReparados  = 0;
$totalCuotas     = 0;
$cambios         = [];

foreach ($credits as $credit) {
    $tasaMensual  = ((float) $credit->tasa_anual) / 100 / 12;
    $cuotas       = $credit->planDePagos->sortBy('numero_cuota');
    $creditoCambios = [];

    $saldoAnteriorEsperado = (float) $credit->monto_credito;

    foreach ($cuotas as $cuota) {
        // Cuotas pagadas: usar su saldo_nuevo como base para la siguiente
        if (in_array($cuota->estado, ['Pagado', 'Pagada'])) {
            if ((float) $cuota->saldo_nuevo > 0) {
                $saldoAnteriorEsperado = (float) $cuota->saldo_nuevo;
            }
            continue;
        }

        // Cuotas Pendiente / Mora / Parcial: verificar y recalcular
        $intEsperado   = round($saldoAnteriorEsperado * $tasaMensual, 2);
        $poliza        = (float) ($cuota->poliza ?? 0);
        $amortEsperado = round((float) $cuota->cuota - $intEsperado - $poliza, 2);
        $saldoNuevoEsp = round($saldoAnteriorEsperado - max(0, $amortEsperado), 2);

        $difSaldoAnt  = abs((float) $cuota->saldo_anterior  - $saldoAnteriorEsperado);
        $difInt       = abs((float) $cuota->interes_corriente - $intEsperado);
        $difAmort     = abs((float) $cuota->amortizacion     - $amortEsperado);
        $difSaldoNvo  = abs((float) $cuota->saldo_nuevo      - $saldoNuevoEsp);
        $tieneVencido = (float) ($cuota->int_corriente_vencido ?? 0) > 0 && $cuota->estado === 'Pendiente';
        $tieneMora    = (float) ($cuota->interes_moratorio ?? 0) > 0 && $cuota->estado === 'Pendiente';

        $necesitaReparar = $difSaldoAnt > 0.05 || $difInt > 0.05 || $difAmort > 0.05
                        || $difSaldoNvo > 0.05 || $tieneVencido || $tieneMora;

        if ($necesitaReparar) {
            $creditoCambios[] = [
                'cuota'         => $cuota,
                'nuevo_int'     => $intEsperado,
                'nuevo_amort'   => max(0, $amortEsperado),
                'nuevo_sald_ant' => $saldoAnteriorEsperado,
                'nuevo_sald_nvo' => max(0, $saldoNuevoEsp),
            ];
            $totalCuotas++;
        }

        // Actualizar el cursor para la siguiente cuota
        $saldoAnteriorEsperado = max(0, $saldoNuevoEsp);
    }

    if (!empty($creditoCambios)) {
        $totalReparados++;
        $cambios[$credit->reference] = $creditoCambios;
        $leadName = $credit->lead->name ?? '';
        echo "  [{$credit->reference}] {$leadName} — {$credit->status} — ".count($creditoCambios)." cuota(s) a reparar\n";
        foreach ($creditoCambios as $c) {
            $n = $c['cuota']->numero_cuota;
            echo "    Cuota #{$n}: saldo_ant={$c['nuevo_sald_ant']} int={$c['nuevo_int']} amort={$c['nuevo_amort']} saldo_nvo={$c['nuevo_sald_nvo']}\n";
        }
    }
}

echo "\nTotal: {$totalReparados} créditos, {$totalCuotas} cuotas a reparar.\n\n";

if ($totalCuotas === 0) {
    echo "✔ No hay cuotas que reparar.\n\n";
    exit(0);
}

if (!$autoYes) {
    echo "¿Aplicar reparaciones? (escribe 'si' para continuar): ";
    if (trim(fgets(STDIN)) !== 'si') {
        echo "\nCancelado.\n\n";
        exit(0);
    }
}

// Ejecutar reparaciones
DB::beginTransaction();
try {
    foreach ($cambios as $ref => $cuotasCambios) {
        foreach ($cuotasCambios as $c) {
            PlanDePago::where('id', $c['cuota']->id)->update([
                'interes_corriente'    => $c['nuevo_int'],
                'amortizacion'         => $c['nuevo_amort'],
                'saldo_anterior'       => $c['nuevo_sald_ant'],
                'saldo_nuevo'          => $c['nuevo_sald_nvo'],
                'int_corriente_vencido' => 0,
                'interes_moratorio'    => 0,
                'dias_mora'            => 0,
            ]);
        }
        echo "  [OK] {$ref} — ".count($cuotasCambios)." cuota(s) reparadas\n";
    }
    DB::commit();
    echo "\n✔ Completado — {$totalCuotas} cuotas reparadas en {$totalReparados} créditos.\n\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "\n[ERROR] " . $e->getMessage() . "\nTransacción revertida.\n\n";
    exit(1);
}
