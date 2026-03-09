<?php

namespace App\Services;

use App\Models\Credit;
use App\Models\PlanDePago;
use Carbon\Carbon;

class PaymentHelperService
{
    /**
     * Lógica de Regeneración (Paso 3)
     * Borra y recrea las cuotas futuras basándose en el nuevo saldo.
     */
    public function regenerarProyeccion(Credit $credit, $strategy, $nuevoCapital, $startCuotaNum, $fechaPrimerVencimiento)
    {
        if($startCuotaNum < 1){
            $startCuotaNum = 1;
        }

        // Capturar el valor de póliza ANTES de borrar las cuotas (se definió al formalizar)
        $polizaOriginal = PlanDePago::where('credit_id', $credit->id)
            ->where('numero_cuota', '>=', $startCuotaNum)
            ->value('poliza') ?? 0;

        // 1. LIMPIEZA: Borramos el plan desde la cuota actual en adelante.
        PlanDePago::where('credit_id', $credit->id)
            ->where('numero_cuota', '>=', $startCuotaNum)
            ->delete();

        $tasaAnual = (float) $credit->tasa_anual;
        $tasaMensual = ($tasaAnual / 100) / 12;

        // Arrancamos un mes antes de la fecha de corte actual para sumar 1 mes en el bucle
        $fechaIteracion = Carbon::parse($fechaPrimerVencimiento)->subMonth();

        // --- ESTRATEGIA: REDUCIR CUOTA (Mantener Plazo) ---
        if ($strategy === 'reduce_amount') {

            // Cuántas cuotas faltaban originalmente
            $cuotasRestantes = $credit->plazo - $startCuotaNum + 1;
            if ($cuotasRestantes < 1) $cuotasRestantes = 1; // Protección mínima

            // Calculamos nueva cuota fija
            if ($tasaMensual > 0) {
                $potencia = pow(1 + $tasaMensual, $cuotasRestantes);
                $nuevaCuotaMonto = $nuevoCapital * ($tasaMensual * $potencia) / ($potencia - 1);
            } else {
                $nuevaCuotaMonto = $nuevoCapital / $cuotasRestantes;
            }
            $nuevaCuotaMonto = round($nuevaCuotaMonto, 2);

            // Actualizamos la cuota fija en la cabecera
            $credit->cuota = $nuevaCuotaMonto;
            $credit->save();

            $saldo = $nuevoCapital;

            for ($i = 0; $i < $cuotasRestantes; $i++) {
                $numeroReal = $startCuotaNum + $i;
                $fechaIteracion->addMonth();

                $interes = round($saldo * $tasaMensual, 2);

                if ($i == $cuotasRestantes - 1) {
                    $amortizacion = $saldo;
                    $cuotaFinal = $saldo + $interes;
                } else {
                    $amortizacion = $nuevaCuotaMonto - $interes;
                    $cuotaFinal = $nuevaCuotaMonto;
                }

                $nuevoSaldo = round($saldo - $amortizacion, 2);

                $this->crearCuota($credit->id, $numeroReal, $fechaIteracion, $tasaAnual, $cuotaFinal, $interes, $amortizacion, $saldo, $nuevoSaldo, $polizaOriginal);

                $saldo = $nuevoSaldo;
            }
        }

        // --- ESTRATEGIA: REDUCIR PLAZO (Mantener Cuota) ---
        elseif ($strategy === 'reduce_term') {

            $cuotaFijaActual = (float) $credit->cuota;

            // Safety check: Si la cuota vieja es inválida, calculamos una mínima
            $interesMinimo = $nuevoCapital * $tasaMensual;
            if ($cuotaFijaActual <= $interesMinimo) {
                $cuotaFijaActual = $interesMinimo + 1.00;
            }

            $saldo = $nuevoCapital;
            $contadorCuota = $startCuotaNum;
            $maxLoops = 360;
            $loops = 0;

            // Descontamos continuamente mes a mes hasta que saldo llegue a 0
            while ($saldo > 0.01 && $loops < $maxLoops) {
                $fechaIteracion->addMonth();
                $loops++;

                $interes = round($saldo * $tasaMensual, 2);
                $amortizacion = $cuotaFijaActual - $interes;

                // Validar: Si la amortización es negativa o cero, ajustar
                if ($amortizacion <= 0) {
                    // La cuota no alcanza para cubrir ni el interés - liquidar en esta cuota
                    $cuotaReal = $saldo + $interes;
                    $amortizacion = $saldo;
                    $nuevoSaldo = 0;
                } elseif ($saldo <= $amortizacion) {
                    $amortizacion = $saldo;
                    $cuotaReal = $saldo + $interes; // Última cuota ajustada
                    $nuevoSaldo = 0;
                } else {
                    $cuotaReal = $cuotaFijaActual;
                    $nuevoSaldo = round($saldo - $amortizacion, 2);
                }

                // Protección final: Si estamos cerca del límite y queda saldo residual, liquidarlo
                if ($loops >= $maxLoops - 1 && $nuevoSaldo > 0) {
                    $cuotaReal += $nuevoSaldo;
                    $amortizacion += $nuevoSaldo;
                    $nuevoSaldo = 0;
                }

                $this->crearCuota($credit->id, $contadorCuota, $fechaIteracion, $tasaAnual, $cuotaReal, $interes, $amortizacion, $saldo, $nuevoSaldo, $polizaOriginal);

                $saldo = $nuevoSaldo;
                $contadorCuota++;
            }

            // Actualizamos el plazo total del crédito
            $credit->plazo = $contadorCuota - 1;
            $credit->save();
        }
    }

