<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AbonoService;
use App\Services\PaymentProcessingService;
use App\Models\SaldoPendiente;
use App\Models\Credit;
use App\Models\CreditPayment;
use App\Models\PlanDePago;
use App\Traits\AccountingTrigger;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SaldoPendienteController extends Controller
{
    use AccountingTrigger;
    use LogsActivity;
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

        // Filtro exacto por cédula (usado por detalle de crédito)
        if ($request->has('cedula') && $request->cedula) {
            $query->where('cedula', $request->cedula);
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

        // Excluir registros huérfanos (crédito o lead eliminado)
        $query->whereHas('credit', function ($q) {
            $q->whereHas('lead');
        });

        // Paginación
        $perPage = $request->get('per_page', 10);
        $page = $request->get('page', 1);

        $saldos = $query->paginate($perPage, ['*'], 'page', $page);

        // Pre-cargar créditos y primeras cuotas en bulk para evitar N+1
        $collection = $saldos->getCollection();

        $cedulas = $collection->map(fn($s) => $s->cedula ?? $s->credit->lead?->cedula ?? '')->filter()->unique()->values()->all();
        $deductoraIds = $collection->map(fn($s) => $s->credit->deductora_id)->filter()->unique()->values()->all();

        $creditosBulk = Credit::whereIn('deductora_id', $deductoraIds)
            ->whereIn('status', ['Formalizado', 'En Mora'])
            ->whereHas('lead', fn($q) => $q->whereIn('cedula', $cedulas))
            ->with(['lead:id,cedula,person_type_id'])
            ->orderBy('formalized_at', 'asc')
            ->get()
            ->groupBy(fn($c) => ($c->lead->cedula ?? '') . '-' . $c->deductora_id);

        $creditIds = $creditosBulk->flatten()->pluck('id');

        $primerasCuotas = PlanDePago::whereIn('credit_id', $creditIds)
            ->where('numero_cuota', '>', 0)
            ->where('estado', 'Pendiente')
            ->orderBy('numero_cuota')
            ->get()
            ->groupBy('credit_id')
            ->map(fn($cuotas) => $cuotas->first());

        $mapped = $collection->map(function ($saldo) use ($creditosBulk, $primerasCuotas) {
            $person = $saldo->credit->lead;
            $cedula = $saldo->cedula ?? ($person->cedula ?? '');
            $deductoraId = $saldo->credit->deductora_id;

            $allCredits = $creditosBulk->get($cedula . '-' . $deductoraId, collect());

            $distribuciones = $allCredits->map(function ($credit) use ($saldo, $primerasCuotas) {
                $cuotaAmount = (float) $credit->cuota;
                $montoSobrante = (float) $saldo->monto;
                $maxCuotas = $cuotaAmount > 0 ? (int) floor($montoSobrante / $cuotaAmount) : 0;
                $restante = $cuotaAmount > 0 ? round($montoSobrante - ($maxCuotas * $cuotaAmount), 2) : $montoSobrante;

                $esParcial = false;
                if ($restante > 1) {
                    $cuota = $primerasCuotas->get($credit->id);

                    if ($cuota) {
                        $pendienteMora = max(0, ((float) $cuota->interes_moratorio) - ((float) $cuota->movimiento_interes_moratorio ?? 0));
                        $pendienteInteres = max(0, ((float) $cuota->interes_corriente) - ((float) $cuota->movimiento_interes_corriente ?? 0));
                        $pendientePoliza = max(0, ((float) $cuota->poliza) - ((float) $cuota->movimiento_poliza ?? 0));
                        $pendienteAmortizacion = max(0, ((float) $cuota->amortizacion) - ((float) $cuota->movimiento_amortizacion ?? 0));

                        $totalPendienteCuota = $pendienteMora + $pendienteInteres + $pendientePoliza + $pendienteAmortizacion;

                        $esParcial = ($restante < $totalPendienteCuota - 0.01);
                    }
                }

                return [
                    'credit_id' => $credit->id,
                    'reference' => $credit->reference ?? $credit->numero_operacion,
                    'cuota' => $cuotaAmount,
                    'max_cuotas' => $maxCuotas,
                    'restante' => $restante,
                    'saldo_credito' => (float) $credit->saldo,
                    'es_parcial' => $esParcial,
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
            'capital_strategy' => 'nullable|in:reduce_amount,reduce_term',
        ]);

        $user = $request->user();
        $perms = $user->role?->getFormattedPermissions() ?? [];
        $esCapital = ($validated['accion'] === 'capital');
        $permKey  = $esCapital ? 'formalizar_admin' : 'formalizar';
        $puedeAplicar = $user->role?->full_access || ($perms['cobros'][$permKey] ?? false);
        if (!$puedeAplicar) {
            $label = $esCapital ? 'aplicar abonos a capital' : 'aplicar saldos parciales';
            return response()->json(['message' => "No tienes permiso para {$label}"], 403);
        }

        $saldo = SaldoPendiente::where('estado', 'pendiente')->find($id);
        if (!$saldo) {
            return response()->json([
                'message' => 'Este saldo ya no está disponible. Puede haber sido aplicado o eliminado.',
                'reload' => true
            ], 404);
        }
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

            // Calcular si la cuota quedó completa o parcial
            $totalPendienteCuota = $pendienteMora + $pendienteInteres + $pendientePoliza + $pendienteAmortizacion;
            $totalAplicado = $aplicado['interes_moratorio'] + $aplicado['interes_corriente'] + $aplicado['poliza'] + $aplicado['amortizacion'];
            $cuotaCompleta = ($totalAplicado >= $totalPendienteCuota - 0.01); // Tolerancia de 1 centavo

            $preview['destino'] = 'Cuota #' . $cuota->numero_cuota;
            $preview['distribucion'] = $aplicado;
            $preview['saldo_nuevo_credit'] = (float) $credit->saldo - $aplicado['amortizacion'];
            $preview['restante_saldo'] = (float) $saldo->monto - $montoAplicar;
            $preview['excedente'] = $dinero;
            $preview['cuota_completa'] = $cuotaCompleta;
            $preview['total_pendiente_cuota'] = $totalPendienteCuota;
            $preview['total_aplicado'] = $totalAplicado;

        } else {
            // Aplicar a capital con estrategia
            $strategy = $validated['capital_strategy'] ?? 'reduce_amount';
            $capitalAplicar = min($montoAplicar, (float) $credit->saldo);
            $nuevoCapital = max(0, (float) $credit->saldo - $capitalAplicar);

            // Buscar primera cuota no pagada
            $siguienteCuota = $credit->planDePagos()
                ->where('estado', '!=', 'Pagado')
                ->where('cuota', '>', 0)
                ->orderBy('numero_cuota', 'asc')
                ->first();

            $numeroCuotaInicio = $siguienteCuota ? $siguienteCuota->numero_cuota : 1;
            $tasaAnual = (float) $credit->tasa_anual;
            $tasaMensual = ($tasaAnual / 100) / 12;

            $preview['destino'] = 'Abono a Capital';
            $preview['distribucion'] = [
                'amortizacion' => $capitalAplicar,
            ];
            $preview['saldo_nuevo_credit'] = $nuevoCapital;
            $preview['restante_saldo'] = (float) $saldo->monto - $capitalAplicar;
            $preview['estrategia'] = $strategy;
            $preview['saldo_actual'] = (float) $credit->saldo;
            $preview['cuota_actual'] = (float) $credit->cuota;
            $preview['plazo_actual'] = (int) $credit->plazo;

            if ($nuevoCapital > 0 && $siguienteCuota) {
                if ($strategy === 'reduce_amount') {
                    // Calcular nueva cuota (mantiene plazo)
                    $cuotasRestantes = $credit->plazo - $numeroCuotaInicio + 1;
                    if ($cuotasRestantes < 1) $cuotasRestantes = 1;

                    if ($tasaMensual > 0) {
                        $potencia = pow(1 + $tasaMensual, $cuotasRestantes);
                        $nuevaCuota = $nuevoCapital * ($tasaMensual * $potencia) / ($potencia - 1);
                    } else {
                        $nuevaCuota = $nuevoCapital / $cuotasRestantes;
                    }
                    $nuevaCuota = round($nuevaCuota, 2);

                    $preview['nueva_cuota'] = $nuevaCuota;
                    $preview['nuevo_plazo'] = (int) $credit->plazo;
                    $preview['cuotas_restantes'] = $cuotasRestantes;

                } elseif ($strategy === 'reduce_term') {
                    // Calcular nuevo plazo (mantiene cuota)
                    $cuotaFija = (float) $credit->cuota;
                    $saldo = $nuevoCapital;
                    $contadorCuotas = 0;
                    $maxLoops = 360;

                    while ($saldo > 0.01 && $contadorCuotas < $maxLoops) {
                        $interes = round($saldo * $tasaMensual, 2);
                        $amortizacion = $cuotaFija - $interes;

                        if ($amortizacion <= 0 || $saldo <= $amortizacion) {
                            $contadorCuotas++;
                            break;
                        }

                        $saldo = round($saldo - $amortizacion, 2);
                        $contadorCuotas++;
                    }

                    $nuevoPlazo = $numeroCuotaInicio + $contadorCuotas - 1;

                    $preview['nueva_cuota'] = $cuotaFija;
                    $preview['nuevo_plazo'] = $nuevoPlazo;
                    $preview['cuotas_restantes'] = $contadorCuotas;
                }
            } else {
                // Crédito se finalizaría
                $preview['nueva_cuota'] = 0;
                $preview['nuevo_plazo'] = 0;
                $preview['cuotas_restantes'] = 0;
                $preview['finalizado'] = true;
            }
        }

        return response()->json($preview);
    }

    /**
     * Asignar un saldo pendiente: aplicar a cuota o aplicar a capital
     */
    public function asignar(Request $request, int $id)
    {
        $user = $request->user();

        $validated = $request->validate([
            'accion' => 'required|in:cuota,capital',
            'credit_id' => 'nullable|exists:credits,id',
            'monto' => 'nullable|numeric|min:0.01',
            'notas' => 'nullable|string|max:500',
            'capital_strategy' => 'nullable|required_if:accion,capital|in:reduce_amount,reduce_term',
        ]);

        $perms    = $user->role?->getFormattedPermissions() ?? [];
        $esCapital = ($validated['accion'] === 'capital');
        $permKey  = $esCapital ? 'formalizar_admin' : 'formalizar';
        $puedeAplicar = $user->role?->full_access || ($perms['cobros'][$permKey] ?? false);
        if (!$puedeAplicar) {
            $label = $esCapital ? 'aplicar abonos a capital' : 'aplicar saldos parciales';
            return response()->json(['message' => "No tienes permiso para {$label}"], 403);
        }

        $saldo = SaldoPendiente::where('estado', 'pendiente')->find($id);
        if (!$saldo) {
            return response()->json([
                'message' => 'Este saldo ya no está disponible. Puede haber sido aplicado o eliminado.',
                'reload' => true
            ], 404);
        }
        $accion = $validated['accion'];

        // Permitir aplicar a un crédito diferente (de la misma cédula)
        $targetCreditId = $validated['credit_id'] ?? $saldo->credit_id;
        // Permitir aplicar un monto parcial del sobrante
        $montoAplicar = isset($validated['monto'])
            ? min((float) $validated['monto'], (float) $saldo->monto)
            : (float) $saldo->monto;

        return DB::transaction(function () use ($saldo, $accion, $validated, $targetCreditId, $montoAplicar, $request) {
            $credit = Credit::lockForUpdate()->findOrFail($targetCreditId);

            if ($accion === 'cuota') {
                // Aplicar como pago a la siguiente cuota pendiente
                $paymentService = app(PaymentProcessingService::class);
                $payment = $paymentService->processPaymentTransactionPublic(
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

                // Nota: El trigger contable ya se disparó en processPaymentTransactionPublic
                // No se necesita trigger adicional aquí

                $this->logActivity('update', 'Saldo Pendiente', $saldo, 'Saldo #' . $saldo->id . ' → ' . ($credit->reference ?? $targetCreditId) . ' (cuota)', [], $request);

                return response()->json([
                    'message' => 'Saldo aplicado a cuota exitosamente',
                    'saldo' => $saldo->fresh(),
                    'payment' => $payment,
                    'nuevo_saldo_credito' => (float) $credit->fresh()->saldo,
                    'restante' => $restante > 0.50 ? $restante : 0,
                ]);

            } else {
                // Aplicar a capital con regeneración de plan
                $strategy = $validated['capital_strategy'] ?? 'reduce_amount';
                $saldoAnterior = (float) $credit->saldo;
                $montoCapital = min($montoAplicar, $saldoAnterior);

                // Usar la lógica de abono extraordinario del AbonoService
                $abonoService = app(AbonoService::class);
                $payment = $abonoService->procesarAbonoCapitalConEstrategia(
                    $credit,
                    $montoCapital,
                    now(),
                    $strategy,
                    'Abono a Capital (Saldo Pendiente)',
                    $saldo->cedula
                );

                // Calcular restante del saldo
                $restante = (float) $saldo->monto - $montoCapital;

                if ($restante > 0.50) {
                    $saldo->monto = $restante;
                    $saldo->notas = ($saldo->notas ? $saldo->notas . ' | ' : '') .
                        sprintf('Capital ₡%s aplicado a %s (Estrategia: %s)',
                            number_format($montoCapital, 2),
                            $credit->reference,
                            $strategy === 'reduce_amount' ? 'Reducir cuota' : 'Reducir plazo'
                        );
                    $saldo->save();
                } else {
                    $saldo->estado = 'asignado_capital';
                    $saldo->asignado_at = now();
                    $saldo->notas = $validated['notas'] ?? sprintf(
                        'Abono a capital: ₡%s → %s (%s)',
                        number_format($montoCapital, 2),
                        $strategy === 'reduce_amount' ? 'Cuota reducida' : 'Plazo reducido',
                        $credit->reference
                    );
                    $saldo->save();
                }

                $creditRefresh = Credit::find($credit->id);

                // ============================================================
                // ACCOUNTING_API_TRIGGER: Abono a Capital (Saldo Pendiente)
                // ============================================================
                // Dispara asiento contable al aplicar saldo pendiente a capital:
                // DÉBITO: Banco CREDIPEP (monto_aplicar)
                // CRÉDITO: Cuentas por Cobrar (monto_aplicar)
                $this->triggerAccountingEntry(
                    'ABONO_CAPITAL',
                    $montoCapital,
                    "CAPITAL-{$payment->id}-{$credit->reference}",
                    [
                        'reference' => "CAPITAL-{$payment->id}-{$credit->reference}",
                        'credit_id' => $credit->reference,
                        'cedula' => $saldo->cedula,
                        'clienteNombre' => $credit->lead->name ?? null,
                        'origen' => 'Saldo Pendiente',
                        'amount_breakdown' => [
                            'total' => $montoCapital,
                            'interes_corriente' => 0,
                            'interes_moratorio' => 0,
                            'poliza' => 0,
                            'capital' => $montoCapital,
                            'cargos_adicionales_total' => 0,
                            'cargos_adicionales' => [],
                        ],
                    ]
                );

                $this->logActivity('update', 'Saldo Pendiente', $saldo, 'Saldo #' . $saldo->id . ' → ' . ($credit->reference ?? $targetCreditId) . ' (capital)', [], $request);

                return response()->json([
                    'message' => 'Saldo aplicado a capital con regeneración exitosa.',
                    'saldo' => $saldo->fresh(),
                    'payment' => $payment,
                    'saldo_anterior' => $saldoAnterior,
                    'nuevo_saldo_credito' => (float) $creditRefresh->saldo,
                    'nueva_cuota' => (float) $creditRefresh->cuota,
                    'nuevo_plazo' => (int) $creditRefresh->plazo,
                    'estrategia' => $strategy,
                    'capital_reducido' => $montoCapital,
                    'restante' => $restante > 0.50 ? $restante : 0,
                ]);
            }
        });
    }

    /**
     * Reintegrar un saldo pendiente (marcarlo como procesado sin aplicarlo)
     */
    public function reintegrar(Request $request, int $id)
    {
        // Solo usuarios con permiso "Reintegro de Saldo" (cobros.assign) o full_access
        $user = $request->user();
        $perms = $user->role?->getFormattedPermissions() ?? [];
        $tienePermiso = $user->role?->full_access || ($perms['cobros']['assign'] ?? false);
        if (!$tienePermiso) {
            return response()->json(['message' => 'No tienes permiso para reintegrar saldos'], 403);
        }

        $validated = $request->validate([
            'motivo' => 'nullable|string|max:500',
        ]);

        $saldo = SaldoPendiente::where('estado', 'pendiente')->find($id);
        if (!$saldo) {
            return response()->json([
                'message' => 'Este saldo ya no está disponible. Puede haber sido aplicado o eliminado.',
                'reload' => true
            ], 404);
        }

        return DB::transaction(function () use ($saldo, $validated, $user, $request) {
            $monto = (float) $saldo->monto;
            $credit = $saldo->credit;

            // Marcar como reintegrado
            $saldo->estado = 'reintegrado';
            $saldo->asignado_at = now();
            $saldo->notas = $validated['motivo'] ?? 'Saldo reintegrado - No aplicado a crédito';
            $saldo->save();

            // ============================================================
            // ACCOUNTING_API_TRIGGER: Reintegro de Saldo Pendiente
            // ============================================================
            // Dispara asiento contable al reintegrar un saldo:
            // DÉBITO: Cuentas por Cobrar (monto del saldo)
            // CRÉDITO: Banco CREDIPEP (monto del saldo)
            $this->triggerAccountingEntry(
                'REINTEGRO_SALDO',
                $monto,
                "REINTEGRO-{$saldo->id}-{$credit->reference}",
                [
                    'reference' => "REINTEGRO-{$saldo->id}-{$credit->reference}",
                    'credit_id' => $credit->reference,
                    'cedula' => $saldo->cedula,
                    'clienteNombre' => $credit->lead->name ?? null,
                    'motivo' => $validated['motivo'] ?? 'Sin motivo',
                    'origen' => $saldo->origen ?? 'Planilla',
                    'amount_breakdown' => [
                        'total' => $monto,
                        'interes_corriente' => 0,
                        'interes_moratorio' => 0,
                        'poliza' => 0,
                        'capital' => $monto,
                        'cargos_adicionales_total' => 0,
                        'cargos_adicionales' => [],
                    ],
                ]
            );

            $this->logActivity('update', 'Saldo Pendiente', $saldo, 'Saldo #' . $saldo->id . ' - Reintegro (' . ($credit->reference ?? '') . ')', [], $request);

            return response()->json([
                'message' => sprintf('Saldo de ₡%s reintegrado exitosamente', number_format($monto, 2)),
                'saldo' => $saldo->fresh(),
                'monto_reintegrado' => $monto,
                'credit_reference' => $credit->reference ?? $credit->numero_operacion,
            ]);
        });
    }

    /**
     * Solicitud de reintegro para usuarios sin permiso directo.
     * Crea una Tarea y notifica a todos los usuarios con permiso "Reintegro de Saldo" (cobros.assign).
     */
    public function requestReintegrar(Request $request, int $id)
    {
        $request->validate(['motivo' => 'required|string|max:500']);

        $saldo       = SaldoPendiente::with('credit.lead')->where('estado', 'pendiente')->findOrFail($id);
        $credit      = $saldo->credit;
        $solicitante = $request->user();

        $details = implode("\n", [
            "**Solicitado por:** {$solicitante->name} ({$solicitante->email})",
            "**Crédito:** {$credit->reference}",
            "**Cliente:** " . ($credit->lead->name ?? 'N/A'),
            "**Cédula:** {$saldo->cedula}",
            "**Monto:** ₡" . number_format($saldo->monto, 2, '.', ','),
            "**Motivo:** {$request->motivo}",
            "",
            "_Para aprobar: reintegrar el saldo #{$saldo->id} desde el módulo Cobros > Saldos por Asignar._",
        ]);

        // Intentar usar automation configurable, sino fallback a búsqueda por permisos
        $automation = \App\Models\TaskAutomation::where('event_type', 'saldo_reintegro_request')
            ->where('is_active', true)
            ->first();

        if ($automation) {
            $tasks = \App\Models\Task::createFromAutomation($automation, $credit->reference, $details);
            $notifyIds = $automation->getAssigneeIds();
        } else {
            // Fallback: crear tarea sin asignar y notificar por permisos
            \App\Models\Task::create([
                'title'        => "Solicitud de Reintegro de Saldo #{$saldo->id} — {$credit->reference}",
                'details'      => $details,
                'project_code' => $credit->reference,
                'project_name' => $credit->title ?? 'Crédito',
                'priority'     => 'alta',
                'status'       => 'pendiente',
                'created_by'   => $solicitante->id,
            ]);
            $notifyIds = \App\Models\User::whereHas('role', function ($q) {
                $q->where('full_access', true)
                  ->orWhereHas('permissions', function ($q2) {
                      $q2->where('module_key', 'cobros')->where('can_assign', true);
                  });
            })->where('id', '!=', $solicitante->id)->pluck('id')->toArray();
        }

        foreach ($notifyIds as $userId) {
            if ($userId == $solicitante->id) continue;
            \App\Models\Notification::create([
                'user_id' => $userId,
                'type'    => 'solicitud_reintegro',
                'title'   => "Solicitud de reintegro de saldo",
                'body'    => "{$solicitante->name} solicita reintegrar el saldo #{$saldo->id} del crédito {$credit->reference}. Motivo: {$request->motivo}",
                'data'    => json_encode([
                    'saldo_id'       => $saldo->id,
                    'credit_id'      => $credit->id,
                    'solicitante_id' => $solicitante->id,
                    'motivo'         => $request->motivo,
                ]),
            ]);
        }

        $this->logActivity('create', 'Cobros', $saldo,
            "Solicitud reintegro saldo #{$saldo->id} por {$solicitante->name}", [], $request);

        return response()->json(['message' => 'Solicitud enviada. Los usuarios autorizados han sido notificados.']);
    }
}
