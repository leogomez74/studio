<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Investment;
use App\Models\InvestmentCoupon;
use App\Models\InvestmentRateHistory;
use App\Services\InvestmentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Traits\LogsActivity;
use App\Traits\AccountingTrigger;

class InvestmentController extends Controller
{
    use LogsActivity, AccountingTrigger;
    public function __construct(private InvestmentService $service) {}

    public function index(Request $request)
    {
        $query = Investment::with('investor:id,name,cedula');

        if ($request->has('investor_id')) {
            $query->where('investor_id', $request->investor_id);
        }
        if ($request->has('estado')) {
            $query->where('estado', $request->estado);
        }
        if ($request->has('moneda')) {
            $query->where('moneda', $request->moneda);
        }

        if ($request->get('all') === 'true') {
            return response()->json($query->latest()->get());
        }

        $perPage = min($request->get('per_page', 50), 100);
        return response()->json($query->latest()->paginate($perPage));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'investor_id' => 'required|exists:investors,id',
            'monto_capital' => 'required|numeric|min:0.01',
            'plazo_meses' => 'required|integer|min:1',
            'fecha_inicio' => 'required|date',
            'fecha_vencimiento' => 'required|date|after:fecha_inicio',
            'tasa_anual' => 'required|numeric|min:0|max:1',
            'tasa_retencion' => 'nullable|numeric|min:0|max:1',
            'moneda' => 'required|in:CRC,USD',
            'forma_pago' => 'required|in:MENSUAL,TRIMESTRAL,SEMESTRAL,ANUAL,RESERVA',
            'es_capitalizable' => 'boolean',
            'estado' => 'in:Activa,Finalizada,Liquidada,Cancelada,Renovada,Capital Devuelto',
            'notas' => 'nullable|string',
        ]);

        $investment = DB::transaction(function () use ($validated) {
            $validated['numero_desembolso'] = 'TMP';
            $investment = Investment::create($validated);
            $suffix = $investment->moneda === 'USD' ? 'D' : 'C';
            $investment->update(['numero_desembolso' => $investment->id . '-' . $suffix]);
            $this->service->generateCoupons($investment);
            return $investment;
        });

        $this->logActivity('create', 'Inversiones', $investment, $investment->numero_desembolso, [], $request);

        $this->triggerAccountingEntry('INV_CAPITAL_RECIBIDO', (float) $investment->monto_capital, $investment->numero_desembolso, [
            'investment_id'  => $investment->id,
            'investor_id'    => $investment->investor_id,
            'investor_nombre' => $investment->investor?->name ?? 'N/A',
            'moneda'         => $investment->moneda,
        ]);

        return response()->json($investment->load('coupons'), 201);
    }

    public function show(int $id)
    {
        $investment = Investment::with(['investor:id,name,cedula', 'coupons', 'payments', 'rateHistory.changedBy:id,name'])
            ->findOrFail($id);
        return response()->json($investment);
    }

    public function update(Request $request, int $id)
    {
        $investment = Investment::findOrFail($id);
        $oldData = $investment->toArray();

        $validated = $request->validate([
            'numero_desembolso' => "string|max:20|unique:investments,numero_desembolso,{$id}",
            'investor_id' => 'exists:investors,id',
            'monto_capital' => 'numeric|min:0.01',
            'plazo_meses' => 'integer|min:1',
            'fecha_inicio' => 'date',
            'fecha_vencimiento' => 'date|after:' . ($request->input('fecha_inicio') ?? $investment->fecha_inicio->toDateString()),
            'tasa_anual' => 'numeric|min:0|max:1',
            'tasa_retencion' => 'nullable|numeric|min:0|max:1',
            'moneda' => 'in:CRC,USD',
            'forma_pago' => 'in:MENSUAL,TRIMESTRAL,SEMESTRAL,ANUAL,RESERVA',
            'es_capitalizable' => 'boolean',
            'estado' => 'in:Activa,Finalizada,Liquidada,Cancelada,Renovada,Capital Devuelto',
            'notas' => 'nullable|string',
        ]);

        DB::transaction(function () use ($investment, $validated, $request) {
            // Track rate change
            if (isset($validated['tasa_anual']) && (float) $validated['tasa_anual'] !== (float) $investment->tasa_anual) {
                InvestmentRateHistory::create([
                    'investment_id' => $investment->id,
                    'tasa_anterior' => $investment->tasa_anual,
                    'tasa_nueva' => $validated['tasa_anual'],
                    'cambiado_por' => auth()->id(),
                    'motivo' => $request->input('motivo_cambio_tasa'),
                ]);
            }

            $investment->update($validated);

            // Recalculate coupons if financial terms changed
            $financialFields = ['monto_capital', 'tasa_anual', 'tasa_retencion', 'plazo_meses', 'forma_pago', 'fecha_vencimiento', 'es_capitalizable'];
            if (array_intersect(array_keys($validated), $financialFields)) {
                $this->service->recalculateCoupons($investment);
            }
        });

        $changes = $this->getChanges($oldData, $investment->fresh()->toArray());
        $this->logActivity('update', 'Inversiones', $investment, $investment->numero_desembolso, $changes, $request);

        return response()->json($investment->fresh()->load('coupons'));
    }

    public function destroy(int $id)
    {
        $investment = Investment::findOrFail($id);
        $this->logActivity('delete', 'Inversiones', $investment, $investment->numero_desembolso);
        $investment->delete();
        return response()->json(['message' => 'Inversión eliminada']);
    }

    public function tablaGeneral()
    {
        return response()->json($this->service->getTablaGeneral());
    }

    public function pagosProximos()
    {
        $limit = Carbon::now()->addMonths(3)->endOfMonth();

        $coupons = InvestmentCoupon::with(['investment.investor:id,name'])
            ->where('estado', 'Pendiente')
            ->where('fecha_cupon', '<=', $limit)
            ->orderByDesc('fecha_cupon')
            ->get();

        $grouped = $coupons->groupBy(fn ($c) => Carbon::parse($c->fecha_cupon)->format('Y-m'));

        $meses = $grouped->map(function ($cuponesMes, $key) {
            $date = Carbon::createFromFormat('Y-m', $key);
            $investmentIds = $cuponesMes->pluck('investment_id')->unique();

            $byCurrency = fn (string $moneda) => $cuponesMes->filter(
                fn ($c) => $c->investment && $c->investment->moneda === $moneda
            );

            $summarize = function ($items) {
                return [
                    'cantidad' => $items->count(),
                    'interes_bruto' => round($items->sum('interes_bruto'), 2),
                    'retencion' => round($items->sum('retencion'), 2),
                    'interes_neto' => round($items->sum('interes_neto'), 2),
                ];
            };

            return [
                'mes' => $key,
                'label' => ucfirst($date->translatedFormat('F Y')),
                'resumen' => [
                    'total_cupones' => $cuponesMes->count(),
                    'total_inversiones' => $investmentIds->count(),
                    'crc' => $summarize($byCurrency('CRC')),
                    'usd' => $summarize($byCurrency('USD')),
                ],
                'cupones' => $cuponesMes->values(),
            ];
        })->values();

        return response()->json(['meses' => $meses]);
    }

    public function reservas()
    {
        return response()->json($this->service->getReservas());
    }

    public function reservaDetalle(int $id)
    {
        $investment = Investment::with('coupons')->findOrFail($id);
        return response()->json($this->service->calcularReserva($investment));
    }

    public function liquidate(int $id)
    {
        return DB::transaction(function () use ($id) {
            $investment = Investment::lockForUpdate()->findOrFail($id);
            $result = $this->service->liquidateEarly($investment);
            $this->logActivity('liquidate', 'Inversiones', $investment, $investment->numero_desembolso);
            return response()->json($result);
        });
    }

    public function renew(Request $request, int $id)
    {
        $validated = $request->validate([
            'plazo_meses' => 'required|integer|min:1',
            'fecha_inicio' => 'required|date',
            'fecha_vencimiento' => 'required|date|after:fecha_inicio',
            'tasa_anual' => 'nullable|numeric|min:0|max:1',
            'monto_capital' => 'nullable|numeric|min:0.01',
            'forma_pago' => 'nullable|in:MENSUAL,TRIMESTRAL,SEMESTRAL,ANUAL,RESERVA',
        ]);

        return DB::transaction(function () use ($id, $validated, $request) {
            $investment = Investment::lockForUpdate()->findOrFail($id);
            $newInvestment = $this->service->renewInvestment($investment, $validated);
            $this->logActivity('renew', 'Inversiones', $investment, $investment->numero_desembolso, [], $request);
            return response()->json($newInvestment->load('coupons'), 201);
        });
    }

    public function cancel(Request $request, int $id)
    {
        $validated = $request->validate([
            'motivo' => 'required|string|max:500',
            'fecha_cancelacion' => 'nullable|date',
        ]);

        return DB::transaction(function () use ($id, $validated, $request) {
            $investment = Investment::lockForUpdate()->findOrFail($id);

            if ($investment->estado !== 'Activa') {
                return response()->json(['message' => 'Solo se pueden cancelar inversiones activas.'], 422);
            }

            $investment->update([
                'estado' => 'Cancelada',
                'cancelado_por' => auth()->user()?->name ?? 'Sistema',
                'fecha_cancelacion' => $validated['fecha_cancelacion'] ?? now()->toDateString(),
                'notas' => $investment->notas
                    ? $investment->notas . "\n\nMotivo cancelación: " . $validated['motivo']
                    : "Motivo cancelación: " . $validated['motivo'],
            ]);

            $this->logActivity('cancel', 'Inversiones', $investment, $investment->numero_desembolso, [], $request);

            return response()->json($investment->fresh());
        });
    }

    public function cancelacionTotal(Request $request, int $id)
    {
        $validated = $request->validate([
            'tipo' => 'required|in:con_intereses,sin_intereses',
        ]);

        return DB::transaction(function () use ($id, $validated, $request) {
            $investment = Investment::lockForUpdate()->findOrFail($id);

            if ($investment->estado !== 'Activa') {
                return response()->json(['message' => 'Solo se pueden realizar abonos totales en inversiones activas.'], 422);
            }

            $result = $this->service->cancelacionTotal($investment, $validated['tipo']);
            $this->logActivity('cancelacion_total', 'Inversiones', $investment, $investment->numero_desembolso, ['tipo' => $validated['tipo']], $request);

            $this->triggerAccountingEntry('INV_CANCELACION_TOTAL', (float) $investment->monto_capital, $investment->numero_desembolso, [
                'investment_id'   => $investment->id,
                'investor_id'     => $investment->investor_id,
                'investor_nombre' => $investment->investor?->name ?? 'N/A',
                'moneda'          => $investment->moneda,
                'tipo_cancelacion' => $validated['tipo'],
            ]);

            return response()->json($result->load(['investor:id,name,cedula', 'coupons', 'payments']));
        });
    }

    public function pagadas(Request $request)
    {
        $query = Investment::with('investor:id,name,cedula')
            ->whereIn('estado', ['Finalizada', 'Capital Devuelto'])
            ->whereNotNull('fecha_pago_total');

        if ($request->has('moneda')) {
            $query->where('moneda', $request->moneda);
        }

        return response()->json($query->latest('fecha_pago_total')->get());
    }

    public function recalculateAll()
    {
        $investments = Investment::all();
        $count = 0;

        foreach ($investments as $investment) {
            $this->service->generateCoupons($investment);
            $count++;
        }

        return response()->json([
            'message' => "Se recalcularon los cupones de {$count} inversión(es).",
            'count' => $count,
        ]);
    }

    public function preview(Request $request)
    {
        $validated = $request->validate([
            'monto_capital' => 'required|numeric|min:0.01',
            'tasa_anual' => 'required|numeric|min:0|max:1',
            'plazo_meses' => 'required|integer|min:1',
            'fecha_inicio' => 'required|date',
            'forma_pago' => 'required|in:MENSUAL,TRIMESTRAL,SEMESTRAL,ANUAL,RESERVA',
            'es_capitalizable' => 'boolean',
            'tasa_retencion' => 'nullable|numeric|min:0|max:1',
        ]);

        $coupons = $this->service->previewCoupons($validated);
        return response()->json($coupons);
    }

    public function vencimientos()
    {
        $now = Carbon::now();

        $investments = Investment::with('investor:id,name,cedula')
            ->where('estado', 'Activa')
            ->where('fecha_vencimiento', '<=', $now->copy()->addDays(90))
            ->orderBy('fecha_vencimiento')
            ->get();

        $groups = [
            'vencidas' => $investments->filter(fn ($i) => Carbon::parse($i->fecha_vencimiento)->lt($now)),
            '0_30' => $investments->filter(fn ($i) => Carbon::parse($i->fecha_vencimiento)->between($now, $now->copy()->addDays(30))),
            '31_60' => $investments->filter(fn ($i) => Carbon::parse($i->fecha_vencimiento)->between($now->copy()->addDays(31), $now->copy()->addDays(60))),
            '61_90' => $investments->filter(fn ($i) => Carbon::parse($i->fecha_vencimiento)->between($now->copy()->addDays(61), $now->copy()->addDays(90))),
        ];

        return response()->json([
            'vencidas' => $groups['vencidas']->values(),
            '0_30' => $groups['0_30']->values(),
            '31_60' => $groups['31_60']->values(),
            '61_90' => $groups['61_90']->values(),
            'total' => $investments->count(),
        ]);
    }
}