    /**
     * Helper para crear el registro en la BD
     * $poliza: Monto de póliza por cuota (se mantiene desde la formalización)
     */
    public function crearCuota($creditId, $numero, $fecha, $tasa, $cuota, $interes, $amortizacion, $saldoAnt, $saldoNuevo, $poliza = 0)
    {
        PlanDePago::create([
            'credit_id'         => $creditId,
            'numero_cuota'      => $numero,
            'fecha_inicio'      => $fecha->copy()->subMonth(),
            'fecha_corte'       => $fecha->copy(),
            'tasa_actual'       => $tasa,
            'cuota'             => $cuota + $poliza,
            'poliza'            => $poliza,
            'interes_corriente' => $interes,
            'amortizacion'      => $amortizacion,
            'saldo_anterior'    => max(0, $saldoAnt),
            'saldo_nuevo'       => max(0, $saldoNuevo),
            'estado'            => 'Pendiente',
            'movimiento_total'  => 0,
            'movimiento_poliza' => 0,
            'movimiento_principal' => 0,
            'movimiento_interes_corriente' => 0,
            'movimiento_interes_moratorio' => 0
        ]);
    }

    /**
     * Verificar y actualizar el estado del crédito si ya no tiene cuotas en mora.
     * Helper para llamar después de cualquier operación que pueda resolver mora.
     */
    public function checkAndUpdateCreditStatus(Credit $credit): void
    {
        if ($credit->status === 'En Mora') {
            $tieneMora = $credit->planDePagos()
                ->where('numero_cuota', '>', 0)
                ->where('estado', 'Mora')
                ->exists();

            if (!$tieneMora) {
                $credit->status = 'Formalizado';
                $credit->save();
            }
        }
    }

    /**
     * Marcar un CreditPayment como anulado.
     */
    public function markPaymentAsAnulado(\App\Models\CreditPayment $payment, string $motivo): void
    {
        $payment->estado_reverso = 'Anulado';
        $payment->motivo_anulacion = $motivo;
        $payment->anulado_por = \Illuminate\Support\Facades\Auth::id();
        $payment->fecha_anulacion = now();
        $payment->save();
    }

    /**
     * Agrega una cuota al final del plan cuando una cuota entra en mora (desplazamiento)
     *
     * La cuota en mora no se pagó, así que su amortización no se aplicó al saldo.
     * Esta nueva cuota al final del plan cubre ese capital pendiente para que
     * el saldo llegue a 0 al terminar el plan extendido.
     *
     * @param Credit $credit El crédito
     * @param float $amortizacionOriginal La amortización que no se pagó en la cuota mora
     */
    public function agregarCuotaDesplazada(Credit $credit, float $amortizacionOriginal)
    {
        if ($amortizacionOriginal <= 0) return;

        $plazo = (int) $credit->plazo;
        $tasaAnual = (float) ($credit->tasa_anual ?? 0);
        $tasaMensual = $tasaAnual / 100 / 12;

        // 1. Incrementar saldo_nuevo de la última cuota del plazo original
        $credit->planDePagos()
            ->where('numero_cuota', $plazo)
            ->increment('saldo_nuevo', $amortizacionOriginal);

        // 2. Eliminar cuotas desplazadas anteriores (se van a regenerar)
        $credit->planDePagos()
            ->where('numero_cuota', '>', $plazo)
            ->delete();

        // 3. Obtener el total de capital desplazado
        $cuotaPlazo = $credit->planDePagos()
            ->where('numero_cuota', $plazo)
            ->first();

        $totalDesplazado = (float) $cuotaPlazo->saldo_nuevo;
        if ($totalDesplazado <= 0) return;

        // 4. Obtener cuota fija del crédito (de cualquier cuota normal)
        $cuotaNormal = $credit->planDePagos()
            ->where('numero_cuota', 1)
            ->first();
        $cuotaFija = (float) $cuotaNormal->cuota;

        // 5. Generar cuotas desplazadas con sistema francés
        $saldo = $totalDesplazado;
        $numero = $plazo + 1;
        $fechaBase = Carbon::parse($cuotaPlazo->fecha_corte);

        while ($saldo > 0.01) {
            $interes = round($saldo * $tasaMensual, 2);

            if ($saldo + $interes <= $cuotaFija) {
                // Última cuota: el saldo restante cabe en una sola cuota
                $amort = round($saldo, 2);
                $cuotaMonto = round($amort + $interes, 2);
            } else {
                // Cuota normal del mismo monto que las originales
                $cuotaMonto = $cuotaFija;
                $amort = round($cuotaFija - $interes, 2);
            }

            $saldoNuevo = round($saldo - $amort, 2);
            $saldoNuevo = max(0, $saldoNuevo);

            $fechaInicio = $fechaBase->copy();
            $fechaCorte = $fechaBase->copy()->addMonth();

            PlanDePago::create([
                'credit_id'         => $credit->id,
                'numero_cuota'      => $numero,
                'fecha_inicio'      => $fechaInicio,
                'fecha_corte'       => $fechaCorte,
                'tasa_actual'       => $tasaAnual,
                'cuota'             => $cuotaMonto,
                'poliza'            => 0,
                'interes_corriente' => $interes,
                'amortizacion'      => $amort,
                'saldo_anterior'    => $saldo,
                'saldo_nuevo'       => $saldoNuevo,
                'estado'            => 'Pendiente',
                'movimiento_total'  => 0,
                'movimiento_poliza' => 0,
                'movimiento_principal' => 0,
                'movimiento_interes_corriente' => 0,
                'movimiento_interes_moratorio' => 0,
            ]);

            $saldo = $saldoNuevo;
            $numero++;
            $fechaBase = $fechaCorte->copy();
        }
    }
}
