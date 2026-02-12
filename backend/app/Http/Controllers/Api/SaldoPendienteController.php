<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\CreditPaymentController;
use App\Models\SaldoPendiente;
use App\Models\Credit;
use App\Models\CreditPayment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
            $cedula = $saldo->cedula ?? ($person->cedula ?? '');
            $deductoraId = $saldo->credit->deductora_id;

            // Buscar TODOS los créditos de esta cédula + deductora para distribuciones
            $allCredits = Credit::where('deductora_id', $deductoraId)
                ->whereIn('status', ['Formalizado', 'En Mora'])
                ->whereHas('lead', function($q) use ($cedula) {
                    $q->where('cedula', $cedula);
                })
                ->orderBy('formalized_at', 'asc')
                ->get();

            $distribuciones = $allCredits->map(function ($credit) use ($saldo) {
                $cuotaAmount = (float) $credit->cuota;
                $montoSobrante = (float) $saldo->monto;
                $maxCuotas = $cuotaAmount > 0 ? (int) floor($montoSobrante / $cuotaAmount) : 0;
                $restante = $cuotaAmount > 0 ? round($montoSobrante - ($maxCuotas * $cuotaAmount), 2) : $montoSobrante;
                return [
                    'credit_id' => $credit->id,
                    'reference' => $credit->reference ?? $credit->numero_operacion,
                    'cuota' => $cuotaAmount,
                    'max_cuotas' => $maxCuotas,
                    'restante' => $restante,
                    'saldo_credito' => (float) $credit->saldo,
                ];
            })->values()->all();

            return [
                'id' => $saldo->id,
                'credit_id' => $saldo->credit_id,
                'lead_id' => $saldo->credit->lead_id ?? null,
                'person_type_id' => $person->person_type_id ?? null,
                'credit_reference' => $saldo->credit->reference ?? '',
                'lead_name' => $person
                    ? ($person->name . ' ' . ($person->apellido1 ?? ''))
                    : 'N/A',
                'cedula' => $cedula,
                'deductora' => $saldo->credit->deductora->nombre ?? 'N/A',
                'monto' => (float) $saldo->monto,
                'origen' => $saldo->origen,
                'fecha_origen' => $saldo->fecha_origen?->format('Y-m-d'),
                'estado' => $saldo->estado,
                'notas' => $saldo->notas,
                'saldo_credito' => (float) $saldo->credit->saldo,
                'distribuciones' => $distribuciones,
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
            'credit_id' => 'nullable|exists:credits,id',
            'monto' => 'nullable|numeric|min:0.01',
        ]);

        // Solo administradores pueden aplicar saldos
        $user = $request->user();
        if (!$user->role || (!$user->role->full_access && $user->role->name !== 'Administrador')) {
            return response()->json(['message' => 'Solo administradores pueden aplicar saldos'], 403);
        }

        $saldo = SaldoPendiente::where('estado', 'pendiente')->findOrFail($id);
        $targetCreditId = $validated['credit_id'] ?? $saldo->credit_id;
        $credit = Credit::findOrFail($targetCreditId);
        $accion = $validated['accion'];

        // Monto a aplicar: parcial o total
        $montoAplicar = isset($validated['monto'])
            ? min((float) $validated['monto'], (float) $saldo->monto)
            : (float) $saldo->monto;

        $preview = [
            'saldo_id' => $saldo->id,
            'monto_disponible' => (float) $saldo->monto,
            'monto_a_aplicar' => $montoAplicar,
            'accion' => $accion,
            'credit' => [
                'id' => $credit->id,
                'reference' => $credit->reference,
                'numero_operacion' => $credit->numero_operacion,
                'saldo_actual' => (float) $credit->saldo,
            ],
        ];

        if ($accion === 'cuota') {
            $cuota = $credit->planDePagos()
                ->where('numero_cuota', '>', 0)
                ->whereIn('estado', ['Pendiente', 'Parcial', 'Mora'])
                ->orderBy('numero_cuota')
                ->first();

            if (!$cuota) {
                return response()->json(['message' => 'No hay cuotas pendientes'], 400);
            }

            $dinero = $montoAplicar;
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
            $preview['restante_saldo'] = (float) $saldo->monto - $montoAplicar;
            $preview['excedente'] = $dinero;

        } else {
            // Aplicar a capital
            $capitalAplicar = min($montoAplicar, (float) $credit->saldo);

            $preview['destino'] = 'Abono a Capital';
            $preview['distribucion'] = [
                'amortizacion' => $capitalAplicar,
            ];
            $preview['saldo_nuevo_credit'] = max(0, (float) $credit->saldo - $capitalAplicar);
            $preview['restante_saldo'] = (float) $saldo->monto - $capitalAplicar;
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
            'credit_id' => 'nullable|exists:credits,id',
            'monto' => 'nullable|numeric|min:0.01',
            'notas' => 'nullable|string|max:500',
        ]);

        $saldo = SaldoPendiente::where('estado', 'pendiente')->findOrFail($id);
        $accion = $validated['accion'];

        // Permitir aplicar a un crédito diferente (de la misma cédula)
        $targetCreditId = $validated['credit_id'] ?? $saldo->credit_id;
        // Permitir aplicar un monto parcial del sobrante
        $montoAplicar = isset($validated['monto'])
            ? min((float) $validated['monto'], (float) $saldo->monto)
            : (float) $saldo->monto;

        return DB::transaction(function () use ($saldo, $accion, $validated, $targetCreditId, $montoAplicar) {
            $credit = Credit::lockForUpdate()->findOrFail($targetCreditId);

            if ($accion === 'cuota') {
                // Aplicar como pago a la siguiente cuota pendiente
                $controller = new CreditPaymentController();
                $payment = $controller->processPaymentTransactionPublic(
                    $credit,
                    $montoAplicar,
                    now(),
                    'Saldo Pendiente',
                    $saldo->cedula
                );

                // Calcular restante del saldo
                $restante = (float) $saldo->monto - $montoAplicar;

                if ($restante > 0.50) {
                    // Queda saldo pendiente: actualizar monto
                    $saldo->monto = $restante;
                    $saldo->notas = ($saldo->notas ? $saldo->notas . ' | ' : '') .
                        sprintf('Cuota #%d aplicada (₡%s) a %s', $payment->numero_cuota, number_format($montoAplicar, 2), $credit->reference);
                    $saldo->save();
                } else {
                    // Todo consumido
                    $saldo->estado = 'asignado_cuota';
                    $saldo->asignado_at = now();
                    $saldo->notas = $validated['notas'] ?? 'Aplicado a cuota #' . $payment->numero_cuota . ' de ' . $credit->reference;
                    $saldo->save();
                }

                return response()->json([
                    'message' => 'Saldo aplicado a cuota exitosamente',
                    'saldo' => $saldo->fresh(),
                    'payment' => $payment,
                    'nuevo_saldo_credito' => (float) $credit->fresh()->saldo,
                    'restante' => $restante > 0.50 ? $restante : 0,
                ]);

            } else {
                // Aplicar a capital: reduce saldo directamente
                $saldoAnterior = (float) $credit->saldo;
                $montoCapital = min($montoAplicar, $saldoAnterior);
                $credit->saldo = max(0, $saldoAnterior - $montoCapital);
                $credit->save();

                // Registrar como un CreditPayment de tipo "Abono a Capital"
                $payment = CreditPayment::create([
                    'credit_id' => $credit->id,
                    'numero_cuota' => 0,
                    'fecha_pago' => now(),
                    'monto' => $montoCapital,
                    'cuota' => 0,
                    'saldo_anterior' => $saldoAnterior,
                    'nuevo_saldo' => $credit->saldo,
                    'estado' => 'Aplicado',
                    'amortizacion' => $montoCapital,
                    'source' => 'Abono a Capital',
                    'cedula' => $saldo->cedula,
                    'movimiento_total' => 0,
                    'movimiento_amortizacion' => $montoCapital,
                ]);

                // Calcular restante del saldo
                $restante = (float) $saldo->monto - $montoCapital;

                if ($restante > 0.50) {
                    $saldo->monto = $restante;
                    $saldo->notas = ($saldo->notas ? $saldo->notas . ' | ' : '') .
                        sprintf('Capital ₡%s aplicado a %s', number_format($montoCapital, 2), $credit->reference);
                    $saldo->save();
                } else {
                    $saldo->estado = 'asignado_capital';
                    $saldo->asignado_at = now();
                    $saldo->notas = $validated['notas'] ?? sprintf(
                        'Abono a capital: ₡%s → Saldo anterior: ₡%s → Nuevo saldo: ₡%s (%s)',
                        number_format($montoCapital, 2),
                        number_format($saldoAnterior, 2),
                        number_format($credit->saldo, 2),
                        $credit->reference
                    );
                    $saldo->save();
                }

                return response()->json([
                    'message' => 'Saldo aplicado a capital exitosamente.',
                    'saldo' => $saldo->fresh(),
                    'payment' => $payment,
                    'saldo_anterior' => $saldoAnterior,
                    'nuevo_saldo_credito' => (float) $credit->saldo,
                    'capital_reducido' => $montoCapital,
                    'restante' => $restante > 0.50 ? $restante : 0,
                ]);
            }
        });
    }
}
