<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlanillaUpload;
use App\Models\CreditPayment;
use App\Models\PlanDePago;
use App\Models\Credit;
use App\Models\SaldoPendiente;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PlanillaUploadController extends Controller
{
    /**
     * Listar historial de planillas
     */
    public function index(Request $request)
    {
        $query = PlanillaUpload::with(['deductora', 'user', 'anuladaPor'])
            ->orderBy('uploaded_at', 'desc');

        // Filtros opcionales
        if ($request->has('deductora_id')) {
            $query->where('deductora_id', $request->deductora_id);
        }
        if ($request->has('estado')) {
            $query->where('estado', $request->estado);
        }

        return response()->json($query->get());
    }

    /**
     * Detalle de una planilla
     */
    public function show($id)
    {
        $planilla = PlanillaUpload::with(['deductora', 'user', 'anuladaPor', 'creditPayments.credit.lead'])
            ->findOrFail($id);

        return response()->json($planilla);
    }

    /**
     * Anular planilla (reversar todos los movimientos)
     */
    public function anular(Request $request, $id)
    {
        // Solo administradores pueden anular
        $user = $request->user();
        if (!$user->role || (!$user->role->full_access && $user->role->name !== 'Administrador')) {
            return response()->json(['message' => 'Solo administradores pueden anular planillas'], 403);
        }

        $validated = $request->validate([
            'motivo' => 'required|string|max:500',
        ]);

        $planilla = PlanillaUpload::findOrFail($id);

        if ($planilla->estado === 'anulada') {
            return response()->json(['message' => 'La planilla ya está anulada'], 400);
        }

        DB::beginTransaction();
        try {
            // 1. Obtener todos los pagos de esta planilla
            $pagos = CreditPayment::where('planilla_upload_id', $planilla->id)->get();

            foreach ($pagos as $pago) {
                $credit = Credit::lockForUpdate()->find($pago->credit_id);

                // 2. Restaurar saldo del crédito
                if ($pago->amortizacion > 0) {
                    $credit->saldo = ((float) $credit->saldo) + ((float) $pago->amortizacion);
                }

                // 3. Restaurar status si entró en mora por esta planilla
                if ($credit->status === 'En Mora' && $pago->fecha_pago == $planilla->fecha_planilla) {
                    $credit->status = 'Formalizado';
                }
                $credit->save();

                // 4. Revertir movimientos en plan_de_pagos
                if ($pago->numero_cuota > 0) {
                    $cuota = PlanDePago::where('credit_id', $pago->credit_id)
                        ->where('numero_cuota', $pago->numero_cuota)
                        ->first();

                    if ($cuota) {
                        $cuota->movimiento_interes_moratorio = max(0, ((float) $cuota->movimiento_interes_moratorio) - ((float) $pago->interes_moratorio));
                        $cuota->movimiento_interes_corriente = max(0, ((float) $cuota->movimiento_interes_corriente) - ((float) $pago->interes_corriente));
                        $cuota->movimiento_amortizacion = max(0, ((float) $cuota->movimiento_amortizacion) - ((float) $pago->amortizacion));
                        $cuota->movimiento_poliza = max(0, ((float) $cuota->movimiento_poliza) - ((float) $pago->poliza));
                        $cuota->movimiento_total = max(0, ((float) $cuota->movimiento_total) - ((float) $pago->monto));

                        // Si todos los movimientos son 0, restaurar estado a Pendiente
                        if ($cuota->movimiento_total <= 0.01) {
                            $cuota->estado = 'Pendiente';
                            $cuota->fecha_movimiento = null;
                            $cuota->fecha_pago = null;
                        }

                        $cuota->save();
                    }
                }

                // 5. Eliminar saldos pendientes creados por esta planilla
                SaldoPendiente::where('credit_payment_id', $pago->id)->delete();

                // 6. Marcar pago como reversado
                $pago->estado = 'Reversado';
                $pago->save();
            }

            // 7. Marcar planilla como anulada
            $planilla->update([
                'estado' => 'anulada',
                'anulada_at' => now(),
                'anulada_por' => $user->id,
                'motivo_anulacion' => $validated['motivo'],
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Planilla anulada exitosamente',
                'planilla' => $planilla->fresh(['deductora', 'user', 'anuladaPor']),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error al anular planilla',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
