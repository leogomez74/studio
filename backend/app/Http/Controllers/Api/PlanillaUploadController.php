<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlanillaUpload;
use App\Models\CreditPayment;
use App\Models\PlanDePago;
use App\Models\Credit;
use App\Models\SaldoPendiente;
use App\Traits\AccountingTrigger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PlanillaUploadController extends Controller
{
    use AccountingTrigger;
    /**
     * Listar historial de planillas con paginación y filtros
     */
    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 15); // Por defecto 15 por página

        $query = PlanillaUpload::with(['deductora', 'user', 'anuladaPor'])
            ->orderBy('uploaded_at', 'desc');

        // Filtro por deductora
        if ($request->has('deductora_id') && $request->deductora_id) {
            $query->where('deductora_id', $request->deductora_id);
        }

        // Filtro por estado
        if ($request->has('estado') && $request->estado) {
            $query->where('estado', $request->estado);
        }

        // Filtro por rango de fechas
        if ($request->has('fecha_desde')) {
            $query->whereDate('fecha_planilla', '>=', $request->fecha_desde);
        }
        if ($request->has('fecha_hasta')) {
            $query->whereDate('fecha_planilla', '<=', $request->fecha_hasta);
        }

        // Filtro por usuario que cargó
        if ($request->has('user_id') && $request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        // Búsqueda global: ID, nombre de archivo, o usuario
        if ($request->has('search') && $request->search) {
            $searchTerm = $request->search;
            $query->where(function($q) use ($searchTerm) {
                $q->where('id', 'like', '%' . $searchTerm . '%')
                  ->orWhere('nombre_archivo', 'like', '%' . $searchTerm . '%')
                  ->orWhereHas('user', function($userQuery) use ($searchTerm) {
                      $userQuery->where('name', 'like', '%' . $searchTerm . '%');
                  });
            });
        }

        return response()->json($query->paginate($perPage));
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

                // 6. Marcar pago como anulado (visible en historial de abonos)
                $pago->estado = 'Reversado';
                $pago->estado_reverso = 'Anulado';
                $pago->motivo_anulacion = $validated['motivo'];
                $pago->anulado_por = $user->id;
                $pago->fecha_anulacion = now();
                $pago->save();

                // ============================================================
                // ACCOUNTING_API_TRIGGER: Devolución/Anulación de Pago
                // ============================================================
                // Dispara asiento contable al revertir un pago:
                // DÉBITO: Cuentas por Cobrar (monto del pago revertido)
                // CRÉDITO: Banco CREDIPEP (monto del pago revertido)
                $this->triggerAccountingEntry(
                    'ANULACION_PLANILLA',
                    (float) $pago->monto,
                    "ANULA-PLAN-{$pago->id}-{$credit->reference}",
                    [
                        'reference' => "ANULA-PLAN-{$pago->id}-{$credit->reference}",
                        'credit_id' => $credit->reference,
                        'cedula' => $pago->cedula,
                        'clienteNombre' => $credit->lead->name ?? null,
                        'motivo' => $validated['motivo'],
                        'deductora_id' => $planilla->deductora_id,
                        'fecha_planilla' => $planilla->fecha_planilla,
                        'amount_breakdown' => [
                            'total' => (float) $pago->monto,
                            'interes_corriente' => (float) $pago->interes_corriente,
                            'interes_moratorio' => (float) $pago->interes_moratorio,
                            'poliza' => 0,
                            'capital' => (float) $pago->amortizacion,
                            'cargos_adicionales_total' => 0,
                            'cargos_adicionales' => [],
                        ],
                    ]
                );
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

    /**
     * Descargar archivo de planilla
     */
    public function download($id)
    {
        $planilla = PlanillaUpload::findOrFail($id);

        if (!$planilla->ruta_archivo) {
            return response()->json([
                'message' => 'El archivo no está disponible'
            ], 404);
        }

        $filePath = storage_path('app/public/' . $planilla->ruta_archivo);

        if (!file_exists($filePath)) {
            return response()->json([
                'message' => 'El archivo no se encontró en el servidor'
            ], 404);
        }

        return response()->download($filePath, $planilla->nombre_archivo);
    }
}
