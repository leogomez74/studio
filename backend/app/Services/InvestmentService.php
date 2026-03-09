<?php

namespace App\Services;

use App\Models\Investment;
use App\Models\InvestmentCoupon;
use App\Models\InvestmentPayment;
use App\Models\Investor;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class InvestmentService
{
    public function generateCoupons(Investment $investment): void
    {
        // Delete existing coupons before regenerating
        $investment->coupons()->delete();

        $this->buildCoupons($investment, Carbon::parse($investment->fecha_inicio), (float) $investment->monto_capital);
    }

    public function recalculateCoupons(Investment $investment): void
    {
        // Eliminar TODOS los cupones no pagados (pasados y futuros)
        $investment->coupons()
            ->where('estado', '!=', 'Pagado')
            ->delete();

        $mesesIntervalo = $this->getMesesIntervalo($investment->forma_pago);

        // Regenerar desde el último cupón pagado o desde fecha_inicio
        $lastPaidCoupon = $investment->coupons()
            ->where('estado', 'Pagado')
            ->orderBy('fecha_cupon', 'desc')
            ->first();

        $startDate = $lastPaidCoupon
            ? Carbon::parse($lastPaidCoupon->fecha_cupon)
            : Carbon::parse($investment->fecha_inicio);

        // Para capitalizable, el capital acumulado parte del último cupón pagado
        $capitalInicial = (float) $investment->monto_capital;
        if ($investment->es_capitalizable && $lastPaidCoupon && $lastPaidCoupon->capital_acumulado) {
            $capitalInicial = (float) $lastPaidCoupon->capital_acumulado;
        }

        $this->buildCoupons($investment, $startDate, $capitalInicial);
    }

    private function getMesesIntervalo(string $formaPago): int
    {
        return match ($formaPago) {
            'MENSUAL' => 1,
            'TRIMESTRAL' => 3,
            'SEMESTRAL' => 6,
            'ANUAL' => 12,
            'RESERVA' => 1,
            default => 1,
        };
    }

    private function buildCoupons(Investment $investment, Carbon $startDate, float $capitalInicial): void
    {
        $fechaVencimiento = Carbon::parse($investment->fecha_vencimiento);
        $tasaAnual = (float) $investment->tasa_anual;
        $tasaRetencion = (float) $investment->tasa_retencion;
        $formaPago = $investment->forma_pago;
        $esCapitalizable = (bool) $investment->es_capitalizable;

        $mesesIntervalo = $this->getMesesIntervalo($formaPago);

        $estadoCupon = ($formaPago === 'RESERVA' || $esCapitalizable) ? 'Reservado' : 'Pendiente';

        $fechaCupon = $startDate->copy()->addMonths($mesesIntervalo);
        $coupons = [];
        $now = now();
        $capitalActual = $capitalInicial;

        // El interés del cupón es siempre el interés mensual (capital * tasa / 12)
        $interesMensual = round($capitalInicial * $tasaAnual / 12, 2);
        $retencion = round($interesMensual * $tasaRetencion, 2);
        $interesNeto = round($interesMensual - $retencion, 2);

        while ($fechaCupon->lte($fechaVencimiento)) {
            $montoReservado = ($formaPago === 'RESERVA' || $esCapitalizable) ? $interesNeto : 0;

            // Para capitalizable, el interés neto se suma al capital acumulado (tracking)
            if ($esCapitalizable) {
                $capitalActual = round($capitalActual + $interesNeto, 2);
            }

            $coupons[] = [
                'investment_id' => $investment->id,
                'fecha_cupon' => $fechaCupon->toDateString(),
                'interes_bruto' => $interesMensual,
                'retencion' => $retencion,
                'interes_neto' => $interesNeto,
                'monto_reservado' => $montoReservado,
                'capital_acumulado' => $esCapitalizable ? $capitalActual : null,
                'estado' => $estadoCupon,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            $fechaCupon->addMonths($mesesIntervalo);
        }

        if (!empty($coupons)) {
            InvestmentCoupon::insert($coupons);
        }
    }

    public function markCouponAsPaid(InvestmentCoupon $coupon, ?string $fechaPago = null, ?string $comprobantePath = null): InvestmentCoupon
    {
        // Validate sequential payment: all prior coupons must be paid
        $unpaidBefore = InvestmentCoupon::where('investment_id', $coupon->investment_id)
            ->where('fecha_cupon', '<', $coupon->fecha_cupon)
            ->where('estado', 'Pendiente')
            ->exists();

        if ($unpaidBefore) {
            abort(422, 'No se puede pagar este cupón porque existen cupones anteriores pendientes de pago.');
        }

        $fechaPago = $fechaPago ?? now()->toDateString();

        $updateData = [
            'estado' => 'Pagado',
            'fecha_pago' => $fechaPago,
        ];

        if ($comprobantePath) {
            $updateData['comprobante'] = $comprobantePath;
        }

        $coupon->update($updateData);

        $investment = $coupon->investment;

        InvestmentPayment::create([
            'investor_id' => $investment->investor_id,
            'investment_id' => $investment->id,
            'fecha_pago' => $fechaPago,
            'monto' => $coupon->interes_neto,
            'tipo' => 'Interés',
            'moneda' => $investment->moneda,
        ]);

        return $coupon;
    }

    /**
     * Corregir el monto real pagado de un cupón.
     * Si la inversión es capitalizable, recalcula los cupones posteriores no pagados.
     */
    public function correctCoupon(InvestmentCoupon $coupon, float $montoPagadoReal, string $motivo): InvestmentCoupon
    {
        return DB::transaction(function () use ($coupon, $montoPagadoReal, $motivo) {
            $coupon->update([
                'monto_pagado_real' => $montoPagadoReal,
                'motivo_correccion' => $motivo,
            ]);

            // Actualizar el InvestmentPayment correspondiente
            $investment = $coupon->investment;
            if ($coupon->estado === 'Pagado' && $coupon->fecha_pago) {
                InvestmentPayment::where('investment_id', $investment->id)
                    ->where('tipo', 'Interés')
                    ->where('fecha_pago', $coupon->fecha_pago)
                    ->where('monto', '!=', $montoPagadoReal)
                    ->orderBy('created_at', 'desc')
                    ->limit(1)
                    ->update(['monto' => $montoPagadoReal]);
            }

            // Si es capitalizable, recalcular cupones posteriores no pagados
            if ($investment->es_capitalizable) {
                $this->recalculateCouponsAfterCorrection($investment);
            }

            return $coupon->fresh();
        });
    }

    /**
     * Recalcular cupones no pagados considerando montos reales pagados en cupones anteriores.
     */
    private function recalculateCouponsAfterCorrection(Investment $investment): void
    {
        $tasaAnual = (float) $investment->tasa_anual;
        $tasaRetencion = (float) $investment->tasa_retencion;
        $mesesIntervalo = $this->getMesesIntervalo($investment->forma_pago);
        $fechaVencimiento = Carbon::parse($investment->fecha_vencimiento);

        // Obtener todos los cupones pagados ordenados
        $paidCoupons = $investment->coupons()
            ->where('estado', 'Pagado')
            ->orderBy('fecha_cupon')
            ->get();

        // Calcular el capital acumulado real considerando montos corregidos
        $capitalActual = (float) $investment->monto_capital;
        foreach ($paidCoupons as $paid) {
            $montoEfectivo = $paid->monto_pagado_real !== null
                ? (float) $paid->monto_pagado_real
                : (float) $paid->interes_neto;
            $capitalActual = round($capitalActual + $montoEfectivo, 2);
        }

        // Eliminar cupones no pagados
        $investment->coupons()
            ->where('estado', '!=', 'Pagado')
            ->delete();

        // Regenerar desde el último cupón pagado
        $lastPaidCoupon = $paidCoupons->last();
        $startDate = $lastPaidCoupon
            ? Carbon::parse($lastPaidCoupon->fecha_cupon)
            : Carbon::parse($investment->fecha_inicio);

        // Actualizar capital_acumulado del último cupón pagado
        if ($lastPaidCoupon) {
            $lastPaidCoupon->update(['capital_acumulado' => $capitalActual]);
        }

        $estadoCupon = ($investment->forma_pago === 'RESERVA' || $investment->es_capitalizable) ? 'Reservado' : 'Pendiente';
        $fechaCupon = $startDate->copy()->addMonths($mesesIntervalo);
        $coupons = [];
        $now = now();

        // El interés del cupón es siempre el interés mensual (capital * tasa / 12)
        $capitalOriginal = (float) $investment->monto_capital;
        $interesMensual = round($capitalOriginal * $tasaAnual / 12, 2);
        $retencion = round($interesMensual * $tasaRetencion, 2);
        $interesNeto = round($interesMensual - $retencion, 2);

        while ($fechaCupon->lte($fechaVencimiento)) {
            $montoReservado = ($investment->forma_pago === 'RESERVA' || $investment->es_capitalizable) ? $interesNeto : 0;

            $capitalActual = round($capitalActual + $interesNeto, 2);

            $coupons[] = [
                'investment_id' => $investment->id,
                'fecha_cupon' => $fechaCupon->toDateString(),
                'interes_bruto' => $interesMensual,
                'retencion' => $retencion,
                'interes_neto' => $interesNeto,
                'monto_reservado' => $montoReservado,
                'capital_acumulado' => $capitalActual,
                'estado' => $estadoCupon,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            $fechaCupon->addMonths($mesesIntervalo);
        }

        if (!empty($coupons)) {
            InvestmentCoupon::insert($coupons);
        }
    }

    public function liquidateEarly(Investment $investment): Investment
    {
        DB::transaction(function () use ($investment) {
            // Mark remaining coupons as paid (Pendiente y Reservado)
            $investment->coupons()
                ->whereIn('estado', ['Pendiente', 'Reservado'])
                ->update(['estado' => 'Pagado', 'fecha_pago' => now()->toDateString()]);

            $investment->update(['estado' => 'Liquidada']);
        });

        return $investment->fresh();
    }

    public function renewInvestment(Investment $investment, array $newTerms): Investment
    {
        return DB::transaction(function () use ($investment, $newTerms) {
            // Finalize old investment as Renovada
            $investment->update(['estado' => 'Renovada']);

            // Create new investment with new terms, linking to origin
            $newInvestment = Investment::create(array_merge([
                'numero_desembolso' => 'TMP',
                'investor_id' => $investment->investor_id,
                'monto_capital' => $investment->monto_capital,
                'moneda' => $investment->moneda,
                'forma_pago' => $investment->forma_pago,
                'tasa_anual' => $investment->tasa_anual,
                'es_capitalizable' => $investment->es_capitalizable,
                'investment_origen_id' => $investment->id,
            ], $newTerms));
            $suffix = $newInvestment->moneda === 'USD' ? 'D' : 'C';
            $newInvestment->update(['numero_desembolso' => $newInvestment->id . '-' . $suffix]);

            $this->generateCoupons($newInvestment);

            return $newInvestment;
        });
    }

    public function previewCoupons(array $params): array
    {
        $montoCapital = (float) $params['monto_capital'];
        $tasaAnual = (float) $params['tasa_anual'];
        $formaPago = $params['forma_pago'];
        $esCapitalizable = (bool) ($params['es_capitalizable'] ?? false);
        $tasaRetencion = (float) ($params['tasa_retencion'] ?? 0.15);
        $fechaInicio = Carbon::parse($params['fecha_inicio']);
        $plazoMeses = (int) $params['plazo_meses'];
        $fechaVencimiento = $fechaInicio->copy()->addMonths($plazoMeses);

        $mesesIntervalo = $this->getMesesIntervalo($formaPago);
        $estadoCupon = ($formaPago === 'RESERVA' || $esCapitalizable) ? 'Reservado' : 'Pendiente';

        $fechaCupon = $fechaInicio->copy()->addMonths($mesesIntervalo);
        $coupons = [];
        $capitalActual = $montoCapital;
        $num = 1;

        // El interés del cupón es siempre el interés mensual (capital * tasa / 12)
        $interesMensual = round($montoCapital * $tasaAnual / 12, 2);
        $retencion = round($interesMensual * $tasaRetencion, 2);
        $interesNeto = round($interesMensual - $retencion, 2);

        while ($fechaCupon->lte($fechaVencimiento)) {
            $montoReservado = ($formaPago === 'RESERVA' || $esCapitalizable) ? $interesNeto : 0;

            if ($esCapitalizable) {
                $capitalActual = round($capitalActual + $interesNeto, 2);
            }

            $coupons[] = [
                'numero' => $num++,
                'fecha_cupon' => $fechaCupon->toDateString(),
                'interes_bruto' => $interesMensual,
                'retencion' => $retencion,
                'interes_neto' => $interesNeto,
                'monto_reservado' => $montoReservado,
                'capital_acumulado' => $esCapitalizable ? $capitalActual : null,
                'estado' => $estadoCupon,
            ];
            $fechaCupon->addMonths($mesesIntervalo);
        }

        return $coupons;
    }

    public function getSummaryByInvestor(Investor $investor): array
    {
        $investments = $investor->investments()->with('coupons')->get();

        $totalCrc = 0;
        $totalUsd = 0;
        $capitalActivoCrc = 0;
        $capitalActivoUsd = 0;
        $totalInteresPagadoCrc = 0;
        $totalInteresPagadoUsd = 0;

        foreach ($investments as $inv) {
            $capital = (float) $inv->monto_capital;
            $interesPagado = $inv->coupons->where('estado', 'Pagado')->sum('interes_neto');

            if ($inv->moneda === 'CRC') {
                $totalCrc += $capital;
                $totalInteresPagadoCrc += $interesPagado;
                if ($inv->estado === 'Activa') {
                    $capitalActivoCrc += $capital;
                }
            } else {
                $totalUsd += $capital;
                $totalInteresPagadoUsd += $interesPagado;
                if ($inv->estado === 'Activa') {
                    $capitalActivoUsd += $capital;
                }
            }
        }

        return [
            'investor' => $investor,
            'investments' => $investments,
            'total_capital_crc' => $totalCrc,
            'total_capital_usd' => $totalUsd,
            'capital_activo_crc' => $capitalActivoCrc,
            'capital_activo_usd' => $capitalActivoUsd,
            'total_interes_pagado_crc' => $totalInteresPagadoCrc,
            'total_interes_pagado_usd' => $totalInteresPagadoUsd,
        ];
    }

    public function calcularReserva(Investment $investment): array
    {
        $interesesAdeudados = (float) $investment->coupons()
            ->whereIn('estado', ['Pendiente', 'Reservado'])
            ->sum('interes_neto');

        $montoCapital = (float) $investment->monto_capital;
        $capitalMasIntereses = $montoCapital + $interesesAdeudados;

        $fechaVencimiento = Carbon::parse($investment->fecha_vencimiento);
        $plazoRestante = max(1, (int) ceil(Carbon::now()->diffInMonths($fechaVencimiento, false)));

        // Si ya venció, plazo restante = 1 para evitar división por 0
        if ($fechaVencimiento->isPast()) {
            $plazoRestante = 1;
        }

        $reservaMensual = round($capitalMasIntereses / $plazoRestante, 2);
        $interesNetoMensual = (float) $investment->interes_neto_mensual;
        $reservaCapital = round($reservaMensual - $interesNetoMensual, 2);

        return [
            'intereses_adeudados' => round($interesesAdeudados, 2),
            'capital_mas_intereses' => round($capitalMasIntereses, 2),
            'plazo_restante_meses' => $plazoRestante,
            'reserva_mensual' => $reservaMensual,
            'reserva_capital' => $reservaCapital,
        ];
    }

    public function getReservas(): array
    {
        $investments = Investment::with(['investor:id,name', 'coupons'])
            ->where('estado', 'Activa')
            ->get();

        $byInvestor = $investments->groupBy('investor_id');

        $granTotalCrc = ['reserva_mensual' => 0, 'reserva_capital' => 0];
        $granTotalUsd = ['reserva_mensual' => 0, 'reserva_capital' => 0];

        $inversores = $byInvestor->map(function ($invs) use (&$granTotalCrc, &$granTotalUsd) {
            $investor = $invs->first()->investor;
            $totalesCrc = ['reserva_mensual' => 0, 'reserva_capital' => 0];
            $totalesUsd = ['reserva_mensual' => 0, 'reserva_capital' => 0];

            $inversiones = $invs->map(function ($inv) use (&$totalesCrc, &$totalesUsd) {
                $reserva = $this->calcularReserva($inv);
                $bucket = $inv->moneda === 'CRC' ? 'crc' : 'usd';

                if ($bucket === 'crc') {
                    $totalesCrc['reserva_mensual'] += $reserva['reserva_mensual'];
                    $totalesCrc['reserva_capital'] += $reserva['reserva_capital'];
                } else {
                    $totalesUsd['reserva_mensual'] += $reserva['reserva_mensual'];
                    $totalesUsd['reserva_capital'] += $reserva['reserva_capital'];
                }

                return [
                    'id' => $inv->id,
                    'numero_desembolso' => $inv->numero_desembolso,
                    'moneda' => $inv->moneda,
                    'monto_capital' => $inv->monto_capital,
                    'tasa_anual' => $inv->tasa_anual,
                    'fecha_vencimiento' => $inv->fecha_vencimiento,
                    'reserva' => $reserva,
                ];
            })->values();

            $granTotalCrc['reserva_mensual'] += $totalesCrc['reserva_mensual'];
            $granTotalCrc['reserva_capital'] += $totalesCrc['reserva_capital'];
            $granTotalUsd['reserva_mensual'] += $totalesUsd['reserva_mensual'];
            $granTotalUsd['reserva_capital'] += $totalesUsd['reserva_capital'];

            return [
                'investor' => $investor,
                'inversiones' => $inversiones,
                'totales' => [
                    'crc' => ['reserva_mensual' => round($totalesCrc['reserva_mensual'], 2), 'reserva_capital' => round($totalesCrc['reserva_capital'], 2)],
                    'usd' => ['reserva_mensual' => round($totalesUsd['reserva_mensual'], 2), 'reserva_capital' => round($totalesUsd['reserva_capital'], 2)],
                ],
            ];
        })->values();

        $tipoCambio = (float) config('services.inversiones.tipo_cambio_usd', 500);

        return [
            'inversores' => $inversores,
            'gran_total' => [
                'crc' => ['reserva_mensual' => round($granTotalCrc['reserva_mensual'], 2), 'reserva_capital' => round($granTotalCrc['reserva_capital'], 2)],
                'usd' => ['reserva_mensual' => round($granTotalUsd['reserva_mensual'], 2), 'reserva_capital' => round($granTotalUsd['reserva_capital'], 2)],
            ],
            'tipo_cambio' => $tipoCambio,
            'consolidado_crc' => [
                'reserva_mensual' => round($granTotalCrc['reserva_mensual'] + ($granTotalUsd['reserva_mensual'] * $tipoCambio), 2),
                'reserva_capital' => round($granTotalCrc['reserva_capital'] + ($granTotalUsd['reserva_capital'] * $tipoCambio), 2),
            ],
        ];
    }

    public function getTablaGeneral(): array
    {
        $investments = Investment::with('investor:id,name')->where('estado', 'Activa')->get();

        $dolares = $investments->where('moneda', 'USD')->values();
        $colones = $investments->where('moneda', 'CRC')->values();

        $tipoCambio = (float) config('services.inversiones.tipo_cambio_usd', 500);

        $totalCapitalUsd = $dolares->sum('monto_capital');
        $totalNetoUsd = $dolares->sum(fn ($i) => $i->interes_neto_mensual);
        $totalCapitalCrc = $colones->sum('monto_capital');
        $totalNetoCrc = $colones->sum(fn ($i) => $i->interes_neto_mensual);

        return [
            'dolares' => [
                'inversiones' => $dolares,
                'total_capital' => $totalCapitalUsd,
                'total_interes_mensual' => $dolares->sum(fn ($i) => $i->interes_mensual),
                'total_retencion' => $dolares->sum(fn ($i) => $i->retencion_mensual),
                'total_neto' => $totalNetoUsd,
            ],
            'colones' => [
                'inversiones' => $colones,
                'total_capital' => $totalCapitalCrc,
                'total_interes_mensual' => $colones->sum(fn ($i) => $i->interes_mensual),
                'total_retencion' => $colones->sum(fn ($i) => $i->retencion_mensual),
                'total_neto' => $totalNetoCrc,
            ],
            'tipo_cambio' => $tipoCambio,
            'consolidado_crc' => [
                'total_capital' => round($totalCapitalCrc + ($totalCapitalUsd * $tipoCambio), 2),
                'total_neto' => round($totalNetoCrc + ($totalNetoUsd * $tipoCambio), 2),
            ],
        ];
    }
}
