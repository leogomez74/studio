<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InvestmentCoupon;
use App\Models\InvestmentPayment;
use App\Models\Investment;
use App\Services\InvestmentService;
use Illuminate\Http\Request;
use App\Traits\LogsActivity;

class InvestmentCouponController extends Controller
{
    use LogsActivity;
    public function __construct(private InvestmentService $service) {}

    public function index(int $id)
    {
        $investment = Investment::findOrFail($id);
        $coupons = $investment->coupons()->orderBy('fecha_cupon')->get();
        return response()->json($coupons);
    }

    public function markPaid(Request $request, int $id)
    {
        $coupon = InvestmentCoupon::findOrFail($id);

        $validated = $request->validate([
            'fecha_pago' => 'nullable|date',
            'comprobante' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
        ]);

        $comprobantePath = null;
        if ($request->hasFile('comprobante')) {
            $comprobantePath = $request->file('comprobante')->store('comprobantes/inversiones', 'public');
        }

        $this->service->markCouponAsPaid($coupon, $validated['fecha_pago'] ?? null, $comprobantePath);
        $this->logActivity('mark_paid', 'Cupones Inversión', $coupon, 'Cupón #' . $coupon->id, [], $request);
        return response()->json($coupon->fresh());
    }

    public function correct(Request $request, int $id)
    {
        $coupon = InvestmentCoupon::findOrFail($id);

        $validated = $request->validate([
            'monto_pagado_real' => 'required|numeric|min:0',
            'motivo_correccion' => 'required|string|max:500',
        ]);

        $coupon = $this->service->correctCoupon(
            $coupon,
            (float) $validated['monto_pagado_real'],
            $validated['motivo_correccion']
        );

        $this->logActivity('correct', 'Cupones Inversión', $coupon, 'Cupón #' . $coupon->id, [], $request);

        // Return the full investment with updated coupons
        $investment = $coupon->investment->load('coupons');
        return response()->json($investment);
    }

    public function markBulkPaid(Request $request)
    {
        $validated = $request->validate([
            'coupon_ids' => 'required|array',
            'coupon_ids.*' => 'exists:investment_coupons,id',
            'fecha_pago' => 'nullable|date',
        ]);

        $fechaPago = $validated['fecha_pago'] ?? now()->toDateString();

        $coupons = InvestmentCoupon::with('investment')
            ->whereIn('id', $validated['coupon_ids'])
            ->where('estado', '!=', 'Pagado')
            ->get();

        $updated = $coupons->count();

        if ($updated > 0) {
            InvestmentCoupon::whereIn('id', $coupons->pluck('id'))
                ->update(['estado' => 'Pagado', 'fecha_pago' => $fechaPago]);

            $payments = $coupons->map(fn (InvestmentCoupon $coupon) => [
                'investor_id' => $coupon->investment->investor_id,
                'investment_id' => $coupon->investment_id,
                'fecha_pago' => $fechaPago,
                'monto' => $coupon->interes_neto,
                'tipo' => 'Interés',
                'moneda' => $coupon->investment->moneda,
                'created_at' => now(),
                'updated_at' => now(),
            ])->toArray();

            InvestmentPayment::insert($payments);
        }

        $this->logActivity('bulk_mark_paid', 'Cupones Inversión', null, 'Bulk: ' . $updated, [], $request);

        return response()->json(['message' => 'Cupones marcados como pagados', 'count' => $updated]);
    }
}
