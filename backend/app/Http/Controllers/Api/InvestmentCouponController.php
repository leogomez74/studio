<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InvestmentCoupon;
use App\Models\InvestmentPayment;
use App\Models\Investment;
use App\Services\InvestmentService;
use Illuminate\Http\Request;

class InvestmentCouponController extends Controller
{
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
        ]);

        $this->service->markCouponAsPaid($coupon, $validated['fecha_pago'] ?? null);
        return response()->json($coupon);
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

        return response()->json(['message' => 'Cupones marcados como pagados', 'count' => $updated]);
    }
}
