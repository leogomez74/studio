<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TareaRuta;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class TareaRutaController extends Controller
{
    use LogsActivity;

    public function index(Request $request)
    {
        $query = TareaRuta::with(['solicitante:id,name', 'asignado:id,name', 'rutaDiaria:id,fecha,status']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('tipo')) {
            $query->where('tipo', $request->tipo);
        }
        if ($request->filled('prioridad')) {
            $query->where('prioridad', $request->prioridad);
        }
        if ($request->filled('fecha_desde')) {
            $query->whereDate('created_at', '>=', $request->fecha_desde);
        }
        if ($request->filled('fecha_hasta')) {
            $query->whereDate('created_at', '<=', $request->fecha_hasta);
        }
        if ($request->filled('ruta_diaria_id')) {
            $query->where('ruta_diaria_id', $request->ruta_diaria_id);
        }

        $tareas = $query->ordenFifo()->get();

        return response()->json($tareas);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'titulo' => 'required|string|max:255',
            'descripcion' => 'nullable|string|max:1000',
            'tipo' => 'required|in:entrega,recoleccion,tramite,deposito,otro',
            'prioridad' => 'nullable|in:normal,urgente,critica',
            'empresa_destino' => 'nullable|string|max:255',
            'direccion_destino' => 'nullable|string|max:500',
            'provincia' => 'nullable|string|max:100',
            'canton' => 'nullable|string|max:100',
            'contacto_nombre' => 'nullable|string|max:255',
            'contacto_telefono' => 'nullable|string|max:50',
            'fecha_limite' => 'nullable|date',
            'referencia_tipo' => 'nullable|string|max:255',
            'referencia_id' => 'nullable|integer',
        ]);

        $validated['solicitado_por'] = Auth::id();
        $validated['status'] = 'pendiente';

        $tarea = TareaRuta::create($validated);

        $this->logActivity('create', 'Rutas', $tarea, $tarea->titulo, [], $request);

        return response()->json($tarea->load(['solicitante:id,name']), 201);
    }

    public function show(string $id)
    {
        $tarea = TareaRuta::with(['solicitante:id,name', 'asignado:id,name', 'rutaDiaria', 'prioridadPor:id,name'])
            ->findOrFail($id);

        return response()->json($tarea);
    }

    public function update(Request $request, string $id)
    {
        $tarea = TareaRuta::findOrFail($id);

        $validated = $request->validate([
            'titulo' => 'sometimes|required|string|max:255',
            'descripcion' => 'nullable|string|max:1000',
            'tipo' => 'sometimes|in:entrega,recoleccion,tramite,deposito,otro',
            'prioridad' => 'sometimes|in:normal,urgente,critica',
            'empresa_destino' => 'nullable|string|max:255',
            'direccion_destino' => 'nullable|string|max:500',
            'provincia' => 'nullable|string|max:100',
            'canton' => 'nullable|string|max:100',
            'contacto_nombre' => 'nullable|string|max:255',
            'contacto_telefono' => 'nullable|string|max:50',
            'fecha_limite' => 'nullable|date',
        ]);

        // Only update explicitly allowed fields (defense-in-depth vs broad $fillable)
        $tarea->update($request->only([
            'titulo', 'descripcion', 'tipo', 'prioridad',
            'empresa_destino', 'direccion_destino', 'provincia', 'canton',
            'contacto_nombre', 'contacto_telefono', 'fecha_limite',
        ]));

        $this->logActivity('update', 'Rutas', $tarea, $tarea->titulo, [], $request);

        return response()->json($tarea->load(['solicitante:id,name', 'asignado:id,name']));
    }

    public function destroy(string $id)
    {
        $tarea = TareaRuta::findOrFail($id);

        if (!in_array($tarea->status, ['pendiente', 'cancelada', 'fallida'])) {
            return response()->json(['message' => 'Solo se pueden eliminar tareas pendientes, fallidas o canceladas.'], 422);
        }

        $this->logActivity('delete', 'Rutas', $tarea, $tarea->titulo);
        $tarea->delete();

        return response()->json(['message' => 'Tarea eliminada.']);
    }

    public function completar(Request $request, string $id)
    {
        $validated = $request->validate([
            'notas_completado' => 'nullable|string|max:1000',
        ]);

        return DB::transaction(function () use ($id, $validated, $request) {
            $user = Auth::user();
            $tarea = TareaRuta::lockForUpdate()->findOrFail($id);

            // Only the assigned mensajero or admin can complete a task
            if (!$user->role?->full_access && $tarea->asignado_a !== $user->id) {
                return response()->json(['message' => 'No autorizado.'], 403);
            }

            if (!in_array($tarea->status, ['asignada', 'en_transito'])) {
                return response()->json(['message' => 'La tarea debe estar asignada o en tránsito para completarla.'], 422);
            }

            $tarea->update([
                'status' => 'completada',
                'completada_at' => now(),
                'notas_completado' => $validated['notas_completado'] ?? null,
            ]);

            // Recalcular conteo de la ruta
            if ($tarea->ruta_diaria_id) {
                $tarea->rutaDiaria->recalcularConteo();
            }

            $this->logActivity('update', 'Rutas', $tarea, "Completada: {$tarea->titulo}", [], $request);

            return response()->json($tarea);
        });
    }

    public function fallar(Request $request, string $id)
    {
        $validated = $request->validate([
            'motivo_fallo' => 'required|string|max:500',
        ]);

        return DB::transaction(function () use ($id, $validated, $request) {
            $user = Auth::user();
            $tarea = TareaRuta::lockForUpdate()->findOrFail($id);

            // Only the assigned mensajero or admin can report failure
            if (!$user->role?->full_access && $tarea->asignado_a !== $user->id) {
                return response()->json(['message' => 'No autorizado.'], 403);
            }

            if (!in_array($tarea->status, ['asignada', 'en_transito'])) {
                return response()->json(['message' => 'La tarea debe estar asignada o en tránsito para reportar fallo.'], 422);
            }

            // Marcar como fallida, desasociar de la ruta
            $rutaId = $tarea->ruta_diaria_id;

            $tarea->update([
                'status' => 'fallida',
                'motivo_fallo' => $validated['motivo_fallo'],
                'ruta_diaria_id' => null,
                'fecha_asignada' => null,
                'posicion' => null,
                'asignado_a' => null,
            ]);

            if ($rutaId) {
                $tarea->rutaDiaria()->getRelated()->find($rutaId)?->recalcularConteo();
            }

            $this->logActivity('update', 'Rutas', $tarea, "Fallida: {$tarea->titulo}", [], $request);

            return response()->json($tarea);
        });
    }

    public function overridePrioridad(Request $request, string $id)
    {
        $tarea = TareaRuta::findOrFail($id);

        $validated = $request->validate([
            'prioridad' => 'required|in:normal,urgente,critica',
        ]);

        $tarea->update([
            'prioridad' => $validated['prioridad'],
            'prioridad_override' => true,
            'prioridad_por' => Auth::id(),
        ]);

        $this->logActivity('update', 'Rutas', $tarea, "Prioridad override: {$tarea->titulo} → {$validated['prioridad']}", [], $request);

        return response()->json($tarea);
    }
}
