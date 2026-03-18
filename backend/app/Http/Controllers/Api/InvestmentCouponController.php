<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InvestmentCoupon;
use App\Models\InvestmentPayment;
use App\Models\Investment;
use App\Models\Task;
use App\Models\TaskAutomation;
use App\Services\InvestmentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Traits\LogsActivity;
use App\Traits\AccountingTrigger;

class InvestmentCouponController extends Controller
{
    use LogsActivity, AccountingTrigger;
    public function __construct(private InvestmentService $service) {}

    public function index(int $id)
    {
        $investment = Investment::findOrFail($id);
        $coupons = $investment->coupons()->orderBy('fecha_cupon')->get();
        return response()->json($coupons);
    }

    public function markPaid(Request $request, int $id)
    {
        $validated = $request->validate([
            'fecha_pago' => 'nullable|date',
            'comprobante' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
        ]);

        $comprobantePath = null;
        if ($request->hasFile('comprobante')) {
            $comprobantePath = $request->file('comprobante')->store('comprobantes/inversiones', 'public');
        }

        return DB::transaction(function () use ($id, $validated, $comprobantePath, $request) {
            $coupon = InvestmentCoupon::lockForUpdate()->with('investment')->findOrFail($id);

            if (! in_array($coupon->investment->estado, ['Activa', 'Capital Devuelto'])) {
                return response()->json(['message' => 'Solo se pueden pagar cupones de inversiones activas o con capital devuelto.'], 422);
            }

            $this->service->markCouponAsPaid($coupon, $validated['fecha_pago'] ?? null, $comprobantePath);
            $this->logActivity('mark_paid', 'Cupones Inversión', $coupon, 'Cupón #' . $coupon->id, [], $request);

            $accountingContext = [
                'investment_id'   => $coupon->investment_id,
                'investor_id'     => $coupon->investment->investor_id,
                'investor_nombre' => $coupon->investment->investor?->name ?? 'N/A',
                'coupon_id'       => $coupon->id,
                'moneda'          => $coupon->investment->moneda,
                'amount_breakdown' => [
                    'interes_neto'  => (float) $coupon->interes_neto,
                    'retencion'     => (float) $coupon->retencion,
                    'interes_bruto' => (float) $coupon->interes_bruto,
                ],
            ];

            $this->triggerAccountingEntry('INV_INTERES_DEVENGADO', (float) $coupon->interes_bruto, 'CUPON-' . $coupon->id, $accountingContext);
            $this->triggerAccountingEntry('INV_RETENCION_INTERES', (float) $coupon->retencion, 'CUPON-RET-' . $coupon->id, $accountingContext);

            return response()->json($coupon->fresh());
        });
    }

    public function correct(Request $request, int $id)
    {
        $validated = $request->validate([
            'monto_pagado_real' => 'required|numeric|min:0',
            'motivo_correccion' => 'required|string|max:500',
        ]);

        return DB::transaction(function () use ($id, $validated, $request) {
            $coupon = InvestmentCoupon::lockForUpdate()->findOrFail($id);

            $coupon = $this->service->correctCoupon(
                $coupon,
                (float) $validated['monto_pagado_real'],
                $validated['motivo_correccion']
            );

            $this->logActivity('correct', 'Cupones Inversión', $coupon, 'Cupón #' . $coupon->id, [], $request);

            $investment = $coupon->investment->load('coupons');
            return response()->json($investment);
        });
    }

