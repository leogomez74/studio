<?php

namespace App\Services;

use App\Models\Credit;
use App\Models\CreditPayment;
use App\Models\PlanDePago;
use App\Traits\AccountingTrigger;

class AbonoService
{
    use AccountingTrigger;

    protected PaymentHelperService $helper;

    public function __construct(PaymentHelperService $helper)
    {
        $this->helper = $helper;
    }

    /**
     * Abono Extraordinario (Recálculo de Tabla)
     * Devuelve el CreditPayment creado.
     */
    public function procesarAbonoExtraordinario(Credit $credit, array $validated): CreditPayment
    {
        $montoAbono = $validated['monto'];
        $fechaPago = $validated['fecha'];
        $strategy = $validated['extraordinary_strategy'];

        // 1. Identificar punto de partida (Primera cuota no pagada)
        $siguienteCuota = $credit->planDePagos()
            ->where('estado', '!=', 'Pagado')
            ->where('cuota', '>', 0)
            ->orderBy('numero_cuota', 'asc')
            ->first();

        if (!$siguienteCuota) {
            throw new \Exception("No hay cuotas pendientes amortizables (mayores a 0).");
        }

        $numeroCuotaInicio = $siguienteCuota->numero_cuota;

        // Determinar la última cuota pagada para calcular penalización
        $ultimaCuotaPagada = $credit->planDePagos()
            ->where('numero_cuota', '>', 0)
            ->whereIn('estado', ['Pagado', 'Pagada'])
            ->orderBy('numero_cuota', 'desc')
            ->first();

        $numeroCuotaActual = $ultimaCuotaPagada ? $ultimaCuotaPagada->numero_cuota : 0;

        // Calcular penalización si está antes de la cuota 12
        $penalizacion = 0;
        $interesesPenalizacion = [];
        if ($numeroCuotaActual < 12) {
            $proximasCuotas = $credit->planDePagos()
                ->where('numero_cuota', '>', $numeroCuotaActual)
                ->where('estado', '!=', 'Pagado')
                ->orderBy('numero_cuota')
                ->take(3)
                ->get();

            foreach ($proximasCuotas as $cuota) {
                $interesCorriente = (float) $cuota->interes_corriente;
                $interesesPenalizacion[] = [
                    'numero_cuota' => $cuota->numero_cuota,
                    'interes_corriente' => $interesCorriente
                ];
                $penalizacion += $interesCorriente;
            }

            $penalizacion = round($penalizacion, 2);
        }

        // La penalización se RESTA del monto que se abona
        $montoAplicarAlSaldo = max(0, $montoAbono - $penalizacion);

        // Snapshot para reverso
        $planSnapshot = $credit->planDePagos()
            ->where('numero_cuota', '>=', $numeroCuotaInicio)
            ->get()->map(fn($c) => $c->toArray())->toArray();

        $reversalSnapshot = [
            'type' => 'extraordinario',
            'strategy' => $strategy,
            'original_saldo' => (float) $credit->saldo,
            'original_plazo' => (int) $credit->plazo,
            'original_cuota' => (float) $credit->cuota,
            'original_status' => $credit->status,
            'start_cuota_num' => $numeroCuotaInicio,
            'plan_rows' => $planSnapshot,
            'monto_abono' => $montoAbono,
            'penalizacion' => $penalizacion,
            'intereses_penalizacion' => $interesesPenalizacion,
            'monto_aplicado_al_saldo' => $montoAplicarAlSaldo,
        ];

        // 2. Aplicar directo al Saldo (Capital Vivo)
        $saldoActual = (float) $credit->saldo;

        if ($montoAplicarAlSaldo >= $saldoActual) {
            $montoAplicarAlSaldo = $saldoActual;
            $nuevoCapitalBase = 0;
        } else {
            $nuevoCapitalBase = round($saldoActual - $montoAplicarAlSaldo, 2);
        }

        $credit->saldo = $nuevoCapitalBase;
        $credit->save();

        // Recibo de abono a capital
        $estadoTexto = $penalizacion > 0
            ? 'Abono Extraordinario (Penalización: ₡' . number_format($penalizacion, 2) . ' - Aplicado: ₡' . number_format($montoAplicarAlSaldo, 2) . ')'
            : 'Abono Extraordinario';

        $paymentRecord = CreditPayment::create([
            'credit_id'      => $credit->id,
            'numero_cuota'   => 0,
            'fecha_pago'     => $fechaPago,
            'monto'          => $montoAbono,
            'saldo_anterior' => $saldoActual,
            'nuevo_saldo'    => $nuevoCapitalBase,
            'estado'         => $estadoTexto,
            'amortizacion'   => $montoAplicarAlSaldo,
            'source'         => 'Extraordinario',
            'movimiento_total' => $montoAbono,
            'interes_corriente' => $penalizacion,
            'cedula'         => $credit->lead->cedula ?? null,
            'reversal_snapshot' => $reversalSnapshot,
            'estado_reverso' => 'Vigente'
        ]);

        // ACCOUNTING_API_TRIGGER: Abono Extraordinario
        $this->triggerAccountingEntry(
            'ABONO_EXTRAORDINARIO',
            $montoAbono,
            "EXTRA-{$paymentRecord->id}-{$credit->reference}",
            [
                'reference' => "EXTRA-{$paymentRecord->id}-{$credit->reference}",
                'credit_id' => $credit->reference,
                'cedula' => $credit->lead->cedula ?? null,
                'clienteNombre' => $credit->lead->name ?? null,
                'deductora_id' => $credit->deductora_id,
                'deductora_nombre' => $credit->deductora->nombre ?? null,
                'amount_breakdown' => [
                    'total' => $montoAbono,
                    'interes_corriente' => 0,
                    'interes_moratorio' => 0,
                    'poliza' => 0,
                    'capital' => $montoAplicarAlSaldo,
                    'penalizacion' => $penalizacion,
                ],
            ]
        );

        // 3. Regenerar Proyección
        if ($nuevoCapitalBase > 0) {
            $this->helper->regenerarProyeccion(
                $credit,
                $strategy,
                $nuevoCapitalBase,
                $numeroCuotaInicio,
                $siguienteCuota->fecha_corte
            );
        } else {
            // Crédito finalizado
            PlanDePago::where('credit_id', $credit->id)
                ->where('numero_cuota', '>=', $numeroCuotaInicio)
                ->delete();
            $credit->status = 'Finalizado';
            $credit->save();
        }

        return $paymentRecord;
    }

