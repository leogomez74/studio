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

class InvestmentController extends Controller
{
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
            'moneda' => 'required|in:CRC,USD',
            'forma_pago' => 'required|in:MENSUAL,TRIMESTRAL,SEMESTRAL,ANUAL,RESERVA',
            'es_capitalizable' => 'boolean',
            'estado' => 'in:Activa,Finalizada,Liquidada',
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

        $validated = $request->validate([
            'numero_desembolso' => "string|max:20|unique:investments,numero_desembolso,{$id}",
            'investor_id' => 'exists:investors,id',
            'monto_capital' => 'numeric|min:0.01',
            'plazo_meses' => 'integer|min:1',
            'fecha_inicio' => 'date',
            'fecha_vencimiento' => 'date|after:' . ($request->input('fecha_inicio') ?? $investment->fecha_inicio->toDateString()),
            'tasa_anual' => 'numeric|min:0|max:1',
            'moneda' => 'in:CRC,USD',
            'forma_pago' => 'in:MENSUAL,TRIMESTRAL,SEMESTRAL,ANUAL,RESERVA',
            'es_capitalizable' => 'boolean',
            'estado' => 'in:Activa,Finalizada,Liquidada',
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
            $financialFields = ['monto_capital', 'tasa_anual', 'plazo_meses', 'forma_pago', 'fecha_vencimiento', 'es_capitalizable'];
            if (array_intersect(array_keys($validated), $financialFields)) {
                $this->service->recalculateCoupons($investment);
            }
        });

        return response()->json($investment->fresh()->load('coupons'));
    }

    public function destroy(int $id)
    {
        Investment::findOrFail($id)->delete();
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
            ->orderBy('fecha_cupon')
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
        $investment = Investment::findOrFail($id);
        $result = $this->service->liquidateEarly($investment);
        return response()->json($result);
    }

    public function renew(Request $request, int $id)
    {
        $investment = Investment::findOrFail($id);

        $validated = $request->validate([
            'plazo_meses' => 'required|integer|min:1',
            'fecha_inicio' => 'required|date',
            'fecha_vencimiento' => 'required|date|after:fecha_inicio',
            'tasa_anual' => 'nullable|numeric|min:0|max:1',
            'monto_capital' => 'nullable|numeric|min:0.01',
            'forma_pago' => 'nullable|in:MENSUAL,TRIMESTRAL,SEMESTRAL,ANUAL,RESERVA',
        ]);

        $newInvestment = $this->service->renewInvestment($investment, $validated);
        return response()->json($newInvestment->load('coupons'), 201);
    }
}