    public function markBulkPaid(Request $request)
    {
        $validated = $request->validate([
            'coupon_ids' => 'required|array',
            'coupon_ids.*' => 'exists:investment_coupons,id',
            'fecha_pago' => 'nullable|date',
            'comentarios' => 'nullable|string',
            'registered_by' => 'nullable|exists:users,id',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $fechaPago = $validated['fecha_pago'] ?? now()->toDateString();
            $comentarios = $validated['comentarios'] ?? null;
            $registeredBy = $validated['registered_by'] ?? $request->user()?->id;

            $coupons = InvestmentCoupon::lockForUpdate()
                ->with('investment')
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
                    'monto_capital' => 0,
                    'monto_interes' => $coupon->interes_neto,
                    'tipo' => 'Interés',
                    'moneda' => $coupon->investment->moneda,
                    'comentarios' => $comentarios,
                    'registered_by' => $registeredBy,
                    'periodo' => $coupon->fecha_cupon,
                    'created_at' => now(),
                    'updated_at' => now(),
                ])->toArray();

                InvestmentPayment::insert($payments);

                // Disparar asientos contables por cada cupón pagado
                foreach ($coupons as $coupon) {
                    $accountingContext = [
                        'investment_id'   => $coupon->investment_id,
                        'investor_id'     => $coupon->investment->investor_id,
                        'investor_nombre' => $coupon->investment->investor?->name ?? 'N/A',
                        'coupon_id'       => $coupon->id,
                        'moneda'          => $coupon->investment->moneda,
                        'amount_breakdown' => [
                            'interes_neto'  => (float) $coupon->interes_neto,
                            'retencion'     => (float) $coupon->retencion,
                            'interes_bruto' => (float) $coupon->interes_bruto,
                        ],
                    ];
                    $this->triggerAccountingEntry('INV_INTERES_DEVENGADO', (float) $coupon->interes_bruto, 'CUPON-' . $coupon->id, $accountingContext);
                    $this->triggerAccountingEntry('INV_RETENCION_INTERES', (float) $coupon->retencion, 'CUPON-RET-' . $coupon->id, $accountingContext);
                }

                // Auto-finalizar inversiones 'Capital Devuelto' sin cupones pendientes
                $investmentIds = $coupons->pluck('investment_id')->unique();
                Investment::lockForUpdate()->whereIn('id', $investmentIds)
                    ->where('estado', 'Capital Devuelto')
                    ->get()
                    ->each(function (Investment $inv) {
                        $hasPending = $inv->coupons()->whereIn('estado', ['Pendiente', 'Reservado'])->exists();
                        if (! $hasPending) {
                            $inv->update(['estado' => 'Finalizada']);
                            $this->triggerFinalizedAutomation($inv);
                        }
                    });
            }

            $this->logActivity('bulk_mark_paid', 'Cupones Inversión', null, 'Bulk: ' . $updated, [], $request);

