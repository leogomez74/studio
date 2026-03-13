<?php

namespace App\Services;

use App\Models\Credit;
use App\Models\CreditPayment;
use App\Models\DeductoraChange;
use App\Models\Task;
use App\Traits\AccountingTrigger;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;

class CancelacionService
{
    use AccountingTrigger;

    /**
     * Calcula el monto total para cancelación anticipada de un crédito.
     */
    public function calcular(Credit $credit, Carbon $fechaOperacion): array
    {
        $ultimaCuotaPagada = $credit->planDePagos()
            ->where('numero_cuota', '>', 0)
            ->whereIn('estado', ['Pagado', 'Pagada'])
            ->orderBy('numero_cuota', 'desc')
            ->first();

        $numeroCuotaActual = $ultimaCuotaPagada ? $ultimaCuotaPagada->numero_cuota : 0;
        $saldoCapital = (float) $credit->saldo;

        // Intereses vencidos de cuotas en mora
        $interesesMora = (float) $credit->planDePagos()
            ->where('numero_cuota', '>', 0)
            ->where('estado', 'Mora')
            ->sum('int_corriente_vencido');

        // Interés corriente prorrateado del mes corriente
        $tasaAnual = (float) $credit->tasa_anual;
        $diasTranscurridos = $fechaOperacion->copy()->startOfMonth()->diffInDays($fechaOperacion);
        $interesCorrienteMes = round($saldoCapital * ($tasaAnual / 100) / 365 * $diasTranscurridos, 2);

        $interesesVencidos = round($interesesMora + $interesCorrienteMes, 2);
        $saldoPendiente = round($saldoCapital + $interesesVencidos, 2);

        $cuotaMensual = (float) $credit->cuota;

        // Penalización: cuota × 3 si está antes de la cuota 12
        $penalizacion = 0;
        if ($numeroCuotaActual < 12) {
            $penalizacion = round($cuotaMensual * 3, 2);
        }

        $montoTotalCancelar = round($saldoPendiente + $penalizacion, 2);

        return [
            'credit_id' => $credit->id,
            'cuota_actual' => $numeroCuotaActual,
            'saldo_capital' => $saldoCapital,
            'intereses_mora' => $interesesMora,
            'interes_corriente_mes' => $interesCorrienteMes,
            'dias_transcurridos' => $diasTranscurridos,
            'intereses_vencidos' => $interesesVencidos,
            'saldo_pendiente' => $saldoPendiente,
            'cuota_mensual' => $cuotaMensual,
            'aplica_penalizacion' => $numeroCuotaActual < 12,
            'monto_penalizacion' => $penalizacion,
            'monto_total_cancelar' => $montoTotalCancelar,
        ];
    }

