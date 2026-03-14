<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comision;
use App\Models\ReglaComision;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Traits\LogsActivity;

class ComisionController extends Controller
{
    use LogsActivity;
    public function index(Request $request): JsonResponse
    {
        $query = Comision::with(['user:id,name', 'aprobadaPor:id,name']);

        if ($request->has('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }
        if ($request->has('estado')) {
            $query->where('estado', $request->input('estado'));
        }
        if ($request->has('tipo')) {
            $query->where('tipo', $request->input('tipo'));
        }
        if ($request->has('anio') && $request->has('mes')) {
            $query->delPeriodo((int) $request->input('anio'), (int) $request->input('mes'));
        }

        $perPage = min((int) $request->input('per_page', 20), 100);

        return response()->json(
            $query->orderBy('fecha_operacion', 'desc')->paginate($perPage)
        );
    }

    public function resumen(Request $request): JsonResponse
    {
        $anio = (int) $request->input('anio', date('Y'));
        $mes = (int) $request->input('mes', date('n'));

        $comisiones = Comision::delPeriodo($anio, $mes)
            ->selectRaw('user_id, estado, COUNT(*) as cantidad, SUM(monto_comision) as total')
            ->groupBy('user_id', 'estado')
            ->with('user:id,name')
            ->get();

        return response()->json($comisiones);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'tipo' => 'required|in:credito,inversion',
            'referencia_id' => 'required|integer',
            'referencia_tipo' => 'required|string',
            'monto_operacion' => 'required|numeric|min:0',
            'porcentaje' => 'required|numeric|min:0|max:1',
            'fecha_operacion' => 'required|date',
            'notas' => 'nullable|string|max:500',
        ]);

        $validated['monto_comision'] = round($validated['monto_operacion'] * $validated['porcentaje'], 2);

        $comision = Comision::create($validated);

        $this->logActivity('create', 'Comisiones', $comision, $comision->tipo . ' - ' . $comision->monto_comision, [], $request);

        return response()->json($comision->load(['user:id,name']), 201);
    }

    public function aprobar(Request $request, int $id): JsonResponse
    {
        return DB::transaction(function () use ($id, $request) {
            $comision = Comision::lockForUpdate()->where('estado', 'Pendiente')->findOrFail($id);

            $comision->update([
                'estado' => 'Aprobada',
                'fecha_aprobacion' => now()->toDateString(),
                'aprobada_por' => $request->user()->id,
            ]);

            $this->logActivity('aprobar', 'Comisiones', $comision, $comision->tipo . ' - ' . $comision->monto_comision, [], $request);

            return response()->json($comision->load(['user:id,name', 'aprobadaPor:id,name']));
        });
    }

    public function pagar(Request $request, int $id): JsonResponse
    {
        return DB::transaction(function () use ($id, $request) {
            $comision = Comision::lockForUpdate()->where('estado', 'Aprobada')->findOrFail($id);

            $comision->update([
                'estado' => 'Pagada',
                'fecha_pago' => now()->toDateString(),
            ]);

            $this->logActivity('pagar', 'Comisiones', $comision, $comision->tipo . ' - ' . $comision->monto_comision, [], $request);

            return response()->json($comision->load(['user:id,name', 'aprobadaPor:id,name']));
        });
    }

    public function bulkAprobar(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:comisiones,id',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $updated = Comision::lockForUpdate()->whereIn('id', $validated['ids'])
                ->where('estado', 'Pendiente')
                ->update([
                    'estado' => 'Aprobada',
                    'fecha_aprobacion' => now()->toDateString(),
                    'aprobada_por' => $request->user()->id,
                ]);

            $this->logActivity('bulk_aprobar', 'Comisiones', null, $updated . ' comisiones aprobadas', [], $request);

            return response()->json(['updated' => $updated]);
        });
    }

    public function bulkPagar(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:comisiones,id',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $updated = Comision::lockForUpdate()->whereIn('id', $validated['ids'])
                ->where('estado', 'Aprobada')
                ->update([
                    'estado' => 'Pagada',
                    'fecha_pago' => now()->toDateString(),
                ]);

            $this->logActivity('bulk_pagar', 'Comisiones', null, $updated . ' comisiones pagadas', [], $request);

            return response()->json(['updated' => $updated]);
        });
    }

    public function destroy(int $id): JsonResponse
    {
        $comision = Comision::where('estado', 'Pendiente')->findOrFail($id);

        $this->logActivity('delete', 'Comisiones', $comision, $comision->tipo . ' - ' . $comision->monto_comision);

        $comision->delete();

        return response()->json(null, 204);
    }

    // --- Reglas de comisión ---

    public function reglas(): JsonResponse
    {
        return response()->json(ReglaComision::orderBy('tipo')->orderBy('monto_minimo')->get());
    }

    public function storeRegla(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:255',
            'tipo' => 'required|in:credito,inversion',
            'monto_minimo' => 'required|numeric|min:0',
            'monto_maximo' => 'nullable|numeric|min:0',
            'porcentaje' => 'required|numeric|min:0|max:1',
            'activo' => 'nullable|boolean',
        ]);

        $regla = ReglaComision::create($validated);

        $this->logActivity('create', 'Reglas Comisión', $regla, $regla->nombre, [], $request);

        return response()->json($regla, 201);
    }

    public function updateRegla(Request $request, int $id): JsonResponse
    {
        $regla = ReglaComision::findOrFail($id);

        $validated = $request->validate([
            'nombre' => 'nullable|string|max:255',
            'tipo' => 'nullable|in:credito,inversion',
            'monto_minimo' => 'nullable|numeric|min:0',
            'monto_maximo' => 'nullable|numeric|min:0',
            'porcentaje' => 'nullable|numeric|min:0|max:1',
            'activo' => 'nullable|boolean',
        ]);

        $oldData = $regla->toArray();
        $regla->update($validated);

        $changes = $this->getChanges($oldData, $regla->fresh()->toArray());
        $this->logActivity('update', 'Reglas Comisión', $regla, $regla->nombre, $changes, $request);

        return response()->json($regla);
    }

    public function destroyRegla(int $id): JsonResponse
    {
        $regla = ReglaComision::findOrFail($id);

        $this->logActivity('delete', 'Reglas Comisión', $regla, $regla->nombre);

        $regla->delete();

        return response()->json(null, 204);
    }
}
