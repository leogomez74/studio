<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SaldoPendiente;
use App\Models\Credit;
use App\Models\PlanDePago;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class SaldoPendienteController extends Controller
{
    /**
     * Listar saldos pendientes (sobrantes de planilla sin asignar)
     */
    public function index(Request $request)
    {
        $query = SaldoPendiente::with(['credit.lead', 'credit.deductora'])
            ->orderBy('created_at', 'desc');

        if ($request->has('estado')) {
            $query->where('estado', $request->estado);
        } else {
            $query->where('estado', 'pendiente');
        }

        // Filtro por deductora
        if ($request->has('deductora_id')) {
            $query->whereHas('credit', function ($q) use ($request) {
                $q->where('deductora_id', $request->deductora_id);
            });
        }

        // Filtro por rango de fechas
        if ($request->has('fecha_desde')) {
            $query->where('fecha_origen', '>=', $request->fecha_desde);
        }
        if ($request->has('fecha_hasta')) {
            $query->where('fecha_origen', '<=', $request->fecha_hasta);
        }

        // Búsqueda global: cédula, nombre de cliente, referencia de crédito
        if ($request->has('search') && $request->search) {
            $searchTerm = $request->search;
            $query->where(function($q) use ($searchTerm) {
                $q->where('cedula', 'like', '%' . $searchTerm . '%')
                  ->orWhereHas('credit', function($creditQuery) use ($searchTerm) {
                      $creditQuery->where('reference', 'like', '%' . $searchTerm . '%')
                          ->orWhereHas('lead', function($leadQuery) use ($searchTerm) {
                              $leadQuery->where('name', 'like', '%' . $searchTerm . '%')
                                  ->orWhere('apellido1', 'like', '%' . $searchTerm . '%');
                          });
                  });
            });
        }

        // Paginación
        $perPage = $request->get('per_page', 10);
        $page = $request->get('page', 1);

        $saldos = $query->paginate($perPage, ['*'], 'page', $page);

        $mapped = $saldos->getCollection()->map(function ($saldo) {
            $person = $saldo->credit->lead;
            return [
                'id' => $saldo->id,
                'credit_id' => $saldo->credit_id,
                'lead_id' => $saldo->credit->lead_id ?? null,
                'person_type_id' => $person->person_type_id ?? null,
                'credit_reference' => $saldo->credit->reference ?? '',
                'lead_name' => $person
                    ? ($person->name . ' ' . ($person->apellido1 ?? ''))
                    : 'N/A',
                'cedula' => $saldo->cedula ?? ($person->cedula ?? ''),
                'deductora' => $saldo->credit->deductora->nombre ?? 'N/A',
                'monto' => (float) $saldo->monto,
                'origen' => $saldo->origen,
                'fecha_origen' => $saldo->fecha_origen?->format('Y-m-d'),
                'estado' => $saldo->estado,
                'notas' => $saldo->notas,
                'saldo_credito' => (float) $saldo->credit->saldo,
            ];
        });

        return response()->json([
            'data' => $mapped,
            'total' => $saldos->total(),
            'per_page' => $saldos->perPage(),
            'current_page' => $saldos->currentPage(),
            'last_page' => $saldos->lastPage(),
        ]);
    }

    /**
     * Preview de asignación: muestra cómo se aplicará el saldo sin ejecutar
     */
    public function previewAsignacion(Request $request, int $id)
    {
        $validated = $request->validate([
            'accion' => 'required|in:cuota,capital',
        ]);

        // Solo administradores pueden aplicar saldos
        $user = $request->user();
        if (!$user->role || (!$user->role->full_access && $user->role->name !== 'Administrador')) {
            return response()->json(['message' => 'Solo administradores pueden aplicar saldos'], 403);
        }

        $saldo = SaldoPendiente::where('estado', 'pendiente')->findOrFail($id);
        $credit = $saldo->credit;
        $accion = $validated['accion'];

        $preview = [
            'saldo_id' => $saldo->id,
            'monto_disponible' => (float) $saldo->monto,
            'accion' => $accion,
            'credit' => [
                'id' => $credit->id,
                'numero_operacion' => $credit->numero_operacion,
                'saldo_actual' => (float) $credit->saldo,
            ],
        ];

        if ($accion === 'cuota') {
            // Simular cascada: interes_moratorio → interes_corriente → poliza → amortizacion
            $cuota = $credit->planDePagos()
                ->where('numero_cuota', '>', 0)
                ->where('estado', 'Pendiente')
                ->orderBy('numero_cuota')
                ->first();

            if (!$cuota) {
                return response()->json(['message' => 'No hay cuotas pendientes'], 400);
            }

            $dinero = (float) $saldo->monto;
            $aplicado = [
                'interes_moratorio' => 0,
                'interes_corriente' => 0,
                'poliza' => 0,
                'amortizacion' => 0,
            ];

            // Cascada waterfall
            $pendienteMora = max(0, ((float) $cuota->interes_moratorio) - ((float) $cuota->movimiento_interes_moratorio ?? 0));
            if ($dinero > 0 && $pendienteMora > 0) {
                $aplicado['interes_moratorio'] = min($dinero, $pendienteMora);
                $dinero -= $aplicado['interes_moratorio'];
            }

            $pendienteInteres = max(0, ((float) $cuota->interes_corriente) - ((float) $cuota->movimiento_interes_corriente ?? 0));
            if ($dinero > 0 && $pendienteInteres > 0) {
                $aplicado['interes_corriente'] = min($dinero, $pendienteInteres);
                $dinero -= $aplicado['interes_corriente'];
            }

            $pendientePoliza = max(0, ((float) $cuota->poliza) - ((float) $cuota->movimiento_poliza ?? 0));
            if ($dinero > 0 && $pendientePoliza > 0) {
                $aplicado['poliza'] = min($dinero, $pendientePoliza);
                $dinero -= $aplicado['poliza'];
            }

            $pendienteAmortizacion = max(0, ((float) $cuota->amortizacion) - ((float) $cuota->movimiento_amortizacion ?? 0));
            if ($dinero > 0 && $pendienteAmortizacion > 0) {
                $aplicado['amortizacion'] = min($dinero, $pendienteAmortizacion);
                $dinero -= $aplicado['amortizacion'];
            }

            $preview['destino'] = 'Cuota #' . $cuota->numero_cuota;
            $preview['distribucion'] = $aplicado;
            $preview['saldo_nuevo_credit'] = (float) $credit->saldo - $aplicado['amortizacion'];
            $preview['excedente'] = $dinero;

        } else {
            // Aplicar a capital
            $montoAplicar = min((float) $saldo->monto, (float) $credit->saldo);

            $preview['destino'] = 'Abono a Capital';
            $preview['distribucion'] = [
                'amortizacion' => $montoAplicar,
            ];
            $preview['saldo_nuevo_credit'] = max(0, (float) $credit->saldo - $montoAplicar);
            $preview['excedente'] = (float) $saldo->monto - $montoAplicar;
        }

        return response()->json($preview);
    }

    /**
     * Asignar un saldo pendiente: aplicar a cuota o aplicar a capital
     */
    public function asignar(Request $request, int $id)
    {
        // Solo administradores pueden aplicar saldos
        $user = $request->user();
        if (!$user->role || (!$user->role->full_access && $user->role->name !== 'Administrador')) {
            return response()->json(['message' => 'Solo administradores pueden aplicar saldos'], 403);
        }

        $validated = $request->validate([
            'accion' => 'required|in:cuota,capital',
            'notas' => 'nullable|string|max:500',
        ]);

        $saldo = SaldoPendiente::where('estado', 'pendiente')->findOrFail($id);
        $accion = $validated['accion'];

        return DB::transaction(function () use ($saldo, $accion, $validated) {
            $credit = Credit::lockForUpdate()->findOrFail($saldo->credit_id);

            if ($accion === 'cuota') {
                // Aplicar como pago a la siguiente cuota pendiente
                $controller = new CreditPaymentController();
                $payment = $controller->processPaymentTransactionPublic(
                    $credit,
                    (float) $saldo->monto,
                    now(),
                    'Saldo Pendiente',
                    $saldo->cedula
                );

                $saldo->estado = 'asignado_cuota';
                $saldo->asignado_at = now();
                $saldo->notas = $validated['notas'] ?? 'Aplicado a cuota #' . $payment->numero_cuota;
                $saldo->save();

                return response()->json([
                    'message' => 'Saldo aplicado a cuota exitosamente',
                    'saldo' => $saldo,
                    'payment' => $payment,
                    'nuevo_saldo_credito' => (float) $credit->fresh()->saldo,
                ]);

            } else {
                // Aplicar a capital: reduce saldo directamente
                $saldoAnterior = (float) $credit->saldo;
                $montoAplicar = min((float) $saldo->monto, $saldoAnterior);
                $credit->saldo = max(0, $saldoAnterior - $montoAplicar);
                $credit->save();

                // Registrar como un CreditPayment de tipo "Abono a Capital"
                $payment = \App\Models\CreditPayment::create([
                    'credit_id' => $credit->id,
                    'numero_cuota' => 0,
                    'fecha_pago' => now(),
                    'monto' => $montoAplicar,
                    'cuota' => 0,
                    'saldo_anterior' => $saldoAnterior,
                    'nuevo_saldo' => $credit->saldo,
                    'estado' => 'Aplicado',
                    'amortizacion' => $montoAplicar,
                    'source' => 'Abono a Capital',
                    'cedula' => $saldo->cedula,
                    'movimiento_total' => 0,
                    'movimiento_amortizacion' => $montoAplicar,
                ]);

                $saldo->estado = 'asignado_capital';
                $saldo->asignado_at = now();
                $saldo->notas = $validated['notas'] ?? sprintf(
                    'Abono a capital: ₡%s → Saldo anterior: ₡%s → Nuevo saldo: ₡%s',
                    number_format($montoAplicar, 2),
                    number_format($saldoAnterior, 2),
                    number_format($credit->saldo, 2)
                );
                $saldo->save();

                return response()->json([
                    'message' => 'Saldo aplicado a capital exitosamente. Los intereses corrientes se reducirán en la siguiente cuota.',
                    'saldo' => $saldo,
                    'payment' => $payment,
                    'saldo_anterior' => $saldoAnterior,
                    'nuevo_saldo_credito' => (float) $credit->saldo,
                    'capital_reducido' => $montoAplicar,
                ]);
            }
        });
    }
}
