<?php

namespace App\Services;

use App\Models\Credit;
use App\Models\CreditPayment;
use App\Models\PlanDePago;
use App\Models\SaldoPendiente;
use App\Traits\AccountingTrigger;
use Illuminate\Support\Facades\Auth;

class ReversalService
{
    use AccountingTrigger;

    protected PaymentHelperService $helper;

    public function __construct(PaymentHelperService $helper)
    {
        $this->helper = $helper;
    }

    /**
     * Revertir un pago (solo el último pago vigente del crédito).
     * Soporta todos los tipos: Ventanilla, Adelanto, Planilla, Extraordinario, Cancelación Anticipada.
     */
    public function reversePayment(CreditPayment $payment, Credit $credit, string $motivo)
    {
        // 1. Validar que no esté ya anulado
        if ($payment->estado_reverso === 'Anulado') {
            return response()->json([
                'message' => 'Este pago ya fue anulado anteriormente.'
            ], 422);
        }

        // 2. Validar que sea el último pago vigente del crédito (LIFO)
        $lastPayment = CreditPayment::where('credit_id', $payment->credit_id)
            ->where('estado_reverso', 'Vigente')
            ->orderBy('id', 'desc')
            ->first();

        if (!$lastPayment || $lastPayment->id !== $payment->id) {
            return response()->json([
                'message' => 'Solo se puede revertir el último pago vigente del crédito. Revierta primero el pago #' . ($lastPayment->id ?? 'N/A') . '.'
            ], 422);
        }

        // 3. Routing por tipo de pago
        if ($payment->source === 'Extraordinario') {
            return $this->reverseExtraordinario($payment, $credit, $motivo);
        }

        if ($payment->source === 'Cancelación Anticipada') {
            return $this->reverseCancelacionAnticipada($payment, $credit, $motivo);
        }

        // 4. Reversal basado en credit_payment_details (Ventanilla, Adelanto, Planilla)
        if ($payment->details->isEmpty()) {
            return response()->json([
                'message' => 'Este pago no tiene detalles de cuotas registrados. Los pagos anteriores al sistema de reverso no pueden revertirse.'
            ], 422);
        }

        $capitalRevertido = 0.0;
        $cuotasRevertidas = 0;

        foreach ($payment->details as $detail) {
            $cuota = PlanDePago::lockForUpdate()->find($detail->plan_de_pago_id);
            if (!$cuota) continue;

            // Restar los deltas exactos
            $cuota->movimiento_interes_moratorio = max(0, $cuota->movimiento_interes_moratorio - $detail->pago_mora);
            $cuota->movimiento_int_corriente_vencido = max(0, ($cuota->movimiento_int_corriente_vencido ?? 0) - $detail->pago_int_vencido);
            $cuota->movimiento_interes_corriente = max(0, $cuota->movimiento_interes_corriente - $detail->pago_int_corriente);
            $cuota->movimiento_poliza = max(0, $cuota->movimiento_poliza - $detail->pago_poliza);
            $cuota->movimiento_principal = max(0, $cuota->movimiento_principal - $detail->pago_principal);
            $cuota->movimiento_amortizacion = max(0, $cuota->movimiento_amortizacion - $detail->pago_principal);
            $cuota->movimiento_total = max(0, $cuota->movimiento_total - $detail->pago_total);

            // Restaurar estado anterior o recalcular
            if ($cuota->movimiento_total <= 0.005) {
                $cuota->estado = $detail->estado_anterior;
                $cuota->concepto = null;
                $cuota->fecha_pago = null;
                $cuota->fecha_movimiento = null;
                $cuota->movimiento_caja_usuario = null;
                $cuota->tipo_documento = null;
                $cuota->numero_documento = null;
            } else {
                $totalExigible = $cuota->interes_corriente
                    + ($cuota->int_corriente_vencido ?? 0)
                    + $cuota->interes_moratorio
                    + $cuota->poliza
                    + $cuota->amortizacion;

                if ($cuota->movimiento_total >= ($totalExigible - 0.05)) {
                    $cuota->estado = 'Pagado';
                } else {
                    $cuota->estado = 'Parcial';
                    $cuota->concepto = 'Pago parcial';
                }
            }

            $cuota->save();
            $capitalRevertido += (float) $detail->pago_principal;
            $cuotasRevertidas++;
        }

        // Limpiar SaldoPendiente asociado
        $sobranteAnulado = (float) SaldoPendiente::where('credit_payment_id', $payment->id)->sum('monto');
        SaldoPendiente::where('credit_payment_id', $payment->id)->delete();

        // Restaurar saldo del crédito
        $credit->saldo = round((float) $credit->saldo + $capitalRevertido, 2);

        if ($credit->status === 'Cerrado') {
            $credit->status = 'Formalizado';
        }
        $credit->save();

        // Marcar pago como anulado
        $this->helper->markPaymentAsAnulado($payment, $motivo);

        // ACCOUNTING_API_TRIGGER: Reverso de Pago
        $this->triggerAccountingEntry(
            'REVERSO_PAGO',
            (float) $payment->monto,
            "REVERSO-{$payment->id}-{$credit->reference}",
            [
                'reference' => "REVERSO-{$payment->id}-{$credit->reference}",
                'credit_id' => $credit->reference,
                'cedula' => $credit->lead->cedula ?? null,
                'clienteNombre' => $credit->lead->name ?? null,
                'motivo' => $motivo,
                'amount_breakdown' => [
                    'total' => (float) $payment->monto,
                    'interes_corriente' => 0,
                    'interes_moratorio' => 0,
                    'poliza' => 0,
                    'capital' => $capitalRevertido,
                    'cargos_adicionales_total' => 0,
                    'cargos_adicionales' => [],
                ],
            ]
        );

        // Disparar ANULACION_SOBRANTE si el pago tenía sobrante retenido
        if ($sobranteAnulado > 0.50) {
            $this->triggerAccountingEntry(
                'ANULACION_SOBRANTE',
                $sobranteAnulado,
                "ANULA-SOB-{$payment->id}-{$credit->reference}",
                [
                    'reference'      => "ANULA-SOB-{$payment->id}-{$credit->reference}",
                    'credit_id'      => $credit->reference,
                    'cedula'         => $credit->lead->cedula ?? null,
                    'clienteNombre'  => $credit->lead->name ?? null,
                    'motivo'         => $motivo,
                    'amount_breakdown' => [
                        'total'                  => $sobranteAnulado,
                        'sobrante'               => $sobranteAnulado,
                        'interes_corriente'      => 0,
                        'interes_moratorio'      => 0,
                        'poliza'                 => 0,
                        'capital'                => 0,
                        'cargos_adicionales_total' => 0,
                        'cargos_adicionales'     => [],
                    ],
                ]
            );
        }

        return response()->json([
            'message' => 'Pago revertido exitosamente.',
            'saldo_restaurado' => $credit->saldo,
            'cuotas_revertidas' => $cuotasRevertidas,
            'capital_revertido' => $capitalRevertido,
        ]);
    }

