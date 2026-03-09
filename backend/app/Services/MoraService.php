<?php

namespace App\Services;

use App\Models\Credit;
use App\Models\PlanDePago;
use Carbon\Carbon;

class MoraService
{
    protected PaymentHelperService $helper;

    public function __construct(PaymentHelperService $helper)
    {
        $this->helper = $helper;
    }

    /**
     * Calcula mora para créditos formalizados de una deductora que NO están en la planilla
     */
    public function calcularMoraAusentes($deductoraId, $creditosQuePagaron, $mesPago, $diasDelMes, $tasaMora)
    {
        $moraResults = [];

        $creditosSinPago = Credit::whereIn('status', ['Formalizado', 'En Mora'])
            ->whereNotNull('formalized_at')
            ->whereNotIn('id', $creditosQuePagaron)
            ->where('deductora_id', $deductoraId)
            ->get();

        foreach ($creditosSinPago as $credit) {
            $moraResults[] = $this->aplicarMoraACuota($credit, $mesPago);
        }

        return $moraResults;
    }

    /**
     * Aplica mora e interés corriente vencido a la cuota pendiente más antigua de un crédito.
     * Lógica reutilizable desde planilla (calcularMoraAusentes) y desde carga manual (sin deductora).
     */
    public function aplicarMoraACuota(Credit $credit, Carbon $mesPago): array
    {
        // Buscar cuota pendiente más antigua
        $cuota = $credit->planDePagos()
            ->where('numero_cuota', '>', 0)
            ->where('estado', 'Pendiente')
            ->orderBy('numero_cuota')
            ->first();

        if (!$cuota) {
            return [
                'credit_id' => $credit->id,
                'lead' => $credit->lead->name ?? 'N/A',
                'status' => 'sin_cuotas_pendientes'
            ];
        }

        // Verificar si la cuota ya venció para este período usando fecha_corte real
        $fechaVencimiento = Carbon::parse($cuota->fecha_corte);
        if ($fechaVencimiento->startOfMonth()->gt($mesPago->copy()->endOfMonth())) {
            return [
                'credit_id' => $credit->id,
                'lead' => $credit->lead->name ?? 'N/A',
                'status' => 'muy_nuevo',
                'mensaje' => 'La cuota aún no vence en este período'
            ];
        }

        // Tasa congelada del crédito
        $tasaBase = (float) ($credit->tasa_anual ?? 0);
        $tasaMaxima = (float) ($credit->tasa_maxima ?? 0);
        $diferenciaTasa = $tasaMaxima - $tasaBase;

        // Guardar amortización original para la cuota desplazada
        $amortizacionOriginal = (float) $cuota->amortizacion;

        // Capital REAL del crédito (no el planificado)
        $capitalReal = (float) $credit->saldo;
        $tasaMensual = $tasaBase / 100 / 12;

        // 1. Interés vencido = calculado sobre el capital REAL (no el planificado)
        $interesVencido = round($capitalReal * $tasaMensual, 2);
        $cuota->int_corriente_vencido = $interesVencido;
        $cuota->interes_corriente = 0;

        // 2. Interés moratorio: solo si hay diferencia entre tasas
        if ($diferenciaTasa > 0) {
            $interesMoratorio = round($capitalReal * $diferenciaTasa / 100 / 12, 2);
            $cuota->interes_moratorio = ($cuota->interes_moratorio ?? 0) + $interesMoratorio;
        } else {
            $cuota->interes_moratorio = 0;
        }

        // 3. No se pagó: amortización = 0, capital no baja
        $cuota->amortizacion = 0;

        // 4. Capital (saldo_anterior) = capital REAL, no baja
        $cuota->saldo_anterior = $capitalReal;

        // 5. Saldo por pagar = saldo_nuevo de la cuota anterior + intereses de este mes
        $intMora = (float) $cuota->interes_moratorio;
        $poliza = (float) ($cuota->poliza ?? 0);

        $cuotaAnterior = $credit->planDePagos()
            ->where('numero_cuota', '<', $cuota->numero_cuota)
            ->where('numero_cuota', '>', 0)
            ->orderBy('numero_cuota', 'desc')
            ->first();

        $saldoPrevio = $cuotaAnterior ? (float) $cuotaAnterior->saldo_nuevo : $capitalReal;
        $cuota->saldo_nuevo = round($saldoPrevio + $interesVencido + $intMora + $poliza, 2);

        // 6. Marcar como Mora
        $cuota->estado = 'Mora';
        $cuota->dias_mora = 30;
        $cuota->save();

        // 7. Recalcular la SIGUIENTE cuota pendiente para que refleje el capital real
        $siguienteCuota = $credit->planDePagos()
            ->where('numero_cuota', '>', $cuota->numero_cuota)
            ->where('estado', 'Pendiente')
            ->orderBy('numero_cuota')
            ->first();

        if ($siguienteCuota) {
            $siguienteCuota->saldo_anterior = $capitalReal;
            $siguienteCuota->interes_corriente = $interesVencido;
            $siguienteCuota->amortizacion = round($siguienteCuota->cuota - $interesVencido - ($siguienteCuota->poliza ?? 0), 2);
            $siguienteCuota->saldo_nuevo = round($capitalReal - $siguienteCuota->amortizacion, 2);
            $siguienteCuota->save();
        }

        // 8. Agregar cuota desplazada al final del plan (con la amortización original)
        $this->helper->agregarCuotaDesplazada($credit, $amortizacionOriginal);

        // 9. Cambiar estado del crédito
        Credit::where('id', $credit->id)->update(['status' => 'En Mora']);

        return [
            'credit_id' => $credit->id,
            'lead' => $credit->lead->name ?? 'N/A',
            'cuota_numero' => $cuota->numero_cuota,
            'int_corriente_vencido' => $interesVencido,
            'tasa_base' => $tasaBase,
            'tasa_maxima' => $tasaMaxima,
            'diferencia_tasa' => $diferenciaTasa,
            'interes_moratorio' => (float) $cuota->interes_moratorio,
            'status' => 'mora_aplicada'
        ];
    }
}
