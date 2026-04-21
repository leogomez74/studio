<?php

/**
 * anular_saldo_aplicado.php
 *
 * Revierte los pagos "Abono a Capital (Saldo Pendiente)" activos que quedaron
 * huérfanos después de anular una planilla. Hace exactamente lo mismo que
 * se haría manualmente desde tinker:
 *
 *  1. Restaura el saldo del crédito (+ amortizacion del pago)
 *  2. Revierte las cuotas afectadas (movimiento_*)
 *  3. Reactiva el SaldoPendiente (→ 'pendiente')
 *  4. Marca el CreditPayment como Reversado
 *  5. Dispara el asiento contable de anulación
 *
 * USO:
 *   php anular_saldo_aplicado.php           → preview, no ejecuta
 *   php anular_saldo_aplicado.php --yes     → ejecuta sin confirmación
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\CreditPayment;
use App\Models\Credit;
use App\Models\PlanDePago;
use App\Models\SaldoPendiente;

$autoYes = in_array('--yes', $argv ?? []);
$motivo  = 'Anulación manual: saldo proveniente de planilla anulada';

echo "\n";
echo "╔══════════════════════════════════════════════════════╗\n";
echo "║       ANULACIÓN SALDOS PENDIENTES APLICADOS          ║\n";
echo "╚══════════════════════════════════════════════════════╝\n\n";

// ─── Detectar pagos a revertir ────────────────────────────────────────────────
//
// Busca CreditPayments activos (Vigente) de tipo "Abono a Capital (Saldo Pendiente)".
// Incluye también pagos con source = 'Saldo Pendiente' por compatibilidad histórica.

$payments = CreditPayment::with(['credit.lead', 'details'])
    ->where(function ($q) {
        $q->where('source', 'like', '%Abono a Capital%')
          ->orWhere('source', 'Saldo Pendiente');
    })
    ->where('estado_reverso', 'Vigente')
    ->orderBy('id', 'asc')
    ->get();

// ─── Detectar saldos huérfanos (CP ya revertido pero saldo sigue asignado_capital) ───

$cpRevertidosIds = CreditPayment::where(function ($q) {
        $q->where('source', 'like', '%Abono a Capital%')
          ->orWhere('source', 'Saldo Pendiente');
    })
    ->where('estado_reverso', 'Anulado')
    ->pluck('saldo_pendiente_id')
    ->filter()
    ->toArray();

$huerfanos = SaldoPendiente::where('estado', 'asignado_capital')
    ->whereIn('id', $cpRevertidosIds)
    ->with('credit.lead')
    ->get();

// Fallback para huérfanos históricos sin saldo_pendiente_id
$allAsignados = SaldoPendiente::where('estado', 'asignado_capital')
    ->whereNotIn('id', array_merge($huerfanos->pluck('id')->toArray(), [0]))
    ->whereNotIn('id', $payments->map(fn($p) => $p->saldo_pendiente_id)->filter()->toArray())
    ->with('credit.lead')
    ->get();

foreach ($allAsignados as $saldo) {
    if (!$saldo->asignado_at) continue;
    $hasActiveCp = CreditPayment::where('credit_id', $saldo->credit_id)
        ->where('source', 'like', '%Abono a Capital%')
        ->where('estado_reverso', 'Vigente')
        ->whereBetween('fecha_pago', [
            $saldo->asignado_at->copy()->subDays(3)->toDateString(),
            $saldo->asignado_at->copy()->addDays(3)->toDateString(),
        ])
        ->exists();
    if (!$hasActiveCp) {
        $huerfanos->push($saldo);
    }
}

// ─── Preview ──────────────────────────────────────────────────────────────────

if ($payments->isEmpty() && $huerfanos->isEmpty()) {
    echo "✔ No hay nada que hacer. El sistema está limpio.\n\n";
    $byState = DB::table('saldos_pendientes')->selectRaw('estado, count(*) as cnt')->groupBy('estado')->get();
    foreach ($byState as $row) echo "  saldos {$row->estado}: {$row->cnt}\n";
    echo "\n";
    exit(0);
}

if ($payments->isNotEmpty()) {
    echo "[PAGOS A REVERTIR (" . $payments->count() . ")]\n";
    foreach ($payments as $p) {
        $credit = $p->credit;
        $saldo  = findSaldo($p);
        echo sprintf(
            "  CP#%d | %s | ₡%s | Source: %s | Fecha: %s\n",
            $p->id,
            $credit->reference ?? "credit#{$credit->id}",
            number_format((float) $p->monto, 2),
            $p->source,
            $p->fecha_pago
        );
        echo "    Amortización a devolver al crédito: ₡" . number_format((float) $p->amortizacion, 2) . "\n";
        echo "    Cuotas con detalles: " . $p->details->count() . "\n";
        echo "    Saldo vinculado: " . ($saldo ? "Saldo#{$saldo->id} ({$saldo->estado})" : "no encontrado") . "\n";
    }
    echo "\n";
}

if ($huerfanos->isNotEmpty()) {
    echo "[SALDOS HUÉRFANOS A CORREGIR (" . $huerfanos->count() . ")]\n";
    echo "(Su CreditPayment ya fue revertido pero el saldo sigue en asignado_capital)\n";
    foreach ($huerfanos as $s) {
        echo sprintf(
            "  Saldo#%d | %s | ₡%s | asignado_at: %s\n",
            $s->id,
            $s->credit->reference ?? "credit#{$s->credit_id}",
            number_format((float) $s->monto, 2),
            $s->asignado_at ?? 'N/A'
        );
        echo "    → solo se restaurará a 'pendiente'\n";
    }
    echo "\n";
}

if (!$autoYes) {
    echo "¿Confirmar? (escribe 'si' para ejecutar): ";
    if (trim(fgets(STDIN)) !== 'si') {
        echo "\nCancelado.\n\n";
        exit(0);
    }
    echo "\n";
}

// ─── Ejecución ────────────────────────────────────────────────────────────────

$trigger = new class {
    use \App\Traits\AccountingTrigger;
    public function disparar(string $type, float $amount, string $ref, array $ctx): array {
        return $this->triggerAccountingEntry($type, $amount, $ref, $ctx);
    }
};

DB::beginTransaction();
try {

    // 1. Revertir pagos activos
    foreach ($payments as $payment) {
        $credit = Credit::lockForUpdate()->find($payment->credit_id);

        // Revertir cuotas
        $capitalRevertido = 0.0;
        foreach ($payment->details as $detail) {
            $cuota = PlanDePago::lockForUpdate()->find($detail->plan_de_pago_id);
            if (!$cuota) continue;

            $cuota->movimiento_interes_moratorio     = max(0, $cuota->movimiento_interes_moratorio - $detail->pago_mora);
            $cuota->movimiento_int_corriente_vencido = max(0, ($cuota->movimiento_int_corriente_vencido ?? 0) - $detail->pago_int_vencido);
            $cuota->movimiento_interes_corriente     = max(0, $cuota->movimiento_interes_corriente - $detail->pago_int_corriente);
            $cuota->movimiento_poliza                = max(0, $cuota->movimiento_poliza - $detail->pago_poliza);
            $cuota->movimiento_principal             = max(0, $cuota->movimiento_principal - $detail->pago_principal);
            $cuota->movimiento_amortizacion          = max(0, $cuota->movimiento_amortizacion - $detail->pago_principal);
            $cuota->movimiento_total                 = max(0, $cuota->movimiento_total - $detail->pago_total);

            if ($cuota->movimiento_total <= 0.005) {
                $cuota->estado                  = $detail->estado_anterior;
                $cuota->concepto                = null;
                $cuota->fecha_pago              = null;
                $cuota->fecha_movimiento        = null;
                $cuota->movimiento_caja_usuario = null;
                $cuota->tipo_documento          = null;
                $cuota->numero_documento        = null;
            } else {
                $totalExigible = $cuota->interes_corriente
                    + ($cuota->int_corriente_vencido ?? 0)
                    + $cuota->interes_moratorio
                    + $cuota->poliza
                    + $cuota->amortizacion;
                $cuota->estado = $cuota->movimiento_total >= ($totalExigible - 0.05) ? 'Pagado' : 'Parcial';
                $cuota->concepto = 'Pago parcial';
            }
            $cuota->save();
            $capitalRevertido += (float) $detail->pago_principal;
        }

        // Sin detalles: es un Abono a Capital — restaurar plan via reversal_snapshot
        if ($payment->details->isEmpty()) {
            $capitalRevertido = (float) $payment->amortizacion;

            $snap = is_array($payment->reversal_snapshot)
                ? $payment->reversal_snapshot
                : (is_string($payment->reversal_snapshot) ? json_decode($payment->reversal_snapshot, true) : null);

            if ($snap && !empty($snap['plan_rows']) && isset($snap['start_cuota_num'])) {
                PlanDePago::where('credit_id', $credit->id)
                    ->where('numero_cuota', '>=', $snap['start_cuota_num'])
                    ->delete();
                foreach ($snap['plan_rows'] as $row) {
                    unset($row['id'], $row['created_at'], $row['updated_at']);
                    PlanDePago::create($row);
                }
                if (isset($snap['original_cuota'])) $credit->cuota = $snap['original_cuota'];
                if (isset($snap['original_plazo'])) $credit->plazo = $snap['original_plazo'];
                $credit->save();
                echo "    → Plan de pagos restaurado desde snapshot (" . count($snap['plan_rows']) . " cuotas)\n";
            }
        }

        // Restaurar saldo crédito
        $credit->saldo = round((float) $credit->saldo + $capitalRevertido, 2);
        $credit->save();

        // Reactivar SaldoPendiente
        $saldo = findSaldo($payment);
        if ($saldo) {
            $saldo->estado      = 'pendiente';
            $saldo->asignado_at = null;
            $saldo->save();
        }

        // Marcar CP como Reversado
        $payment->estado           = 'Reversado';
        $payment->estado_reverso   = 'Anulado';
        $payment->motivo_anulacion = $motivo;
        $payment->fecha_anulacion  = now();
        $payment->save();

        // Asiento contable
        $trigger->disparar(
            'ANULACION_SALDO_APLICADO',
            (float) $payment->monto,
            "ANULA-SALDO-{$payment->id}-{$credit->reference}",
            [
                'reference'     => "ANULA-SALDO-{$payment->id}-{$credit->reference}",
                'credit_id'     => $credit->reference,
                'cedula'        => $credit->lead->cedula ?? null,
                'clienteNombre' => $credit->lead->name ?? null,
                'motivo'        => $motivo,
                'amount_breakdown' => [
                    'total'                    => (float) $payment->monto,
                    'capital'                  => $capitalRevertido,
                    'interes_corriente'        => 0,
                    'interes_moratorio'        => 0,
                    'poliza'                   => 0,
                    'cargos_adicionales_total' => 0,
                    'cargos_adicionales'       => [],
                ],
            ]
        );

        echo "  [OK] CP#{$payment->id} revertido | capital devuelto: ₡" . number_format($capitalRevertido, 2) . " | nuevo saldo crédito: ₡" . number_format($credit->saldo, 2) . "\n";
    }

    // 2. Corregir huérfanos (solo actualizar estado, el saldo del crédito ya fue corregido)
    foreach ($huerfanos as $saldo) {
        $saldo->estado      = 'pendiente';
        $saldo->asignado_at = null;
        $saldo->save();

        $credit = $saldo->credit;
        $trigger->disparar(
            'ANULACION_SALDO_APLICADO',
            (float) $saldo->monto,
            "CORR-SALDO-{$saldo->id}-" . ($credit->reference ?? $credit->id),
            [
                'reference'     => "CORR-SALDO-{$saldo->id}-" . ($credit->reference ?? $credit->id),
                'credit_id'     => $credit->reference ?? $credit->id,
                'cedula'        => $credit->lead->cedula ?? null,
                'clienteNombre' => $credit->lead->name ?? null,
                'motivo'        => 'Corrección huérfano: CP derivado ya revertido',
                'amount_breakdown' => [
                    'total'                    => (float) $saldo->monto,
                    'capital'                  => (float) $saldo->monto,
                    'interes_corriente'        => 0,
                    'interes_moratorio'        => 0,
                    'poliza'                   => 0,
                    'cargos_adicionales_total' => 0,
                    'cargos_adicionales'       => [],
                ],
            ]
        );

        echo "  [OK] Saldo#{$saldo->id} → pendiente (huérfano corregido)\n";
    }

    DB::commit();

} catch (\Exception $e) {
    DB::rollBack();
    echo "\n[ERROR] " . $e->getMessage() . "\n";
    echo "Transacción revertida. No se aplicaron cambios.\n\n";
    exit(1);
}

// ─── Resumen final ────────────────────────────────────────────────────────────

echo "\n✔ Completado.\n\n";
$byState = DB::table('saldos_pendientes')->selectRaw('estado, count(*) as cnt')->groupBy('estado')->get();
echo "Estado final saldos_pendientes:\n";
foreach ($byState as $row) echo "  {$row->estado}: {$row->cnt}\n";
echo "\n";

// ─── Helper ───────────────────────────────────────────────────────────────────

function findSaldo(CreditPayment $payment): ?SaldoPendiente
{
    if ($payment->saldo_pendiente_id) {
        $s = SaldoPendiente::find($payment->saldo_pendiente_id);
        if ($s) return $s;
    }

    if (!$payment->fecha_pago) return null;

    return SaldoPendiente::where('credit_id', $payment->credit_id)
        ->where('estado', 'asignado_capital')
        ->whereBetween('asignado_at', [
            \Carbon\Carbon::parse($payment->fecha_pago)->subDays(3),
            \Carbon\Carbon::parse($payment->fecha_pago)->addDays(3),
        ])
        ->orderBy('id', 'desc')
        ->first();
}
