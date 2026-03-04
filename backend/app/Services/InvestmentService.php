<?php

namespace App\Services;

use App\Models\Investment;
use App\Models\InvestmentCoupon;
use App\Models\Investor;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class InvestmentService
{
    public function generateCoupons(Investment $investment): void
    {
        // Delete existing coupons before regenerating
        $investment->coupons()->delete();

        $fechaInicio = Carbon::parse($investment->fecha_inicio);
        $fechaVencimiento = Carbon::parse($investment->fecha_vencimiento);
        $montoCapital = (float) $investment->monto_capital;
        $tasaAnual = (float) $investment->tasa_anual;
        $formaPago = $investment->forma_pago;

        // Calculate interval in months
        $mesesIntervalo = match ($formaPago) {
            'MENSUAL' => 1,
            'TRIMESTRAL' => 3,
            'SEMESTRAL' => 6,
            'ANUAL' => 12,
            'RESERVA' => 1,
            default => 1,
        };

        $interesMensual = round($montoCapital * $tasaAnual / 12, 2);
        $interesCupon = round($interesMensual * $mesesIntervalo, 2);
        $retencion = round($interesCupon * 0.15, 2);
        $interesNeto = round($interesCupon - $retencion, 2);

        $estadoCupon = $formaPago === 'RESERVA' ? 'Reservado' : 'Pendiente';
        $montoReservado = $formaPago === 'RESERVA' ? $interesNeto : 0;

        $fechaCupon = $fechaInicio->copy()->addMonths($mesesIntervalo);
        $coupons = [];
        $now = now();

        while ($fechaCupon->lte($fechaVencimiento)) {
            $coupons[] = [
                'investment_id' => $investment->id,
                'fecha_cupon' => $fechaCupon->toDateString(),
                'interes_bruto' => $interesCupon,
                'retencion' => $retencion,
                'interes_neto' => $interesNeto,
                'monto_reservado' => $montoReservado,
                'estado' => $estadoCupon,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            $fechaCupon->addMonths($mesesIntervalo);
        }

        // Bulk insert for performance
        if (!empty($coupons)) {
            InvestmentCoupon::insert($coupons);
        }
    }

    public function recalculateCoupons(Investment $investment): void
    {
        // Delete future unpaid coupons and regenerate
        $investment->coupons()
            ->where('estado', '!=', 'Pagado')
            ->where('fecha_cupon', '>', now())
            ->delete();

        $montoCapital = (float) $investment->monto_capital;
        $tasaAnual = (float) $investment->tasa_anual;
        $formaPago = $investment->forma_pago;
        $fechaVencimiento = Carbon::parse($investment->fecha_vencimiento);

        $mesesIntervalo = match ($formaPago) {
            'MENSUAL' => 1,
            'TRIMESTRAL' => 3,
            'SEMESTRAL' => 6,
            'ANUAL' => 12,
            'RESERVA' => 1,
            default => 1,
        };

        $interesMensual = round($montoCapital * $tasaAnual / 12, 2);
        $interesCupon = round($interesMensual * $mesesIntervalo, 2);
        $retencion = round($interesCupon * 0.15, 2);
        $interesNeto = round($interesCupon - $retencion, 2);

        $estadoCupon = $formaPago === 'RESERVA' ? 'Reservado' : 'Pendiente';
        $montoReservado = $formaPago === 'RESERVA' ? $interesNeto : 0;

        // Find next coupon date after the last existing coupon
        $lastCoupon = $investment->coupons()->orderBy('fecha_cupon', 'desc')->first();
        $nextDate = $lastCoupon
            ? Carbon::parse($lastCoupon->fecha_cupon)->addMonths($mesesIntervalo)
            : now()->startOfMonth()->addMonth();

        $coupons = [];
        $now = now();

        while ($nextDate->lte($fechaVencimiento)) {
            $coupons[] = [
                'investment_id' => $investment->id,
                'fecha_cupon' => $nextDate->toDateString(),
                'interes_bruto' => $interesCupon,
                'retencion' => $retencion,
                'interes_neto' => $interesNeto,
                'monto_reservado' => $montoReservado,
                'estado' => $estadoCupon,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            $nextDate->addMonths($mesesIntervalo);
        }

        if (!empty($coupons)) {
            InvestmentCoupon::insert($coupons);
        }
    }

    public function markCouponAsPaid(InvestmentCoupon $coupon, ?string $fechaPago = null): InvestmentCoupon
    {
        $coupon->update([
            'estado' => 'Pagado',
            'fecha_pago' => $fechaPago ?? now()->toDateString(),
        ]);

        return $coupon;
    }

    public function liquidateEarly(Investment $investment): Investment
    {
        DB::transaction(function () use ($investment) {
            // Mark remaining coupons as paid
            $investment->coupons()
                ->where('estado', 'Pendiente')
                ->update(['estado' => 'Pagado', 'fecha_pago' => now()->toDateString()]);

            $investment->update(['estado' => 'Liquidada']);
        });

        return $investment->fresh();
    }

    public function renewInvestment(Investment $investment, array $newTerms): Investment
    {
        return DB::transaction(function () use ($investment, $newTerms) {
            // Finalize old investment
            $investment->update(['estado' => 'Finalizada']);

            // Create new investment with new terms
            $newInvestment = Investment::create(array_merge([
                'investor_id' => $investment->investor_id,
                'monto_capital' => $investment->monto_capital,
                'moneda' => $investment->moneda,
                'forma_pago' => $investment->forma_pago,
                'tasa_anual' => $investment->tasa_anual,
                'es_capitalizable' => $investment->es_capitalizable,
            ], $newTerms));

            $this->generateCoupons($newInvestment);

            return $newInvestment;
        });
    }

    public function getSummaryByInvestor(Investor $investor): array
    {
        $investments = $investor->investments()->with('coupons')->get();

        $totalCrc = 0;
        $totalUsd = 0;
        $totalInteresPagadoCrc = 0;
        $totalInteresPagadoUsd = 0;

        foreach ($investments as $inv) {
            if ($inv->moneda === 'CRC') {
                $totalCrc += (float) $inv->monto_capital;
                $totalInteresPagadoCrc += $inv->coupons->where('estado', 'Pagado')->sum('interes_neto');
            } else {
                $totalUsd += (float) $inv->monto_capital;
                $totalInteresPagadoUsd += $inv->coupons->where('estado', 'Pagado')->sum('interes_neto');
            }
        }

        return [
            'investor' => $investor,
            'investments' => $investments,
            'total_capital_crc' => $totalCrc,
            'total_capital_usd' => $totalUsd,
            'total_interes_pagado_crc' => $totalInteresPagadoCrc,
            'total_interes_pagado_usd' => $totalInteresPagadoUsd,
        ];
    }

    public function getTablaGeneral(): array
    {
        $investments = Investment::with('investor:id,name')->where('estado', 'Activa')->get();

        $dolares = $investments->where('moneda', 'USD')->values();
        $colones = $investments->where('moneda', 'CRC')->values();

        return [
            'dolares' => [
                'inversiones' => $dolares,
                'total_capital' => $dolares->sum('monto_capital'),
                'total_interes_mensual' => $dolares->sum(fn ($i) => $i->interes_mensual),
                'total_retencion' => $dolares->sum(fn ($i) => $i->retencion_mensual),
                'total_neto' => $dolares->sum(fn ($i) => $i->interes_neto_mensual),
            ],
            'colones' => [
                'inversiones' => $colones,
                'total_capital' => $colones->sum('monto_capital'),
                'total_interes_mensual' => $colones->sum(fn ($i) => $i->interes_mensual),
                'total_retencion' => $colones->sum(fn ($i) => $i->retencion_mensual),
                'total_neto' => $colones->sum(fn ($i) => $i->interes_neto_mensual),
            ],
        ];
    }
}
