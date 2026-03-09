<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Credit;
use App\Models\Investment;
use App\Models\MetaVenta;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MetaVentaController extends Controller
{
    use LogsActivity;

    public function index(Request $request): JsonResponse
    {
        $query = MetaVenta::with('user:id,name');

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

        // Calcular progreso real para cada meta
        $metas->each(function ($meta) {
            $creditos = Credit::where('assigned_to', $meta->user_id)
                ->whereNotNull('formalized_at')
                ->whereYear('formalized_at', $meta->anio)
                ->whereMonth('formalized_at', $meta->mes);

            $meta->creditos_alcanzado_monto = (float) $creditos->sum('monto_credito');
            $meta->creditos_alcanzado_cantidad = $creditos->count();

            // TODO: inversiones — requiere campo assigned_to en investments o relación con vendedor
            $meta->inversiones_alcanzado_monto = 0;
            $meta->inversiones_alcanzado_cantidad = 0;
        });

        return response()->json($metas);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'anio' => 'required|integer|min:2020|max:2050',
            'mes' => 'required|integer|min:1|max:12',
            'meta_creditos_monto' => 'nullable|numeric|min:0',
            'meta_creditos_cantidad' => 'nullable|integer|min:0',
            'meta_inversiones_monto' => 'nullable|numeric|min:0',
            'meta_inversiones_cantidad' => 'nullable|integer|min:0',
            'notas' => 'nullable|string|max:500',
        ]);

        $meta = MetaVenta::updateOrCreate(
            [
                'user_id' => $validated['user_id'],
                'anio' => $validated['anio'],
                'mes' => $validated['mes'],
            ],
            $validated
        );

        $this->logActivity('create', 'Metas Venta', $meta, 'Meta #' . $meta->id, null, $request);

        return response()->json($meta->load('user:id,name'), 201);
    }

    public function show(int $id): JsonResponse
    {
        $meta = MetaVenta::with('user:id,name')->findOrFail($id);

        return response()->json($meta);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $meta = MetaVenta::findOrFail($id);
        $oldData = $meta->toArray();

        $validated = $request->validate([
            'meta_creditos_monto' => 'nullable|numeric|min:0',
            'meta_creditos_cantidad' => 'nullable|integer|min:0',
            'meta_inversiones_monto' => 'nullable|numeric|min:0',
            'meta_inversiones_cantidad' => 'nullable|integer|min:0',
            'notas' => 'nullable|string|max:500',
            'activo' => 'nullable|boolean',
        ]);

        $meta->update($validated);

        $this->logActivity('update', 'Metas Venta', $meta, 'Meta #' . $meta->id, $this->getChanges($oldData, $meta->fresh()->toArray()), $request);

        return response()->json($meta->load('user:id,name'));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $meta = MetaVenta::findOrFail($id);

        $this->logActivity('delete', 'Metas Venta', $meta, 'Meta #' . $meta->id, null, $request);

        $meta->delete();

        return response()->json(null, 204);
    }
}
