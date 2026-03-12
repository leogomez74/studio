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
        $coupon = InvestmentCoupon::with('investment')->findOrFail($id);

        if (! in_array($coupon->investment->estado, ['Activa', 'Capital Devuelto'])) {
            return response()->json(['message' => 'Solo se pueden pagar cupones de inversiones activas o con capital devuelto.'], 422);
        }

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
            ->whereHas('investment', fn ($q) => $q->whereIn('estado', ['Activa', 'Capital Devuelto']))
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
                'periodo' => $coupon->fecha_cupon,
                'created_at' => now(),
                'updated_at' => now(),
            ])->toArray();

            InvestmentPayment::insert($payments);

            // Auto-finalizar inversiones 'Capital Devuelto' sin cupones pendientes
            $investmentIds = $coupons->pluck('investment_id')->unique();
            Investment::whereIn('id', $investmentIds)
                ->where('estado', 'Capital Devuelto')
                ->get()
                ->each(function (Investment $inv) {
                    $hasPending = $inv->coupons()->whereIn('estado', ['Pendiente', 'Reservado'])->exists();
                    if (! $hasPending) {
                        $inv->update(['estado' => 'Finalizada']);
                    }
                });
        }

        $this->logActivity('bulk_mark_paid', 'Cupones Inversión', null, 'Bulk: ' . $updated, [], $request);

        return response()->json(['message' => 'Cupones marcados como pagados', 'count' => $updated]);
    }

    public function bulkPayByDesembolso(Request $request)
    {
        $validated = $request->validate([
            'desembolsos' => 'required|array|min:1',
            'desembolsos.*' => 'string',
            'fecha_pago' => 'required|date',
            'monto' => 'required|numeric|min:0.01',
            'moneda' => 'required|in:CRC,USD',
            'comentarios' => 'nullable|string|max:500',
            'comprobante_url' => 'nullable|url|max:2048',
            'registered_by' => 'nullable|exists:users,id',
        ]);

        $fechaPago = $validated['fecha_pago'];
        $monto = (float) $validated['monto'];
        $moneda = $validated['moneda'];
        $comentarios = $validated['comentarios'] ?? 'Pago de interés';
        $comprobanteUrl = $validated['comprobante_url'] ?? null;
        $registeredBy = $validated['registered_by'] ?? null;

        $investments = Investment::whereIn('numero_desembolso', $validated['desembolsos'])
            ->whereIn('estado', ['Activa', 'Capital Devuelto'])
            ->get();

        if ($investments->isEmpty()) {
            return response()->json(['message' => 'No se encontraron inversiones activas con esos desembolsos.'], 404);
        }

        $periodo = \Carbon\Carbon::parse($fechaPago);

        $coupons = InvestmentCoupon::with('investment')
            ->whereIn('investment_id', $investments->pluck('id'))
            ->where('estado', 'Pendiente')
            ->whereYear('fecha_cupon', $periodo->year)
            ->whereMonth('fecha_cupon', $periodo->month)
            ->get();

        if ($coupons->isEmpty()) {
            return response()->json(['message' => 'No hay cupones pendientes para estas inversiones.'], 422);
        }

        InvestmentCoupon::whereIn('id', $coupons->pluck('id'))
            ->update(['estado' => 'Pagado', 'fecha_pago' => $fechaPago]);

        $payments = $coupons->map(fn (InvestmentCoupon $coupon) => [
            'investor_id' => $coupon->investment->investor_id,
            'investment_id' => $coupon->investment_id,
            'fecha_pago' => $fechaPago,
            'monto' => $monto > 0 ? $monto : $coupon->interes_neto,
            'tipo' => 'Interés',
            'moneda' => $moneda,
            'comentarios' => $comentarios,
            'comprobante_url' => $comprobanteUrl,
            'periodo' => $coupon->fecha_cupon,
            'registered_by' => $registeredBy,
            'created_at' => now(),
            'updated_at' => now(),
        ])->toArray();

        InvestmentPayment::insert($payments);

        // Auto-finalizar inversiones 'Capital Devuelto' sin cupones pendientes
        $investments->where('estado', 'Capital Devuelto')->each(function (Investment $inv) {
            $hasPending = $inv->coupons()->whereIn('estado', ['Pendiente', 'Reservado'])->exists();
            if (! $hasPending) {
                $inv->update(['estado' => 'Finalizada']);
            }
        });

        $this->logActivity('bulk_pay_by_desembolso', 'Cupones Inversión', null,
            'Desembolsos: ' . implode(', ', $validated['desembolsos']) . ' | Cupones: ' . $coupons->count(), [], $request);

        return response()->json([
            'message' => 'Cupones marcados como pagados',
            'count' => $coupons->count(),
            'investments_affected' => $investments->count(),
            'desembolsos_found' => $investments->pluck('numero_desembolso'),
            'desembolsos_not_found' => collect($validated['desembolsos'])->diff($investments->pluck('numero_desembolso'))->values(),
            'comprobante_url' => $comprobanteUrl,
        ]);
    }
}
