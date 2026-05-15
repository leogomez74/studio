<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MarketingCost;
use App\Traits\LogsActivity;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MarketingCostController extends Controller
{
    use LogsActivity;

    public function index(Request $request): JsonResponse
    {
        $query = MarketingCost::with('creator:id,name')->orderByDesc('period_month');

        if ($request->filled('period_month')) {
            $query->whereDate('period_month', $request->period_month);
        }
        if ($request->filled('channel')) {
            $query->where('channel', $request->channel);
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'period_month' => 'required|date',
            'channel'      => 'required|string|max:120',
            'amount'       => 'required|numeric|min:0',
            'notes'        => 'nullable|string|max:1000',
        ]);

        // Normalizar al día 1 del mes para evitar duplicados por día.
        $data['period_month'] = Carbon::parse($data['period_month'])->startOfMonth()->toDateString();
        $data['created_by']   = $request->user()->id;

        $cost = MarketingCost::create($data);
        $this->logActivity('create', 'Marketing', $cost, "{$cost->channel} {$cost->period_month}", [], $request);

        return response()->json($cost->load('creator:id,name'), 201);
    }

    public function update(Request $request, MarketingCost $marketingCost): JsonResponse
    {
        $data = $request->validate([
            'period_month' => 'sometimes|date',
            'channel'      => 'sometimes|string|max:120',
            'amount'       => 'sometimes|numeric|min:0',
            'notes'        => 'nullable|string|max:1000',
        ]);

        if (isset($data['period_month'])) {
            $data['period_month'] = Carbon::parse($data['period_month'])->startOfMonth()->toDateString();
        }

        $oldData = $marketingCost->toArray();
        $marketingCost->update($data);
        $changes = $this->getChanges($oldData, $marketingCost->fresh()->toArray());
        $this->logActivity('update', 'Marketing', $marketingCost, "{$marketingCost->channel} {$marketingCost->period_month}", $changes, $request);

        return response()->json($marketingCost->load('creator:id,name'));
    }

    public function destroy(Request $request, MarketingCost $marketingCost): JsonResponse
    {
        $label = "{$marketingCost->channel} {$marketingCost->period_month}";
        $marketingCost->delete();
        $this->logActivity('delete', 'Marketing', $marketingCost, $label, [], $request);

        return response()->json(['message' => 'Eliminado']);
    }
}