    /**
     * Procesa la cancelación anticipada de un crédito.
     */
    public function ejecutar(Credit $credit, Carbon $fechaOperacion, $request): array
    {
        // Calcular montos
        $ultimaCuotaPagada = $credit->planDePagos()
            ->where('numero_cuota', '>', 0)
            ->whereIn('estado', ['Pagado', 'Pagada'])
            ->orderBy('numero_cuota', 'desc')
            ->first();

        $numeroCuotaActual = $ultimaCuotaPagada ? $ultimaCuotaPagada->numero_cuota : 0;
        $saldoCapital = (float) $credit->saldo;
        $cuotaMensual = (float) $credit->cuota;

        // Intereses vencidos de cuotas en mora
        $interesesMora = (float) $credit->planDePagos()
            ->where('numero_cuota', '>', 0)
            ->where('estado', 'Mora')
            ->sum('int_corriente_vencido');

        // Interés corriente prorrateado del mes corriente
        $tasaAnual = (float) $credit->tasa_anual;
        $diasTranscurridos = $fechaOperacion->copy()->startOfMonth()->diffInDays($fechaOperacion);
        $interesCorrienteMes = round($saldoCapital * ($tasaAnual / 100) / 365 * $diasTranscurridos, 2);

        $interesesVencidos = round($interesesMora + $interesCorrienteMes, 2);
        $saldoPendiente = round($saldoCapital + $interesesVencidos, 2);

        $penalizacion = 0;
        if ($numeroCuotaActual < 12) {
            $penalizacion = round($cuotaMensual * 3, 2);
        }

        $montoTotalCancelar = round($saldoPendiente + $penalizacion, 2);

        // Snapshot para reverso
        $cuotasAfectadas = $credit->planDePagos()
            ->where('numero_cuota', '>', 0)
            ->whereIn('estado', ['Pendiente', 'Mora'])
            ->get();

        $reversalSnapshot = [
            'type' => 'cancelacion_anticipada',
            'original_credit_saldo' => (float) $credit->saldo,
            'original_status' => $credit->status,
            'cuotas_afectadas' => $cuotasAfectadas->map(fn($c) => [
                'plan_de_pago_id' => $c->id,
                'numero_cuota' => $c->numero_cuota,
                'estado_anterior' => $c->estado,
                'fecha_pago_anterior' => $c->fecha_pago,
            ])->toArray(),
        ];

        // Registrar pago de cancelación anticipada
        $payment = CreditPayment::create([
            'credit_id'      => $credit->id,
            'numero_cuota'   => 0,
            'fecha_cuota'    => $fechaOperacion->format('Y-m-d'),
            'fecha_pago'     => $fechaOperacion->format('Y-m-d'),
            'monto'          => $montoTotalCancelar,
            'cuota'          => 0,
            'cargos'         => 0,
            'poliza'         => 0,
            'interes_corriente' => $interesesVencidos,
            'interes_moratorio' => 0,
            'amortizacion'   => $saldoCapital,
            'saldo_anterior' => $saldoPendiente,
            'nuevo_saldo'    => 0,
            'estado'         => 'Aplicado',
            'source'         => 'Cancelación Anticipada',
            'cedula'         => $credit->lead->cedula ?? null,
            'reversal_snapshot' => $reversalSnapshot,
            'estado_reverso' => 'Vigente',
        ]);

        // Marcar todas las cuotas pendientes como pagadas
        $credit->planDePagos()
            ->where('numero_cuota', '>', 0)
            ->whereIn('estado', ['Pendiente', 'Mora'])
            ->update([
                'estado' => 'Pagado',
                'fecha_pago' => $fechaOperacion->format('Y-m-d'),
                'movimiento_caja_usuario' => Auth::user()?->name ?? 'Sistema',
                'tipo_documento' => 'Cancelación Anticipada',
                'numero_documento' => "CANCEL-{$payment->id}-{$credit->reference}",
            ]);

        // Cerrar el crédito
        $credit->saldo = 0;
        $credit->status = 'Cerrado';
        $credit->cierre_motivo = 'Cancelación anticipada';
        $credit->save();

        // ── Registrar exclusión de planilla ──
        if ($credit->deductora_id) {
            $credit->load(['lead', 'deductora']);
            DeductoraChange::registrarExclusion($credit, 'Cancelación anticipada', Auth::id());
        }

        // Crear tarea para adjuntar pagaré firmado
        if ($credit->assigned_to) {
            $existingTask = Task::where('project_code', $credit->reference)
                ->where('title', 'Adjuntar pagaré firmado')
                ->whereNotIn('status', ['deleted'])
                ->first();

            if (!$existingTask) {
                Task::create([
                    'project_code' => $credit->reference,
                    'project_name' => (string) $credit->id,
                    'title' => 'Adjuntar pagaré firmado',
                    'details' => 'El crédito ha sido pagado completamente. Se requiere adjuntar el pagaré firmado por el cliente.',
                    'status' => 'pendiente',
                    'priority' => 'alta',
                    'assigned_to' => $credit->assigned_to,
                    'start_date' => now(),
                    'due_date' => now()->addDays(3),
                ]);
            }
        }

        // ACCOUNTING_API_TRIGGER: Cancelación Anticipada
        $this->triggerAccountingEntry(
            'CANCELACION_ANTICIPADA',
            $montoTotalCancelar,
            "CANCEL-{$payment->id}-{$credit->reference}",
            [
                'reference' => "CANCEL-{$payment->id}-{$credit->reference}",
                'credit_id' => $credit->reference,
                'cedula' => $credit->lead->cedula ?? null,
                'clienteNombre' => $credit->lead->name ?? null,
                'deductora_id' => $credit->deductora_id,
                'deductora_nombre' => $credit->deductora->nombre ?? null,
                'amount_breakdown' => [
                    'total' => $montoTotalCancelar,
                    'interes_corriente' => $interesesVencidos,
                    'interes_moratorio' => 0,
                    'poliza' => 0,
                    'capital' => $saldoCapital,
                    'penalizacion' => $penalizacion,
                ],
            ]
        );

        return [
            'payment' => $payment,
            'monto_total' => $montoTotalCancelar,
            'penalizacion' => $penalizacion,
            'cuota_actual' => $numeroCuotaActual,
            'aplico_penalizacion' => $numeroCuotaActual < 12,
        ];
    }
}