            return response()->json(['message' => 'Cupones marcados como pagados', 'count' => $updated]);
        });
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

        return DB::transaction(function () use ($validated, $request) {
            $fechaPago = $validated['fecha_pago'];
            $monto = (float) $validated['monto'];
            $moneda = $validated['moneda'];
            $comentarios = $validated['comentarios'] ?? 'Pago de interés';
            $comprobanteUrl = $validated['comprobante_url'] ?? null;
            $registeredBy = $validated['registered_by'] ?? null;

            $investments = Investment::lockForUpdate()
                ->whereIn('numero_desembolso', $validated['desembolsos'])
                ->whereIn('estado', ['Activa', 'Capital Devuelto'])
                ->get();

            if ($investments->isEmpty()) {
                return response()->json(['message' => 'No se encontraron inversiones activas con esos desembolsos.'], 404);
            }

            $periodo = \Carbon\Carbon::parse($fechaPago);

            $coupons = InvestmentCoupon::lockForUpdate()
                ->with('investment')
                ->whereIn('investment_id', $investments->pluck('id'))
                ->where('estado', 'Pendiente')
                ->whereYear('fecha_cupon', $periodo->year)
                ->whereMonth('fecha_cupon', $periodo->month)
                ->get();

            // Si no hay pendientes, verificar si ya están pagados para ese período (actualizar comprobante)
            if ($coupons->isEmpty()) {
                if ($comprobanteUrl) {
                    $alreadyPaid = InvestmentCoupon::with('investment')
                        ->whereIn('investment_id', $investments->pluck('id'))
                        ->where('estado', 'Pagado')
                        ->whereYear('fecha_cupon', $periodo->year)
                        ->whereMonth('fecha_cupon', $periodo->month)
                        ->get();

                    if ($alreadyPaid->isNotEmpty()) {
                        $updated = InvestmentPayment::whereIn('investment_id', $alreadyPaid->pluck('investment_id'))
                            ->whereYear('periodo', $periodo->year)
                            ->whereMonth('periodo', $periodo->month)
                            ->update(['comprobante_url' => $comprobanteUrl, 'updated_at' => now()]);

                        return response()->json([
                            'message' => 'Cupones ya pagados — comprobante actualizado',
                            'count' => $updated,
                            'investments_affected' => $alreadyPaid->pluck('investment_id')->unique()->count(),
                            'comprobante_url' => $comprobanteUrl,
                        ]);
                    }
                }

                return response()->json(['message' => 'No hay cupones pendientes para estas inversiones.'], 422);
            }

            InvestmentCoupon::whereIn('id', $coupons->pluck('id'))
                ->update(['estado' => 'Pagado', 'fecha_pago' => $fechaPago]);

            $payments = $coupons->map(fn (InvestmentCoupon $coupon) => [
                'investor_id' => $coupon->investment->investor_id,
                'investment_id' => $coupon->investment_id,
                'fecha_pago' => $fechaPago,
                'monto' => $monto > 0 ? $monto : $coupon->interes_neto,
                'monto_capital' => 0,
                'monto_interes' => $monto > 0 ? $monto : $coupon->interes_neto,
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

            // Disparar asientos contables por cada cupón pagado
            foreach ($coupons as $coupon) {
                $accountingContext = [
                    'investment_id'   => $coupon->investment_id,
                    'investor_id'     => $coupon->investment->investor_id,
                    'investor_nombre' => $coupon->investment->investor?->name ?? 'N/A',
                    'coupon_id'       => $coupon->id,
                    'moneda'          => $moneda,
                    'amount_breakdown' => [
                        'interes_neto'  => (float) $coupon->interes_neto,
                        'retencion'     => (float) $coupon->retencion,
                        'interes_bruto' => (float) $coupon->interes_bruto,
                    ],
                ];
                $this->triggerAccountingEntry('INV_INTERES_DEVENGADO', (float) $coupon->interes_bruto, 'CUPON-' . $coupon->id, $accountingContext);
                $this->triggerAccountingEntry('INV_RETENCION_INTERES', (float) $coupon->retencion, 'CUPON-RET-' . $coupon->id, $accountingContext);
            }

            // Auto-finalizar inversiones 'Capital Devuelto' sin cupones pendientes
            $investments->where('estado', 'Capital Devuelto')->each(function (Investment $inv) {
                $hasPending = $inv->coupons()->whereIn('estado', ['Pendiente', 'Reservado'])->exists();
                if (! $hasPending) {
                    $inv->update(['estado' => 'Finalizada']);
                    $this->triggerFinalizedAutomation($inv);
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
        });
    }

    private function triggerFinalizedAutomation(Investment $investment): void
    {
        try {
            $automation = TaskAutomation::where('event_type', 'investment_finalized')
                ->where('is_active', true)
                ->first();

            if ($automation) {
                $investorName = $investment->investor?->name ?? 'N/A';
                $monedaSymbol = $investment->moneda === 'USD' ? '$' : '₡';
                $details = implode("\n", [
                    "**Inversión:** {$investment->numero_desembolso}",
                    "**Inversionista:** {$investorName}",
                    "**Monto capital:** {$monedaSymbol}" . number_format((float) $investment->monto_capital, 2),
                    "",
                    "La inversión ha sido finalizada (capital e intereses completamente pagados). Archivar expediente, emitir constancia de cierre y notificar al inversionista.",
                ]);
                Task::createFromAutomation($automation, 'INV-' . $investment->id, $details);
            }
        } catch (\Exception $e) {
            Log::error('Error creando tarea para inversión finalizada', [
                'investment_id' => $investment->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
