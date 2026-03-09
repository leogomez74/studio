<?php

namespace App\Services;

use App\Models\Credit;
use App\Models\CreditPayment;
use App\Models\PlanDePago;
use App\Models\SaldoPendiente;
use App\Traits\AccountingTrigger;
use Illuminate\Support\Facades\Auth;

class PaymentProcessingService
{
    use AccountingTrigger;

    protected PaymentHelperService $helper;

    /** Flag temporal por payment: si la última cuota procesada tenía mora */
    private array $moraFlags = [];

    public function __construct(PaymentHelperService $helper)
    {
        $this->helper = $helper;
    }

    /**
     * Obtener el flag de mora para un payment
     */
    public function getMoraFlag(int $paymentId): bool
    {
        return $this->moraFlags[$paymentId] ?? false;
    }

    /**
     * Lógica "Cascada" (Waterfall) para pagos regulares
     * IMPUTACIÓN: Mora -> Interés -> Cargos -> Capital
     */
    public function processPaymentTransaction(Credit $credit, $montoEntrante, $fecha, $source, $cedulaRef = null, $cuotasSeleccionadas = null, bool $singleCuotaMode = false, $planillaUploadId = null, float $sobranteContable = -1, ?string $referencia = null)
    {
        $dineroDisponible = $montoEntrante;

        // Obtener cuotas en orden: primero las que están en "Mora", luego "Pendiente" o "Parcial"
        $query = $credit->planDePagos()
            ->whereIn('estado', ['Mora', 'Pendiente', 'Parcial'])
            ->where('numero_cuota', '>', 0);
        if (is_array($cuotasSeleccionadas) && count($cuotasSeleccionadas) > 0) {
            $query->whereIn('id', $cuotasSeleccionadas);
        }
        // Ordenar: Mora primero, luego Parcial, luego Pendiente, y dentro de cada grupo por numero_cuota
        $cuotas = $query->orderByRaw("FIELD(estado, 'Mora', 'Parcial', 'Pendiente')")
            ->orderBy('numero_cuota', 'asc')
            ->get();

        $primerCuotaAfectada = null;
        $saldoAnteriorSnapshot = 0;
        $saldoCreditoAntes = $credit->saldo;

        $carryInteres = 0.0;
        $carryAmort = 0.0;
        $cuotasArr = $cuotas->all();
        $cuotasCount = count($cuotasArr);

        // --- CORRECCIÓN: Variable para acumular solo lo amortizado HOY ---
        $capitalAmortizadoHoy = 0.0;
        $paymentDetails = [];

        foreach ($cuotasArr as $i => $cuota) {
            if ($dineroDisponible <= 0.005) break;

            if (!$primerCuotaAfectada) {
                $primerCuotaAfectada = $cuota;
                $saldoAnteriorSnapshot = ($cuota->cuota + $cuota->interes_moratorio) - $cuota->movimiento_total;
            }

            // A. Pendientes
            $pendienteMora = max(0.0, $cuota->interes_moratorio - $cuota->movimiento_interes_moratorio);

            // Separar pendientes de interés corriente y vencido
            $pendienteIntVencido = max(0.0, ($cuota->int_corriente_vencido ?? 0) - ($cuota->movimiento_int_corriente_vencido ?? 0));
            $pendienteIntCorriente = max(0.0, ($cuota->interes_corriente ?? 0) - ($cuota->movimiento_interes_corriente ?? 0));

            // Sumar carry de interés al pendiente vencido primero
            $pendienteIntVencido += $carryInteres;

            $pendientePoliza = max(0.0, $cuota->poliza - $cuota->movimiento_poliza);
            $pendientePrincipal = max(0.0, $cuota->amortizacion - $cuota->movimiento_principal) + $carryAmort;

            // B. Aplicar Pagos
            $pagoMora = min($dineroDisponible, $pendienteMora);
            $cuota->movimiento_interes_moratorio += $pagoMora;
            $dineroDisponible -= $pagoMora;

            // Pagar primero interés corriente vencido
            $pagoIntVencido = 0;
            if ($dineroDisponible > 0 && $pendienteIntVencido > 0) {
                $pagoIntVencido = min($dineroDisponible, $pendienteIntVencido);
                $cuota->movimiento_int_corriente_vencido = ($cuota->movimiento_int_corriente_vencido ?? 0) + $pagoIntVencido;
                $dineroDisponible -= $pagoIntVencido;
            }

            // Luego pagar interés corriente
            $pagoIntCorriente = 0;
            if ($dineroDisponible > 0 && $pendienteIntCorriente > 0) {
                $pagoIntCorriente = min($dineroDisponible, $pendienteIntCorriente);
                $cuota->movimiento_interes_corriente += $pagoIntCorriente;
                $dineroDisponible -= $pagoIntCorriente;
            }

            $pagoPoliza = 0;
            if ($dineroDisponible > 0) {
                $pagoPoliza = min($dineroDisponible, $pendientePoliza);
                $cuota->movimiento_poliza += $pagoPoliza;
                $dineroDisponible -= $pagoPoliza;
            }

            $pagoPrincipal = 0;
            if ($dineroDisponible > 0) {
                $pagoPrincipal = min($dineroDisponible, $pendientePrincipal);
                $cuota->movimiento_principal += $pagoPrincipal;
                $dineroDisponible -= $pagoPrincipal;

                // ACUMULAR PARA EL DESCUENTO DE SALDO
                $capitalAmortizadoHoy += $pagoPrincipal;
            }

            // Calculate carry-over for next cuota
            $leftIntVencido = $pendienteIntVencido - $pagoIntVencido;
            $leftIntCorriente = $pendienteIntCorriente - $pagoIntCorriente;
            $leftAmort = $pendientePrincipal - $pagoPrincipal;

            // Only carry to next cuota, not last
            if ($i < $cuotasCount - 1) {
                // Carry suma ambos tipos de interés pendientes
                $carryInteres = max(0.0, $leftIntVencido + $leftIntCorriente);
                $carryAmort = max(0.0, $leftAmort);
            } else {
                $carryInteres = 0.0;
                $carryAmort = 0.0;
            }

            $totalPagadoEnEstaTransaccion = $pagoMora + $pagoIntVencido + $pagoIntCorriente + $pagoPoliza + $pagoPrincipal;
            $cuota->movimiento_total += $totalPagadoEnEstaTransaccion;
            $cuota->movimiento_amortizacion += $pagoPrincipal;
            $cuota->fecha_movimiento = $fecha;
            // La fecha de pago es igual a la fecha de movimiento
            if (!$cuota->fecha_pago) {
                $cuota->fecha_pago = $fecha;
            }

            // Trazabilidad: quién aplicó, tipo y referencia contable
            $cuota->movimiento_caja_usuario = Auth::user()?->name ?? 'Sistema';
            $cuota->tipo_documento = $source;

            // Calcular total exigible incluyendo int_corriente_vencido
            $totalExigible = $cuota->interes_corriente
                           + $cuota->int_corriente_vencido
                           + $cuota->interes_moratorio
                           + $cuota->poliza
                           + $cuota->amortizacion;

            if ($cuota->movimiento_total >= ($totalExigible - 0.05)) {
                $teniaMora = ((float) ($cuota->int_corriente_vencido ?? 0) > 0) || ((float) ($cuota->interes_moratorio ?? 0) > 0) || ((int) ($cuota->dias_mora ?? 0) > 0);
                $cuota->estado = 'Pagado';
                $cuota->concepto = $teniaMora ? 'Pago registrado (mora)' : 'Pago registrado';
            } else {
                $cuota->estado = 'Parcial';
                $cuota->concepto = 'Pago parcial';
            }

            // Registrar detalle de lo que este pago aportó a esta cuota
            if ($totalPagadoEnEstaTransaccion > 0) {
                $paymentDetails[] = [
                    'plan_de_pago_id' => $cuota->id,
                    'numero_cuota' => $cuota->numero_cuota,
                    'estado_anterior' => $cuota->getOriginal('estado'),
                    'pago_mora' => $pagoMora,
                    'pago_int_vencido' => $pagoIntVencido,
                    'pago_int_corriente' => $pagoIntCorriente,
                    'pago_poliza' => $pagoPoliza,
                    'pago_principal' => $pagoPrincipal,
                    'pago_total' => $totalPagadoEnEstaTransaccion,
                ];
            }

            $cuota->save();

            // En modo planilla (singleCuota), solo procesar UNA cuota y parar
            if ($singleCuotaMode) {
                break;
            }
        }

        // --- CORRECCIÓN: Actualizar Saldo de forma INCREMENTAL ---
        $credit->saldo = max(0.0, $credit->saldo - $capitalAmortizadoHoy);
        $credit->save();

        // Verificar y actualizar estado si ya no hay mora
        $this->helper->checkAndUpdateCreditStatus($credit);

        // Recibo: monto = lo realmente consumido por este crédito (no el monto total de entrada)
        $montoConsumido = $montoEntrante - max(0, $dineroDisponible);
        $paymentRecord = CreditPayment::create([
            'credit_id'      => $credit->id,
            'planilla_upload_id' => $planillaUploadId,
            'numero_cuota'   => $primerCuotaAfectada ? $primerCuotaAfectada->numero_cuota : 0,
            'fecha_cuota'    => $primerCuotaAfectada ? $primerCuotaAfectada->fecha_corte : null,
            'fecha_pago'     => $fecha,
            'monto'          => $montoConsumido,
            'cuota'          => $primerCuotaAfectada ? (float) $primerCuotaAfectada->cuota : 0,
            'saldo_anterior' => $saldoCreditoAntes,
            'nuevo_saldo'    => $credit->saldo,
            'estado'         => 'Aplicado',
            'interes_corriente' => $credit->planDePagos()->sum('movimiento_interes_corriente'),
            'amortizacion'      => $credit->planDePagos()->sum('movimiento_amortizacion'),
            'source'            => $source,
            'referencia'        => $referencia,
            'movimiento_total'  => $dineroDisponible > 0 ? $dineroDisponible : 0,
            'cedula'            => $cedulaRef
        ]);

        // Flag: ¿la última cuota procesada tenía mora?
        $ultimaCuotaTeniaMora = false;
        if (!empty($paymentDetails)) {
            $lastDetail = end($paymentDetails);
            $ultimaCuotaTeniaMora = in_array($lastDetail['estado_anterior'], ['Mora', 'Parcial'])
                && ($lastDetail['pago_mora'] > 0 || $lastDetail['pago_int_vencido'] > 0);
        }
        $this->moraFlags[$paymentRecord->id] = $ultimaCuotaTeniaMora;

        // Si hubo sobrante en un pago MANUAL (no planilla), crear SaldoPendiente
        if ($dineroDisponible > 0.50 && $planillaUploadId === null) {
            $saldoPendiente = SaldoPendiente::create([
                'credit_id'         => $credit->id,
                'credit_payment_id' => $paymentRecord->id,
                'monto'             => $dineroDisponible,
                'origen'            => $source,
                'fecha_origen'      => $fecha,
                'estado'            => 'pendiente',
                'cedula'            => $cedulaRef ?? $credit->lead->cedula ?? null,
            ]);

            // Disparar asiento contable SALDO_SOBRANTE
            $this->triggerAccountingEntry(
                'SALDO_SOBRANTE',
                $dineroDisponible,
                "SOB-{$saldoPendiente->id}-{$credit->reference}",
                [
                    'credit_id'          => $credit->reference,
                    'cedula'             => $cedulaRef ?? $credit->lead->cedula ?? null,
                    'clienteNombre'      => $credit->lead->name ?? null,
                    'saldo_pendiente_id' => $saldoPendiente->id,
                    'amount_breakdown'   => [
                        'total'                  => $dineroDisponible,
                        'sobrante'               => $dineroDisponible,
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

        // Guardar detalles por cuota para posible reverso
        foreach ($paymentDetails as $detail) {
            $paymentRecord->details()->create($detail);
        }

        // Trazabilidad: asignar numero_documento (referencia contable) a las cuotas afectadas
        $refContable = "PAY-{$paymentRecord->id}-{$credit->reference}";
        $cuotaIdsAfectadas = array_column($paymentDetails, 'plan_de_pago_id');
        if (!empty($cuotaIdsAfectadas)) {
            PlanDePago::whereIn('id', $cuotaIdsAfectadas)
                ->update(['numero_documento' => $refContable]);
        }

        // ============================================================
        // ACCOUNTING_API_TRIGGER: Pago de Crédito (Específico por tipo)
        // ============================================================
        $interesMoratorio = array_sum(array_column($paymentDetails, 'pago_mora'));
        $interesVencido   = array_sum(array_column($paymentDetails, 'pago_int_vencido'));
        $interesCorriente = array_sum(array_column($paymentDetails, 'pago_int_corriente'));
        $poliza           = array_sum(array_column($paymentDetails, 'pago_poliza'));

        // sobrante contable: si se pasó explícitamente (-1 = no override), usar dineroDisponible
        $sobranteEnAsiento = round($sobranteContable >= 0 ? $sobranteContable : max(0.0, $dineroDisponible), 2);

        $context = [
            'reference' => "PAY-{$paymentRecord->id}-{$credit->reference}",
            'cedula' => $cedulaRef,
            'credit_id' => $credit->reference,
            'clienteNombre' => $credit->lead->name ?? null,
            'amount_breakdown' => [
                'total' => $montoEntrante,
                'interes_corriente' => $interesCorriente,
                'interes_moratorio' => $interesMoratorio,
                'poliza' => $poliza,
                'capital' => $capitalAmortizadoHoy,
                'sobrante' => $sobranteEnAsiento,
                'cargos_adicionales_total' => 0,
                'cargos_adicionales' => [],
            ],
        ];

        // Seleccionar trigger específico según el tipo de pago
        if ($source === 'Planilla') {
            $context['deductora_id'] = $credit->deductora_id;
            $context['deductora_nombre'] = $credit->deductora->nombre ?? 'Sin deductora';

            $this->triggerAccountingEntry(
                'PAGO_PLANILLA',
                $montoEntrante,
                $context['reference'],
                $context
            );
        } elseif ($source === 'Ventanilla') {
            $this->triggerAccountingEntry(
                'PAGO_VENTANILLA',
                $montoEntrante,
                $context['reference'],
                $context
            );
        } else {
            // Para otros tipos (Adelanto, Saldo Pendiente, etc.) usar ventanilla
            $this->triggerAccountingEntry(
                'PAGO_VENTANILLA',
                $montoEntrante,
                $context['reference'],
                $context
            );
        }

        return $paymentRecord;
    }

    /**
     * Wrapper público para que otros controllers puedan usar processPaymentTransaction
     */
    public function processPaymentTransactionPublic(Credit $credit, float $montoEntrante, $fecha, string $source, ?string $cedulaRef = null, $planillaUploadId = null): CreditPayment
    {
        return $this->processPaymentTransaction($credit, $montoEntrante, $fecha, $source, $cedulaRef, null, false, $planillaUploadId);
    }
}
