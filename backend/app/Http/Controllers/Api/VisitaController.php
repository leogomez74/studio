<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Visita;
use App\Traits\DisparaAutoTareas;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VisitaController extends Controller
{
    use DisparaAutoTareas;
    use LogsActivity;
    public function index(Request $request): JsonResponse
    {
        $query = Visita::with(['user:id,name', 'institucion:id,nombre']);

        if ($request->has('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }
        if ($request->has('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->has('institucion_id')) {
            $query->where('institucion_id', $request->input('institucion_id'));
        }
        if ($request->has('desde')) {
            $query->where('fecha_planificada', '>=', $request->input('desde'));
        }
        if ($request->has('hasta')) {
            $query->where('fecha_planificada', '<=', $request->input('hasta'));
        }
        if ($request->has('anio') && $request->has('mes')) {
            $query->delPeriodo((int) $request->input('anio'), (int) $request->input('mes'));
        }

        $perPage = min((int) $request->input('per_page', 20), 100);

        return response()->json(
            $query->orderBy('fecha_planificada', 'desc')->paginate($perPage)
        );
    }

    public function proximas(Request $request): JsonResponse
    {
        $user    = $request->user();
        $isAdmin = $user->role?->full_access ?? false;

        $query = Visita::with(['user:id,name', 'institucion:id,nombre'])
            ->proximas();

        // Vendedor solo ve sus propias visitas
        if (!$isAdmin) {
            $query->where('user_id', $user->id);
        }

        $visitas = $query->limit(10)->get();

        return response()->json($visitas);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'institucion_id' => 'nullable|exists:instituciones,id',
            'institucion_nombre' => 'nullable|string|max:255',
            'fecha_planificada' => 'required|date',
            'notas' => 'nullable|string|max:1000',
            'contacto_nombre' => 'nullable|string|max:255',
            'contacto_telefono' => 'nullable|string|max:50',
            'contacto_email' => 'nullable|email|max:255',
        ]);

        $visita = Visita::create($validated);

        $this->logActivity('create', 'Visitas', $visita, 'Visita #' . $visita->id, [], $request);

        return response()->json($visita->load(['user:id,name', 'institucion:id,nombre']), 201);
    }

    public function show(int $id): JsonResponse
    {
        $visita = Visita::with(['user:id,name', 'institucion:id,nombre'])->findOrFail($id);

        return response()->json($visita);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $visita = Visita::findOrFail($id);

        $validated = $request->validate([
            'user_id' => 'nullable|exists:users,id',
            'institucion_id' => 'nullable|exists:instituciones,id',
            'institucion_nombre' => 'nullable|string|max:255',
            'fecha_planificada' => 'nullable|date',
            'fecha_realizada' => 'nullable|date',
            'status' => 'nullable|in:Planificada,Completada,Cancelada,Reprogramada',
            'notas' => 'nullable|string|max:1000',
            'resultado' => 'nullable|string|max:1000',
            'contacto_nombre' => 'nullable|string|max:255',
            'contacto_telefono' => 'nullable|string|max:50',
            'contacto_email' => 'nullable|email|max:255',
        ]);

        $oldData = $visita->toArray();
        $visita->update($validated);

        $changes = $this->getChanges($oldData, $visita->fresh()->toArray());
        $this->logActivity('update', 'Visitas', $visita, 'Visita #' . $visita->id, $changes, $request);

        return response()->json($visita->load(['user:id,name', 'institucion:id,nombre']));
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $visita = Visita::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|in:Planificada,Completada,Cancelada,Reprogramada',
            'resultado' => 'nullable|string|max:1000',
            'fecha_realizada' => 'nullable|date',
        ]);

        if ($validated['status'] === 'Completada' && !isset($validated['fecha_realizada'])) {
            $validated['fecha_realizada'] = now()->toDateString();
        }

        $visita->update($validated);

        $this->logActivity('update_status', 'Visitas', $visita, 'Visita #' . $visita->id, [], $request);

        if ($validated['status'] === 'Completada') {
            $this->dispararAutoTarea('visita_completada', 'VISITA-' . $visita->id,
                "Visita completada: {$visita->title}");
        }

        return response()->json($visita->load(['user:id,name', 'institucion:id,nombre']));
    }

    public function destroy(int $id): JsonResponse
    {
        $visita = Visita::findOrFail($id);

        $this->logActivity('delete', 'Visitas', $visita, 'Visita #' . $visita->id);

        $visita->delete();

        return response()->json(null, 204);
    }
}