    /**
     * Método público para aplicar abono a capital con estrategia de regeneración
     * Usado por SaldoPendienteController cuando se aplica un saldo a favor como capital
     */
    public function procesarAbonoCapitalConEstrategia(Credit $credit, $montoAbono, $fechaPago, $strategy, $source = 'Extraordinario', $cedula = null)
    {
        $saldoActual = (float) $credit->saldo;

        if ($montoAbono >= $saldoActual) {
            $montoAbono = $saldoActual;
            $nuevoCapitalBase = 0;
        } else {
            $nuevoCapitalBase = round($saldoActual - $montoAbono, 2);
        }

        $credit->saldo = $nuevoCapitalBase;
        $credit->save();

        // Identificar punto de partida (Primera cuota no pagada)
        $siguienteCuota = $credit->planDePagos()
            ->where('estado', '!=', 'Pagado')
            ->where('cuota', '>', 0)
            ->orderBy('numero_cuota', 'asc')
            ->first();

        $numeroCuotaInicio = $siguienteCuota ? $siguienteCuota->numero_cuota : 1;

        // Snapshot para reverso
        $planSnapshot = $credit->planDePagos()
            ->where('numero_cuota', '>=', $numeroCuotaInicio)
            ->get()->map(fn($c) => $c->toArray())->toArray();

        $reversalSnapshot = [
            'type' => 'extraordinario',
            'strategy' => $strategy,
            'original_saldo' => $saldoActual,
            'original_plazo' => (int) $credit->plazo,
            'original_cuota' => (float) $credit->cuota,
            'original_status' => $credit->status,
            'start_cuota_num' => $numeroCuotaInicio,
            'plan_rows' => $planSnapshot,
        ];

        // Registrar pago
        $paymentRecord = CreditPayment::create([
            'credit_id'      => $credit->id,
            'numero_cuota'   => 0,
            'fecha_cuota'    => $fechaPago,
            'fecha_pago'     => $fechaPago,
            'monto'          => $montoAbono,
            'saldo_anterior' => $saldoActual,
            'nuevo_saldo'    => $nuevoCapitalBase,
            'estado'         => 'Abono Extraordinario',
            'amortizacion'   => $montoAbono,
            'source'         => $source,
            'movimiento_total' => $montoAbono,
            'interes_corriente' => 0,
            'cedula'         => $cedula,
            'reversal_snapshot' => $reversalSnapshot,
            'estado_reverso' => 'Vigente'
        ]);

        // Regenerar proyección si queda saldo
        if ($nuevoCapitalBase > 0 && $siguienteCuota) {
            $this->helper->regenerarProyeccion(
                $credit,
                $strategy,
                $nuevoCapitalBase,
                $numeroCuotaInicio,
                $siguienteCuota->fecha_corte
            );
        } elseif ($nuevoCapitalBase <= 0) {
            // Crédito finalizado
            PlanDePago::where('credit_id', $credit->id)
                ->where('numero_cuota', '>=', $numeroCuotaInicio)
                ->delete();
            $credit->status = 'Finalizado';
            $credit->save();
        }

        return $paymentRecord;
    }

