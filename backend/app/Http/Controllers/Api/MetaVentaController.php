<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Credit;
use App\Models\MetaBonusTier;
use App\Models\MetaVenta;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MetaVentaController extends Controller
{
    use LogsActivity;

    public function index(Request $request): JsonResponse
    {
        $query = MetaVenta::with(['user:id,name', 'bonusTiers']);

        if ($request->has('anio')) {
            $query->where('anio', $request->input('anio'));
        }
        if ($request->has('mes')) {
            $query->where('mes', $request->input('mes'));
        }
        if ($request->has('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }
        if ($request->boolean('activo', true)) {
            $query->where('activo', true);
        }

        $metas = $query->orderBy('anio', 'desc')->orderBy('mes', 'desc')->get();

        $metas->each(function (MetaVenta $meta): void {
            $creditos = Credit::where('assigned_to', $meta->user_id)
                ->whereNotNull('formalized_at')
                ->whereYear('formalized_at', $meta->anio)
                ->whereMonth('formalized_at', $meta->mes);

            $creditosAlcanzados = $creditos->count();

            $meta->creditos_alcanzado_monto    = (float) $creditos->sum('monto_credito');
            $meta->creditos_alcanzado_cantidad = $creditosAlcanzados;
            $meta->inversiones_alcanzado_monto    = 0;
            $meta->inversiones_alcanzado_cantidad = 0;

            $tierActivo  = $meta->tierActivo($creditosAlcanzados);
            $proximoTier = $meta->proximoTier($creditosAlcanzados);

            $meta->tier_activo  = $tierActivo ? [
                'id'               => $tierActivo->id,
                'creditos_minimos' => $tierActivo->creditos_minimos,
                'porcentaje'       => (float) $tierActivo->porcentaje,
                'puntos_reward'    => $tierActivo->puntos_reward,
                'descripcion'      => $tierActivo->descripcion,
            ] : null;

            $meta->proximo_tier = $proximoTier ? [
                'id'               => $proximoTier->id,
                'creditos_minimos' => $proximoTier->creditos_minimos,
                'porcentaje'       => (float) $proximoTier->porcentaje,
                'puntos_reward'    => $proximoTier->puntos_reward,
                'descripcion'      => $proximoTier->descripcion,
                'faltan_creditos'  => $proximoTier->creditos_minimos - $creditosAlcanzados,
            ] : null;
        });

        return response()->json($metas);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id'                    => 'required|exists:users,id',
            'anio'                       => 'required|integer|min:2020|max:2050',
            'mes'                        => 'required|integer|min:1|max:12',
            'meta_creditos_monto'        => 'nullable|numeric|min:0',
            'meta_creditos_cantidad'     => 'nullable|integer|min:0',
            'meta_inversiones_monto'     => 'nullable|numeric|min:0',
            'meta_inversiones_cantidad'  => 'nullable|integer|min:0',
            'notas'                      => 'nullable|string|max:500',
            'tiers'                      => 'nullable|array',
            'tiers.*.creditos_minimos'   => 'required_with:tiers|integer|min:0',
            'tiers.*.porcentaje'         => 'required_with:tiers|numeric|min:0|max:1',
            'tiers.*.puntos_reward'      => 'nullable|integer|min:0',
            'tiers.*.descripcion'        => 'nullable|string|max:255',
        ]);

        $tiers = $validated['tiers'] ?? [];
        unset($validated['tiers']);

        $meta = MetaVenta::updateOrCreate(
            [
                'user_id' => $validated['user_id'],
                'anio'    => $validated['anio'],
                'mes'     => $validated['mes'],
            ],
            $validated
        );

        if (!empty($tiers)) {
            $meta->bonusTiers()->delete();
            foreach ($tiers as $tier) {
                $meta->bonusTiers()->create($tier);
            }
        }

        $this->logActivity('create', 'Metas Venta', $meta, 'Meta #' . $meta->id, null, $request);

        return response()->json($meta->load(['user:id,name', 'bonusTiers']), 201);
    }

    public function show(int $id): JsonResponse
    {
        $meta = MetaVenta::with(['user:id,name', 'bonusTiers'])->findOrFail($id);

        return response()->json($meta);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $meta    = MetaVenta::findOrFail($id);
        $oldData = $meta->toArray();

        $validated = $request->validate([
            'meta_creditos_monto'       => 'nullable|numeric|min:0',
            'meta_creditos_cantidad'    => 'nullable|integer|min:0',
            'meta_inversiones_monto'    => 'nullable|numeric|min:0',
            'meta_inversiones_cantidad' => 'nullable|integer|min:0',
            'notas'                     => 'nullable|string|max:500',
            'activo'                    => 'nullable|boolean',
            'tiers'                     => 'nullable|array',
            'tiers.*.creditos_minimos'  => 'required_with:tiers|integer|min:0',
            'tiers.*.porcentaje'        => 'required_with:tiers|numeric|min:0|max:1',
            'tiers.*.puntos_reward'     => 'nullable|integer|min:0',
            'tiers.*.descripcion'       => 'nullable|string|max:255',
        ]);

        $tiers = $validated['tiers'] ?? null;
        unset($validated['tiers']);

        $meta->update($validated);

        if ($tiers !== null) {
            $meta->bonusTiers()->delete();
            foreach ($tiers as $tier) {
                $meta->bonusTiers()->create($tier);
            }
        }

        $this->logActivity('update', 'Metas Venta', $meta, 'Meta #' . $meta->id, $this->getChanges($oldData, $meta->fresh()->toArray()), $request);

        return response()->json($meta->load(['user:id,name', 'bonusTiers']));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $meta = MetaVenta::findOrFail($id);

        $this->logActivity('delete', 'Metas Venta', $meta, 'Meta #' . $meta->id, null, $request);

        $meta->delete(); // cascadeOnDelete elimina los bonusTiers también

        return response()->json(null, 204);
    }

    // --- CRUD de tiers individuales (para gestión desde perfil del vendedor) ---

    public function storeTier(Request $request, int $metaId): JsonResponse
    {
        $meta = MetaVenta::findOrFail($metaId);

        $validated = $request->validate([
            'creditos_minimos' => 'required|integer|min:0',
            'porcentaje'       => 'required|numeric|min:0|max:1',
            'puntos_reward'    => 'nullable|integer|min:0',
            'descripcion'      => 'nullable|string|max:255',
        ]);

        $tier = $meta->bonusTiers()->create($validated);

        return response()->json($tier, 201);
    }

    public function updateTier(Request $request, int $metaId, int $tierId): JsonResponse
    {
        $tier = MetaBonusTier::where('meta_venta_id', $metaId)->findOrFail($tierId);

        $validated = $request->validate([
            'creditos_minimos' => 'nullable|integer|min:0',
            'porcentaje'       => 'nullable|numeric|min:0|max:1',
            'puntos_reward'    => 'nullable|integer|min:0',
            'descripcion'      => 'nullable|string|max:255',
        ]);

        $tier->update($validated);

        return response()->json($tier);
    }

    public function destroyTier(int $metaId, int $tierId): JsonResponse
    {
        $tier = MetaBonusTier::where('meta_venta_id', $metaId)->findOrFail($tierId);
        $tier->delete();

        return response()->json(null, 204);
    }
}
