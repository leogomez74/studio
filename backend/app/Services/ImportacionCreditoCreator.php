<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Credit;
use App\Models\CreditPayment;
use App\Models\Deductora;
use App\Models\Opportunity;
use App\Models\PlanDePago;
use App\Models\Person;
use App\Models\Tasa;
use App\Traits\AccountingTrigger;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Servicio para crear créditos importados desde Excel/CSV con su historial de pagos.
 *
 * Responsabilidades:
 * - Idempotencia (saltar duplicados por numero_operacion o referencia de pago)
 * - Cuota respetada del archivo (no se recalcula con fórmula francesa)
 * - Plan de pagos generado manualmente con la cuota override
 * - Triggers de asientos contables en fecha histórica (formalización + pagos)
 */
class ImportacionCreditoCreator
{
    use AccountingTrigger;

    /** Callback invocado tras cada asiento disparado: fn(bool $success): void */
    private $onAsiento = null;

    /**
     * Crea un crédito desde un payload validado en el preview.
     *
     * @param array<string, mixed> $creditoData {
     *     cedula, numero_operacion, monto_credito, plazo_meses, tasa_anual, cuota,
     *     fecha_formalizacion, deductora_nombre, divisa, categoria, descripcion
     * }
     * @param array<int, array<string, mixed>> $pagosData
     *
     * @return array{
     *     success: bool,
     *     credit_id?: int,
     *     numero_operacion?: string,
     *     pagos_creados?: int,
     *     pagos_saltados?: int,
     *     accounting?: array<int, array{type: string, success: bool, reference: string, error?: string}>,
     *     error?: string
     * }
     */
    public function crear(array $creditoData, array $pagosData = [], ?callable $onAsiento = null, array $planPagos = []): array
    {
        // Callback opcional: se invoca tras cada asiento disparado (para progreso en vivo).
        // Recibe (bool $success). Si es null, no hace nada.
        $this->onAsiento = $onAsiento;

        // Validar cliente
        $cliente = Person::query()
            ->withoutGlobalScopes()
            ->where('cedula', $creditoData['cedula'])
            ->first();

        if (!$cliente) {
            return ['success' => false, 'error' => "Cliente con cédula {$creditoData['cedula']} no existe"];
        }

        // Si el lead aún no es Cliente (person_type_id != 2), convertirlo
        if ((int) $cliente->person_type_id !== 2) {
            $cliente->person_type_id = 2;
            $cliente->save();
        }

        // Si el PDF trae institucion_labora y el cliente no la tiene, actualizarla.
        // (INSTITUCION del PDF = donde labora la persona, NO la deductora del crédito)
        if (!empty($creditoData['institucion_labora']) && empty($cliente->institucion_labora)) {
            $cliente->institucion_labora = $creditoData['institucion_labora'];
            $cliente->save();
        }

        // Validar crédito no existe — chequeo en 2 niveles:
        //   1. Por numero_operacion (exacto)
        //   2. Por cedula + monto + plazo + fecha_formalizacion (mismo crédito, distinto numero)
        if (!empty($creditoData['numero_operacion'])) {
            $existe = Credit::where('numero_operacion', $creditoData['numero_operacion'])->exists();
            if ($existe) {
                return [
                    'success' => false,
                    'error' => "Ya existe un crédito con número de operación {$creditoData['numero_operacion']}",
                ];
            }
        }

        if (!empty($creditoData['fecha_formalizacion']) && !empty($creditoData['monto_credito']) && !empty($creditoData['plazo_meses'])) {
            $duplicado = Credit::query()
                ->where('lead_id', $cliente->id)
                ->where('monto_credito', $creditoData['monto_credito'])
                ->where('plazo', $creditoData['plazo_meses'])
                ->whereDate('formalized_at', $creditoData['fecha_formalizacion'])
                ->first(['id', 'numero_operacion']);
            if ($duplicado) {
                return [
                    'success' => false,
                    'error' => "Ya existe un crédito #{$duplicado->id} (op: {$duplicado->numero_operacion}) para esta persona con el mismo monto, plazo y fecha de formalización",
                ];
            }
        }

        // Para data histórica, usamos la tasa EXACTA del archivo.
        $tasa = $this->resolverOCrearTasa((float) $creditoData['tasa_anual'], $creditoData['fecha_formalizacion']);

        // Cargar el mapa fijo de deductoras conocidas: solo CSG / CS / CN.
        // Cualquier otro comprobante (M-SJ, MIGRA, AJ, etc.) NO crea deductora;
        // sus pagos se contabilizan como PAGO_VENTANILLA.
        $deductoraMap = $this->cargarDeductoraMap();

        // Calcular deductora del PRIMER y ÚLTIMO pago según el comprobante.
        // FORMALIZACION usará la deductora del primer pago (null si no tiene coope).
        // Credit.deductora_id = deductora del último pago con coope válida.
        // Si NINGÚN pago tiene coope reconocida (CSG/CS/CN), ambos quedan en null.
        $deductoraIdPrimerPago = $this->extraerDeductoraIdDePago($pagosData[0] ?? null, $deductoraMap);
        $deductoraIdUltimoPago = null;
        for ($i = count($pagosData) - 1; $i >= 0; $i--) {
            $d = $this->extraerDeductoraIdDePago($pagosData[$i], $deductoraMap);
            if ($d !== null) { $deductoraIdUltimoPago = $d; break; }
        }
        // Credit.deductora_id = última coope (null si ninguna). NO se cae al primer pago.
        $deductoraId = $deductoraIdUltimoPago;

        $fechaFormalizacion = Carbon::parse($creditoData['fecha_formalizacion'])->startOfDay();

        $accountingResults = [];
        $pagosCreados = 0;
        $pagosSaltados = 0;
        $creditId = null;
        $reference = null;
        $asientoSpecs = []; // se llenan en la transacción, se disparan después

        try {
            DB::transaction(function () use (
                $creditoData, $pagosData, $planPagos, $cliente, $tasa, $deductoraId, $fechaFormalizacion,
                $deductoraIdPrimerPago, $deductoraMap,
                &$asientoSpecs, &$pagosCreados, &$pagosSaltados, &$creditId, &$reference
            ) {
                // 1. Crear opportunity si no existe (necesario para el flujo del sistema)
                $opportunity = $this->crearOpportunity($cliente, $creditoData, $fechaFormalizacion);

                // 2. Crear el crédito
                $reference = $creditoData['numero_operacion'] ?: $this->generarReference($cliente->id);

                $credit = Credit::create([
                    'reference'        => $reference,
                    'title'            => "Crédito importado - {$cliente->name}",
                    'status'           => 'Formalizado',
                    'lead_id'          => $cliente->id,
                    'opportunity_id'   => $opportunity?->id,
                    'opened_at'        => $fechaFormalizacion,
                    'description'      => $creditoData['descripcion'] ?? 'Importado desde archivo',
                    'category'         => $creditoData['categoria'] ?? null,
                    'numero_operacion' => $creditoData['numero_operacion'],
                    'monto_credito'    => $creditoData['monto_credito'],
                    'cuota'            => $creditoData['cuota'],
                    'plazo'            => $creditoData['plazo_meses'],
                    'tasa_id'          => $tasa->id,
                    'tasa_anual'       => $creditoData['tasa_anual'],
                    'deductora_id'     => $deductoraId,
                    'formalized_at'    => $fechaFormalizacion,
                ]);

                $creditId = $credit->id;

                // 3. Plan de pagos:
                //    - Si el PDF trae plan_pagos (cuotas en tránsito/vencidas) → usar
                //      esos renglones EXACTOS (cuota, interés, mora, principal, días).
                //    - Si no → generar por fórmula con la cuota del archivo.
                if (!empty($planPagos)) {
                    $this->generarPlanDePagosDesdeArchivo($credit, $fechaFormalizacion, $planPagos);
                } else {
                    $this->generarPlanDePagos($credit, $fechaFormalizacion);
                }

                // 4. Recolectar spec del asiento FORMALIZACION (se dispara post-commit)
                $asientoSpecs[] = [
                    'type'      => 'FORMALIZACION',
                    'amount'    => (float) $credit->monto_credito,
                    'reference' => $credit->reference,
                    'context'   => [
                        'reference'        => $credit->reference,
                        'credit_id'        => $credit->reference,
                        'credit_numeric_id'=> $credit->id,
                        'cedula'           => $cliente->cedula,
                        'clienteNombre'    => $cliente->name,
                        // FORMALIZACION usa la deductora del PRIMER pago del archivo
                        'deductora_id'     => $deductoraIdPrimerPago,
                        'entry_date'       => $fechaFormalizacion->format('Y-m-d'),
                        'amount_breakdown' => [
                            'total'              => (float) $credit->monto_credito,
                            'interes_corriente'  => 0,
                            'interes_moratorio'  => 0,
                            'poliza'             => 0,
                            'capital'            => (float) $credit->monto_credito,
                            'sobrante'           => 0,
                            'cargos_adicionales_total' => 0,
                            'cargos_adicionales' => [],
                        ],
                    ],
                ];

                // 5. Crear pagos del archivo y recolectar sus specs de asiento
                foreach ($pagosData as $pago) {
                    if (!empty($pago['referencia_pago'])) {
                        $dup = CreditPayment::where('referencia', $pago['referencia_pago'])->exists();
                        if ($dup) {
                            $pagosSaltados++;
                            continue;
                        }
                    }

                    // Cada pago usa su PROPIA deductora según el sufijo del comprobante.
                    $pagoDeductoraId = $this->extraerDeductoraIdDePago($pago, $deductoraMap);
                    $pagoResult = $this->aplicarPago($credit, $cliente, $pago, $pagoDeductoraId);
                    if (!empty($pagoResult['asiento_spec'])) {
                        $asientoSpecs[] = $pagoResult['asiento_spec'];
                    }
                    $pagosCreados++;
                }
            });

            // ── FASE 2 (post-commit): disparar asientos con pacing ──
            // La transacción ya cerró: las llamadas HTTP + retries de 429
            // ya NO mantienen la transacción abierta.
            $delayMs = (int) config('services.erp.asiento_delay_ms', 250);
            foreach ($asientoSpecs as $spec) {
                $res = $this->triggerAccountingEntry(
                    $spec['type'],
                    $spec['amount'],
                    $spec['reference'],
                    $spec['context']
                );
                $accountingResults[] = [
                    'type'      => $spec['type'],
                    'success'   => (bool) ($res['success'] ?? false),
                    'reference' => $spec['reference'],
                    'error'     => $res['error'] ?? null,
                ];
                if ($this->onAsiento) ($this->onAsiento)((bool) ($res['success'] ?? false));

                // Pacing entre asientos para no saturar el ERP (seguro: sin transacción abierta)
                if ($delayMs > 0) {
                    usleep($delayMs * 1000);
                }
            }
        } catch (\Throwable $e) {
            Log::error('ImportacionCreditoCreator: error creando crédito', [
                'cedula' => $creditoData['cedula'],
                'numero_operacion' => $creditoData['numero_operacion'] ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }

        return [
            'success'         => true,
            'credit_id'       => $creditId,
            'numero_operacion'=> $reference,
            'pagos_creados'   => $pagosCreados,
            'pagos_saltados'  => $pagosSaltados,
            'accounting'      => $accountingResults,
        ];
    }

    /**
     * Crea el CreditPayment y ajusta saldo/plan. NO dispara el asiento:
     * devuelve la "spec" del asiento para dispararlo DESPUÉS de la transacción
     * (así el pacing/retry no mantiene la transacción abierta).
     *
     * @param array<string, mixed> $pago
     * @return array{asiento_spec: array<string, mixed>}
     */
    private function aplicarPago(Credit $credit, Person $cliente, array $pago, ?int $deductoraId): array
    {
        $fechaPago = Carbon::parse($pago['fecha_pago'])->startOfDay();
        $montoTotal = (float) $pago['monto_total'];
        $capital = (float) $pago['capital'];
        $interesCorriente = (float) $pago['interes_corriente'];
        $interesMoratorio = (float) ($pago['interes_moratorio'] ?? 0);
        $poliza = (float) ($pago['poliza'] ?? 0);
        $otros = (float) ($pago['otros'] ?? 0);
        $tipoPago = $pago['tipo_pago'] ?? 'cuota_regular';

        $saldoAnterior = (float) $credit->saldo;
        $nuevoSaldo = max(0, round($saldoAnterior - $capital, 2));

        $payment = CreditPayment::create([
            'credit_id'         => $credit->id,
            'numero_cuota'      => $pago['numero_cuota'] ?? null,
            'fecha_pago'        => $fechaPago,
            'cuota'             => (float) $credit->cuota,
            'monto'             => $montoTotal,
            'poliza'            => $poliza,  // ← columna POLIZAS del PDF
            'interes_corriente' => $interesCorriente,
            'interes_moratorio' => $interesMoratorio,
            'amortizacion'      => $capital,
            'saldo_anterior'    => $saldoAnterior,
            'nuevo_saldo'       => $nuevoSaldo,
            'estado'            => 'Pagado',
            'fecha_movimiento'  => $fechaPago,
            'movimiento_total'  => $montoTotal,
            'movimiento_amortizacion' => $capital,
            'tasa_actual'       => $credit->tasa_anual,
            'plazo_actual'      => $credit->plazo,
            // Source según si hay deductora válida (CSG/CS/CN) o no
            'source'            => $deductoraId ? 'Planilla' : 'Ventanilla',
            'referencia'        => $pago['referencia_pago'] ?? null,
            'cedula'            => $cliente->cedula,
        ]);

        $credit->saldo = $nuevoSaldo;
        $credit->fecha_ultimo_pago = $fechaPago;
        $credit->save();

        // Actualizar plan de pagos: marcar cuota correspondiente como pagada
        if (!empty($pago['numero_cuota'])) {
            PlanDePago::where('credit_id', $credit->id)
                ->where('numero_cuota', (int) $pago['numero_cuota'])
                ->update([
                    'fecha_pago' => $fechaPago,
                    'estado'     => 'Pagada',
                ]);
        }

        // Tipo del asiento según si hay deductora válida (CSG/CS/CN):
        //  - Con deductora → PAGO_PLANILLA (cuenta dinámica de la deductora)
        //  - Sin deductora → PAGO_VENTANILLA (cuenta fija de Caja General)
        $entryType = $deductoraId ? 'PAGO_PLANILLA' : 'PAGO_VENTANILLA';

        // Devolver la spec del asiento — se dispara DESPUÉS de la transacción
        return [
            'asiento_spec' => [
                'type'      => $entryType,
                'amount'    => $montoTotal,
                'reference' => "{$credit->reference}-PAY-{$payment->id}",
                'context'   => [
                    'reference'         => $credit->reference,
                    'credit_id'         => $credit->reference,
                    'credit_numeric_id' => $credit->id,
                    'payment_id'        => $payment->id,
                    'cedula'            => $cliente->cedula,
                    'clienteNombre'     => $cliente->name,
                    'deductora_id'      => $deductoraId,
                    'entry_date'        => $fechaPago->format('Y-m-d'),
                    'amount_breakdown'  => [
                        'total'             => $montoTotal,
                        'interes_corriente' => $interesCorriente,
                        'interes_moratorio' => $interesMoratorio,
                        'poliza'            => $poliza,
                        'capital'           => $capital,
                        'sobrante'          => 0,
                        'cargos_adicionales_total' => $otros,
                        'cargos_adicionales' => $otros > 0 ? ['otros' => $otros] : [],
                    ],
                ],
            ],
        ];
    }

    /**
     * Crea opportunity placeholder para el crédito (requerido por el flujo del sistema).
     */
    private function crearOpportunity(Person $cliente, array $data, Carbon $fechaFormalizacion): ?Opportunity
    {
        try {
            $opportunity = new Opportunity();
            $opportunity->name = "Importado - {$cliente->name}";
            $opportunity->lead_cedula = $cliente->cedula;
            $opportunity->amount = $data['monto_credito'];
            $opportunity->stage = 'Formalizado';
            $opportunity->close_date = $fechaFormalizacion;
            $opportunity->save();
            return $opportunity;
        } catch (\Throwable $e) {
            Log::warning('No se pudo crear opportunity para crédito importado', [
                'cedula' => $cliente->cedula,
                'error'  => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Genera el plan de pagos respetando la cuota del archivo (sin disparar el observer francés).
     */
    private function generarPlanDePagos(Credit $credit, Carbon $fechaFormalizacion): void
    {
        $capital = (float) $credit->monto_credito;
        $plazo = (int) $credit->plazo;
        $cuotaOverride = (float) $credit->cuota;
        $tasaMensual = ((float) $credit->tasa_anual) / 12 / 100;

        // Bypass del observer que recalcula con fórmula francesa
        PlanDePago::withoutEvents(function () use ($credit, $capital, $plazo, $cuotaOverride, $tasaMensual, $fechaFormalizacion) {
            // Línea 0: Inicialización
            PlanDePago::create([
                'credit_id'        => $credit->id,
                'linea'            => '1',
                'numero_cuota'     => 0,
                'proceso'          => $fechaFormalizacion->format('Ym'),
                'fecha_inicio'     => $fechaFormalizacion,
                'fecha_corte'      => null,
                'fecha_pago'       => null,
                'tasa_actual'      => $credit->tasa_anual,
                'plazo_actual'     => $plazo,
                'cuota'            => 0,
                'poliza'           => 0,
                'interes_corriente'=> 0,
                'interes_moratorio'=> 0,
                'amortizacion'     => 0,
                'saldo_anterior'   => 0,
                'saldo_nuevo'      => $capital,
                'dias'             => 0,
                'estado'           => 'Vigente',
                'dias_mora'        => 0,
                'fecha_movimiento' => $fechaFormalizacion,
                'movimiento_total' => $capital,
                'movimiento_principal' => $capital,
                'movimiento_caja_usuario' => 'Importación',
                'tipo_documento'   => 'Formalización',
                'numero_documento' => $credit->numero_operacion,
                'concepto'         => 'Desembolso Inicial (Importado)',
            ]);

            // Cuotas 1..N con cuota override del archivo
            $saldoRestante = $capital;
            for ($i = 1; $i <= $plazo; $i++) {
                $saldoAnterior = round($saldoRestante, 2);
                $interesCorriente = round($saldoAnterior * $tasaMensual, 2);
                $amortizacion = $cuotaOverride - $interesCorriente;

                // En la última cuota, ajustar amortización para que cierre en 0
                if ($i === $plazo) {
                    $amortizacion = $saldoAnterior;
                    $cuotaFinal = round($amortizacion + $interesCorriente, 2);
                } else {
                    $cuotaFinal = $cuotaOverride;
                    $amortizacion = round($amortizacion, 2);
                }

                $saldoNuevo = max(0, round($saldoAnterior - $amortizacion, 2));
                $fechaCorte = $fechaFormalizacion->copy()->addMonths($i)->endOfMonth();

                PlanDePago::create([
                    'credit_id'        => $credit->id,
                    'linea'            => '1',
                    'numero_cuota'     => $i,
                    'proceso'          => $fechaFormalizacion->format('Ym'),
                    'fecha_inicio'     => $fechaFormalizacion,
                    'fecha_corte'      => $fechaCorte,
                    'fecha_pago'       => null,
                    'tasa_actual'      => $credit->tasa_anual,
                    'plazo_actual'     => $plazo,
                    'cuota'            => $cuotaFinal,
                    'cargos'           => 0,
                    'poliza'           => 0,
                    'interes_corriente'=> $interesCorriente,
                    'int_corriente_vencido' => 0,
                    'interes_moratorio'=> 0,
                    'amortizacion'     => $amortizacion,
                    'saldo_anterior'   => $saldoAnterior,
                    'saldo_nuevo'      => $saldoNuevo,
                    'dias'             => 0,
                    'estado'           => 'Pendiente',
                    'dias_mora'        => 0,
                ]);

                $saldoRestante = $saldoNuevo;
            }
        });
    }

    /**
     * Genera el plan de pagos usando EXACTAMENTE los renglones del PDF
     * (sección "CUOTAS EN TRANSITO Y VENCIDAS"). No recalcula nada:
     * cuota, interés corriente, interés moratorio, principal, días de mora
     * y estado salen tal cual del documento. NO genera asientos (no se pagaron).
     *
     * @param array<int, array<string, mixed>> $planPagos
     */
    private function generarPlanDePagosDesdeArchivo(Credit $credit, Carbon $fechaFormalizacion, array $planPagos): void
    {
        $capital = (float) $credit->monto_credito;

        PlanDePago::withoutEvents(function () use ($credit, $capital, $fechaFormalizacion, $planPagos) {
            // Línea 0: Inicialización (desembolso)
            PlanDePago::create([
                'credit_id'        => $credit->id,
                'linea'            => '1',
                'numero_cuota'     => 0,
                'proceso'          => $fechaFormalizacion->format('Ym'),
                'fecha_inicio'     => $fechaFormalizacion,
                'fecha_corte'      => null,
                'fecha_pago'       => null,
                'tasa_actual'      => $credit->tasa_anual,
                'plazo_actual'     => $credit->plazo,
                'cuota'            => 0,
                'poliza'           => 0,
                'interes_corriente'=> 0,
                'interes_moratorio'=> 0,
                'amortizacion'     => 0,
                'saldo_anterior'   => 0,
                'saldo_nuevo'      => $capital,
                'dias'             => 0,
                'estado'           => 'Vigente',
                'dias_mora'        => 0,
                'fecha_movimiento' => $fechaFormalizacion,
                'movimiento_total' => $capital,
                'movimiento_principal' => $capital,
                'movimiento_caja_usuario' => 'Importación',
                'tipo_documento'   => 'Formalización',
                'numero_documento' => $credit->numero_operacion,
                'concepto'         => 'Desembolso Inicial (Importado)',
            ]);

            // Cuotas 1..N exactas del PDF
            $saldoRestante = $capital;
            foreach ($planPagos as $row) {
                $amortizacion   = (float) ($row['amortizacion'] ?? 0);
                $saldoAnterior  = round($saldoRestante, 2);
                $saldoNuevo     = max(0, round($saldoAnterior - $amortizacion, 2));
                $fechaCorte     = !empty($row['fecha_corte']) ? Carbon::parse($row['fecha_corte']) : null;

                PlanDePago::create([
                    'credit_id'         => $credit->id,
                    'linea'             => '1',
                    'numero_cuota'      => (int) ($row['numero_cuota'] ?? 0),
                    'proceso'           => $row['proceso'] ?? $fechaFormalizacion->format('Ym'),
                    'fecha_inicio'      => $fechaFormalizacion,
                    'fecha_corte'       => $fechaCorte,
                    'fecha_pago'        => null, // NO pagada
                    'tasa_actual'       => $credit->tasa_anual,
                    'plazo_actual'      => $credit->plazo,
                    'cuota'             => (float) ($row['cuota'] ?? 0),
                    'poliza'            => (float) ($row['poliza'] ?? 0),
                    'cargos'            => (float) ($row['cargos'] ?? 0),
                    'interes_corriente' => (float) ($row['interes_corriente'] ?? 0),
                    'int_corriente_vencido' => 0,
                    'interes_moratorio' => (float) ($row['interes_moratorio'] ?? 0),
                    'amortizacion'      => $amortizacion,
                    'saldo_anterior'    => $saldoAnterior,
                    'saldo_nuevo'       => $saldoNuevo,
                    'dias'              => 0,
                    'estado'            => $row['estado'] ?? 'Vencida',
                    'dias_mora'         => (int) ($row['dias_mora'] ?? 0),
                ]);

                $saldoRestante = $saldoNuevo;
            }
        });
    }

    /**
     * Busca una tasa con el mismo valor que viene en el archivo. Si no existe,
     * la crea automáticamente como tasa histórica (inactiva, sin afectar tasas vigentes).
     *
     * El objetivo de la importación histórica es respetar EXACTAMENTE los valores
     * del archivo original, no validar contra tasas vigentes del sistema actual.
     */
    private function resolverOCrearTasa(float $tasaAnual, ?string $fechaFormalizacion = null): Tasa
    {
        $tasaRedondeada = round($tasaAnual, 2);

        // Match exacto (redondeado a 2 decimales)
        $tasa = Tasa::whereRaw('ROUND(tasa, 2) = ?', [$tasaRedondeada])->first();
        if ($tasa) return $tasa;

        // Crear nueva tasa histórica con el valor del archivo
        return Tasa::create([
            'nombre'      => "Tasa Histórica {$tasaRedondeada}%",
            'tasa'        => $tasaRedondeada,
            'tasa_maxima' => $tasaRedondeada * 1.3, // moratoria estándar 30% adicional
            'inicio'      => $fechaFormalizacion ?: now()->format('Y-m-d'),
            'fin'         => null,
            'activo'      => false, // No interferir con tasas vigentes
        ]);
    }

    /**
     * Genera una referencia única para el crédito si el archivo no trae numero_operacion.
     */
    private function generarReference(int $personId): string
    {
        return 'IMP-' . now()->format('Ymd') . '-' . $personId . '-' . random_int(1000, 9999);
    }

    /**
     * Mapea tipo_pago del archivo a entry_type contable.
     */
    private function mapearEntryType(string $tipoPago): string
    {
        return match (strtolower($tipoPago)) {
            'cuota_planilla', 'planilla'   => 'PAGO_PLANILLA',
            'cuota_ventanilla', 'ventanilla' => 'PAGO_VENTANILLA',
            'abono_capital', 'abono'       => 'ABONO_EXTRAORDINARIO',
            'cancelacion_total', 'cancelacion' => 'PAGO_VENTANILLA',
            default                        => 'PAGO_VENTANILLA',
        };
    }

    /**
     * Mapea tipo_pago a campo `source` de credit_payments.
     */
    private function mapearSource(string $tipoPago): string
    {
        return match (strtolower($tipoPago)) {
            'cuota_planilla', 'planilla'   => 'Planilla',
            'cuota_ventanilla', 'ventanilla' => 'Ventanilla',
            'abono_capital', 'abono'       => 'Abono Extraordinario',
            'cancelacion_total', 'cancelacion' => 'Cancelación Total',
            default                        => 'Importación',
        };
    }

    /**
     * Construye un mapa de prefijo de comprobante → deductora_id usando solo las
     * 3 cooperativas conocidas. Si no se encuentra alguna en la BD, se omite (el
     * pago caerá a PAGO_VENTANILLA por no tener deductora_id).
     *
     * @return array<string, int>
     */
    private function cargarDeductoraMap(): array
    {
        $map = [];
        $patterns = [
            'CSG' => 'coope san gabriel',
            'CS'  => 'coopeservicios',
            'CN'  => 'coopenacional',
        ];
        foreach ($patterns as $sufijo => $patron) {
            $d = Deductora::whereRaw('LOWER(nombre) LIKE ?', ['%' . $patron . '%'])->first();
            if ($d) {
                $map[$sufijo] = $d->id;
            }
        }
        return $map;
    }

    /**
     * Extrae el id de deductora de un pago según el sufijo del comprobante.
     * Devuelve null si:
     *   - El pago no tiene referencia_pago
     *   - El comprobante no es PLA*.SUFIJO.CRD
     *   - El sufijo no es CSG/CS/CN (caso M-SJ, MIGRA, AJ, etc.)
     *
     * @param array<string, mixed>|null $pago
     * @param array<string, int> $deductoraMap
     */
    private function extraerDeductoraIdDePago(?array $pago, array $deductoraMap): ?int
    {
        if (!$pago) return null;
        $ref = (string) ($pago['referencia_pago'] ?? '');
        if ($ref === '') return null;

        if (!preg_match('/PLA\d+\.([A-Z\-]+)\.CRD/', $ref, $m)) {
            return null;
        }
        $sufijo = $m[1];
        return $deductoraMap[$sufijo] ?? null;
    }
}