    /**
     * Revertir un abono extraordinario usando el snapshot del plan.
     */
    private function reverseExtraordinario(CreditPayment $payment, Credit $credit, string $motivo)
    {
        $snapshot = $payment->reversal_snapshot;
        if (!$snapshot || empty($snapshot['plan_rows'])) {
            return response()->json([
                'message' => 'Este pago extraordinario no tiene snapshot de reverso. Los pagos anteriores al sistema de reverso no pueden revertirse.'
            ], 422);
        }

        $startCuotaNum = $snapshot['start_cuota_num'];

        // 1. Eliminar cuotas regeneradas
        PlanDePago::where('credit_id', $credit->id)
            ->where('numero_cuota', '>=', $startCuotaNum)
            ->delete();

        // 2. Restaurar cuotas originales desde snapshot
        foreach ($snapshot['plan_rows'] as $row) {
            unset($row['id'], $row['created_at'], $row['updated_at']);
            PlanDePago::create($row);
        }

        // 3. Restaurar valores del crédito
        $credit->saldo = $snapshot['original_saldo'];
        $credit->plazo = $snapshot['original_plazo'];
        $credit->cuota = $snapshot['original_cuota'];
        if (isset($snapshot['original_status']) && in_array($credit->status, ['Finalizado', 'Cerrado'])) {
            $credit->status = $snapshot['original_status'];
        }
        $credit->save();

        // 4. Marcar pago como anulado
        $this->helper->markPaymentAsAnulado($payment, $motivo);

        // ACCOUNTING_API_TRIGGER: Reverso de Abono Extraordinario
        $this->triggerAccountingEntry(
            'REVERSO_EXTRAORDINARIO',
            (float) $payment->monto,
            "REVERSO-EXTRA-{$payment->id}-{$credit->reference}",
            [
                'reference' => "REVERSO-EXTRA-{$payment->id}-{$credit->reference}",
                'credit_id' => $credit->reference,
                'cedula' => $credit->lead->cedula ?? null,
                'clienteNombre' => $credit->lead->name ?? null,
                'motivo' => $motivo,
                'amount_breakdown' => [
                    'total' => (float) $payment->monto,
                    'interes_corriente' => 0,
                    'interes_moratorio' => 0,
                    'poliza' => 0,
                    'capital' => (float) $payment->monto,
                    'cargos_adicionales_total' => 0,
                    'cargos_adicionales' => [],
                ],
            ]
        );

        return response()->json([
            'message' => 'Abono extraordinario revertido. Plan de pagos restaurado.',
            'saldo_restaurado' => $credit->saldo,
            'cuotas_restauradas' => count($snapshot['plan_rows']),
            'capital_revertido' => (float) $payment->monto,
        ]);
    }

