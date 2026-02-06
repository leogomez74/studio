<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Task::with('assignee:id,name,email');

        // Filtrar tareas eliminadas por defecto
        if ($request->input('with_deleted') !== '1') {
            $query->whereNotIn('status', ['deleted']);
        }

        // Por defecto, solo mostrar tareas del usuario autenticado
        // a menos que tenga permiso "ver todas" o esté filtrando por project_code (detalle de análisis)
        $user = auth('sanctum')->user();
        if ($user && !$request->filled('project_code')) {
            $canViewAll = false;
            if ($user->role) {
                $permissions = $user->role->getFormattedPermissions();
                $canViewAll = $permissions['tareas']['view'] ?? false;
            }
            if (!$canViewAll) {
                $query->where('assigned_to', $user->id);
            }
        }

        // Filtros opcionales
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }

        if ($request->filled('assigned_to')) {
            $query->where('assigned_to', $request->assigned_to);
        }

        if ($request->filled('project_code')) {
            $query->where('project_code', $request->project_code);
        }

        return $query->orderBy('created_at', 'desc')->get();
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_code' => 'nullable|string|max:50',
            'project_name' => 'nullable|string|max:255',
            'title' => 'required|string|max:255',
            'details' => 'nullable|string',
            'status' => 'nullable|string|in:pendiente,en_progreso,completada,archivada,deleted',
            'priority' => 'nullable|string|in:alta,media,baja',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $task = Task::create($validated);

        return response()->json($task->load('assignee'), 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $task = Task::with('assignee:id,name,email')->findOrFail($id);

        return response()->json($task);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $task = Task::findOrFail($id);

        $validated = $request->validate([
            'project_code' => 'nullable|string|max:50',
            'project_name' => 'nullable|string|max:255',
            'title' => 'sometimes|required|string|max:255',
            'details' => 'nullable|string',
            'status' => 'sometimes|string|in:pendiente,en_progreso,completada,archivada,deleted',
            'priority' => 'sometimes|string|in:alta,media,baja',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $task->update($validated);

        return response()->json($task->load('assignee'));
    }

    /**
     * Remove the specified resource from storage (soft delete).
     */
    public function destroy(string $id)
    {
        $task = Task::findOrFail($id);

        // Soft delete: marca como "deleted" en lugar de eliminar físicamente
        $task->update([
            'status' => 'deleted',
        ]);

        return response()->json([
            'message' => 'Tarea eliminada correctamente',
        ]);
    }

    /**
     * Archive the specified task.
     */
    public function archive(string $id)
    {
        $task = Task::findOrFail($id);

        $task->update([
            'status' => 'archivada',
        ]);

        return response()->json([
            'message' => 'Tarea archivada correctamente',
            'task' => $task->load('assignee'),
        ]);
    }

    /**
     * Restore an archived or deleted task.
     */
    public function restore(string $id)
    {
        $task = Task::findOrFail($id);

        $task->update([
            'status' => 'pendiente',
        ]);

        return response()->json([
            'message' => 'Tarea restaurada correctamente',
            'task' => $task->load('assignee'),
        ]);
    }
}