    /**
     * Preview del abono extraordinario con penalización y cálculo de nueva cuota/plazo
     */
    public function previewAbonoExtraordinario(Credit $credit, float $montoAbono, string $strategy): array
    {
        // Buscar la última cuota pagada para determinar penalización
        $ultimaCuotaPagada = $credit->planDePagos()
            ->where('numero_cuota', '>', 0)
            ->whereIn('estado', ['Pagado', 'Pagada'])
            ->orderBy('numero_cuota', 'desc')
            ->first();

        $numeroCuotaActual = $ultimaCuotaPagada ? $ultimaCuotaPagada->numero_cuota : 0;
        $saldoActual = (float) $credit->saldo;
        $cuotaActual = (float) $credit->cuota;
        $plazoActual = (int) $credit->plazo;

        // Calcular penalización si está antes de la cuota 12
        $penalizacion = 0;
        $cuotasPenalizacion = 0;
        $interesesPenalizacion = [];
        $aplicaPenalizacion = $numeroCuotaActual < 12;

        if ($aplicaPenalizacion) {
            $proximasCuotas = $credit->planDePagos()
                ->where('numero_cuota', '>', $numeroCuotaActual)
                ->where('estado', '!=', 'Pagado')
                ->orderBy('numero_cuota')
                ->take(3)
                ->get();

            foreach ($proximasCuotas as $cuota) {
                $interesCorriente = (float) $cuota->interes_corriente;
                $interesesPenalizacion[] = [
                    'numero_cuota' => $cuota->numero_cuota,
                    'interes_corriente' => $interesCorriente
                ];
                $penalizacion += $interesCorriente;
            }

            $cuotasPenalizacion = count($proximasCuotas);
            $penalizacion = round($penalizacion, 2);
        }

        $montoAplicarAlSaldo = max(0, $montoAbono - $penalizacion);
        $nuevoSaldo = max(0, $saldoActual - $montoAplicarAlSaldo);

        // Buscar la primera cuota pendiente
        $siguienteCuota = $credit->planDePagos()
            ->where('estado', '!=', 'Pagado')
            ->where('numero_cuota', '>', 0)
            ->orderBy('numero_cuota', 'asc')
            ->first();

        if (!$siguienteCuota) {
            return ['error' => 'No hay cuotas pendientes'];
        }

        $numeroCuotaInicio = $siguienteCuota->numero_cuota;
        $cuotasRestantes = $plazoActual - $numeroCuotaInicio + 1;

        $tasaAnual = (float) $credit->tasa_anual;
        $tasaMensual = ($tasaAnual / 100) / 12;

        $nuevaCuota = $cuotaActual;
        $nuevoPlazo = $plazoActual;

        if ($nuevoSaldo > 0 && $cuotasRestantes > 0) {
            if ($strategy === 'reduce_amount') {
                if ($tasaMensual > 0) {
                    $potencia = pow(1 + $tasaMensual, $cuotasRestantes);
                    if (is_finite($potencia) && $potencia > 1) {
                        $nuevaCuota = $nuevoSaldo * ($tasaMensual * $potencia) / ($potencia - 1);
                    } else {
                        $nuevaCuota = $nuevoSaldo / $cuotasRestantes;
                    }
                } else {
                    $nuevaCuota = $nuevoSaldo / $cuotasRestantes;
                }
                $nuevaCuota = round($nuevaCuota, 2);
            } else {
                if ($tasaMensual > 0 && $cuotaActual > 0) {
                    $valor_dentro_log = ($cuotaActual * $tasaMensual) / ($cuotaActual - ($nuevoSaldo * $tasaMensual));
                    if ($valor_dentro_log > 0) {
                        $cuotasNecesarias = log($valor_dentro_log) / log(1 + $tasaMensual);
                        $nuevoPlazo = $numeroCuotaInicio - 1 + ceil($cuotasNecesarias);
                    } else {
                        $nuevoPlazo = $numeroCuotaInicio - 1 + ceil($nuevoSaldo / $cuotaActual);
                    }
                    $nuevoPlazo = max($numeroCuotaInicio, min($nuevoPlazo, $plazoActual));
                } else {
                    $nuevoPlazo = $numeroCuotaInicio - 1 + ceil($nuevoSaldo / $cuotaActual);
                }
            }
        }

        // Calcular las próximas 3 cuotas futuras
        $cuotasFuturas = [];
        if ($nuevoSaldo > 0) {
            $saldoIteracion = $nuevoSaldo;
            $cuotasAProyectar = min(3, $cuotasRestantes);

            for ($i = 0; $i < $cuotasAProyectar; $i++) {
                $numeroRealCuota = $numeroCuotaInicio + $i;
                $interesFuturo = round($saldoIteracion * $tasaMensual, 2);

                if ($strategy === 'reduce_amount') {
                    $amortizacionFutura = round($nuevaCuota - $interesFuturo, 2);
                    $cuotaFutura = $nuevaCuota;
                } else {
                    $amortizacionFutura = round($cuotaActual - $interesFuturo, 2);
                    $cuotaFutura = $cuotaActual;
                }

                $nuevoSaldoIteracion = max(0, round($saldoIteracion - $amortizacionFutura, 2));

                $cuotasFuturas[] = [
                    'numero_cuota' => $numeroRealCuota,
                    'cuota' => $cuotaFutura,
                    'interes_corriente' => $interesFuturo,
                    'amortizacion' => $amortizacionFutura,
                    'saldo' => $nuevoSaldoIteracion,
                ];

                $saldoIteracion = $nuevoSaldoIteracion;
            }
        }

        $nuevaCuota = is_finite($nuevaCuota) ? $nuevaCuota : $cuotaActual;
        $nuevoPlazo = is_finite($nuevoPlazo) && $nuevoPlazo > 0 ? $nuevoPlazo : $plazoActual;

        return [
            'credit_id' => $credit->id,
            'cuota_actual' => $numeroCuotaActual,
            'strategy' => $strategy,
            'monto_abono' => $montoAbono,
            'aplica_penalizacion' => $aplicaPenalizacion,
            'cuotas_penalizacion' => $cuotasPenalizacion,
            'intereses_penalizacion' => $interesesPenalizacion,
            'monto_penalizacion' => $penalizacion,
            'monto_aplicar_al_saldo' => $montoAplicarAlSaldo,
            'saldo_actual' => $saldoActual,
            'nuevo_saldo' => $nuevoSaldo,
            'cuota_actual_valor' => $cuotaActual,
            'nueva_cuota' => $nuevaCuota,
            'plazo_actual' => $plazoActual,
            'nuevo_plazo' => $nuevoPlazo,
            'cuotas_restantes' => $cuotasRestantes,
            'ahorro_cuota' => $strategy === 'reduce_amount' ? round($cuotaActual - $nuevaCuota, 2) : 0,
            'ahorro_plazo' => $strategy === 'reduce_term' ? max(0, $plazoActual - $nuevoPlazo) : 0,
            'cuotas_futuras' => $cuotasFuturas,
        ];
    }
}