    /**
     * Revertir una cancelación anticipada usando el snapshot de cuotas.
     */
    private function reverseCancelacionAnticipada(CreditPayment $payment, Credit $credit, string $motivo)
    {
        $snapshot = $payment->reversal_snapshot;
        if (!$snapshot || empty($snapshot['cuotas_afectadas'])) {
            return response()->json([
                'message' => 'Este pago de cancelación anticipada no tiene snapshot de reverso. Los pagos anteriores al sistema de reverso no pueden revertirse.'
            ], 422);
        }

        $cuotasRevertidas = 0;

        // 1. Restaurar cada cuota a su estado original
        foreach ($snapshot['cuotas_afectadas'] as $cuotaInfo) {
            $cuota = PlanDePago::lockForUpdate()->find($cuotaInfo['plan_de_pago_id']);
            if (!$cuota) continue;

            $cuota->estado = $cuotaInfo['estado_anterior'];
            $cuota->fecha_pago = $cuotaInfo['fecha_pago_anterior'];
            $cuota->movimiento_caja_usuario = null;
            $cuota->tipo_documento = null;
            $cuota->numero_documento = null;
            $cuota->save();
            $cuotasRevertidas++;
        }

        // 2. Restaurar valores del crédito
        $credit->saldo = $snapshot['original_credit_saldo'];
        $credit->status = $snapshot['original_status'];
        $credit->save();

        // 3. Marcar pago como anulado
        $this->helper->markPaymentAsAnulado($payment, $motivo);

        // ACCOUNTING_API_TRIGGER: Reverso de Cancelación Anticipada
        $montoTotal = (float) $payment->monto;
        $capital = (float) $payment->amortizacion;
        $interesCorriente = (float) $payment->interes_corriente;
        $interesMoratorio = (float) $payment->interes_moratorio;
        $poliza = (float) $payment->poliza;
        $penalizacion = round($montoTotal - $capital - $interesCorriente - $interesMoratorio - $poliza, 2);
        if ($penalizacion < 0) $penalizacion = 0;

        $this->triggerAccountingEntry(
            'REVERSO_CANCELACION',
            $montoTotal,
            "REVERSO-CANCEL-{$payment->id}-{$credit->reference}",
            [
                'reference' => "REVERSO-CANCEL-{$payment->id}-{$credit->reference}",
                'credit_id' => $credit->reference,
                'cedula' => $credit->lead->cedula ?? null,
                'clienteNombre' => $credit->lead->name ?? null,
                'deductora_id' => $credit->deductora_id,
                'deductora_nombre' => $credit->deductora->nombre ?? null,
                'motivo' => $motivo,
                'amount_breakdown' => [
                    'total' => $montoTotal,
                    'interes_corriente' => $interesCorriente,
                    'interes_moratorio' => $interesMoratorio,
                    'poliza' => $poliza,
                    'capital' => $capital,
                    'penalizacion' => $penalizacion,
                ],
            ]
        );

        return response()->json([
            'message' => 'Cancelación anticipada revertida. Crédito reabierto.',
            'saldo_restaurado' => $credit->saldo,
            'cuotas_revertidas' => $cuotasRevertidas,
            'capital_revertido' => $snapshot['original_credit_saldo'],
        ]);
    }
}
