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
        // Eliminar TODOS los cupones no pagados (pasados y futuros)
        $investment->coupons()
            ->where('estado', '!=', 'Pagado')
            ->delete();

        $montoCapital = (float) $investment->monto_capital;
        $tasaAnual = (float) $investment->tasa_anual;
        $formaPago = $investment->forma_pago;
        $fechaInicio = Carbon::parse($investment->fecha_inicio);
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

        // Regenerar desde el último cupón pagado o desde fecha_inicio
        $lastPaidCoupon = $investment->coupons()
            ->where('estado', 'Pagado')
            ->orderBy('fecha_cupon', 'desc')
            ->first();

        $nextDate = $lastPaidCoupon
            ? Carbon::parse($lastPaidCoupon->fecha_cupon)->addMonths($mesesIntervalo)
            : $fechaInicio->copy()->addMonths($mesesIntervalo);

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
        $fechaPago = $fechaPago ?? now()->toDateString();

        $coupon->update([
            'estado' => 'Pagado',
            'fecha_pago' => $fechaPago,
        ]);

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
            // Finalize old investment
            $investment->update(['estado' => 'Finalizada']);

            // Create new investment with new terms
            $newInvestment = Investment::create(array_merge([
                'numero_desembolso' => 'TMP',
                'investor_id' => $investment->investor_id,
                'monto_capital' => $investment->monto_capital,
                'moneda' => $investment->moneda,
                'forma_pago' => $investment->forma_pago,
                'tasa_anual' => $investment->tasa_anual,
                'es_capitalizable' => $investment->es_capitalizable,
            ], $newTerms));
            $suffix = $newInvestment->moneda === 'USD' ? 'D' : 'C';
            $newInvestment->update(['numero_desembolso' => $newInvestment->id . '-' . $suffix]);

            $this->generateCoupons($newInvestment);

            return $newInvestment;
        });
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
