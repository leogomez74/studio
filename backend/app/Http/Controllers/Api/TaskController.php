<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    use LogsActivity;
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

        $this->logActivity('create', 'Tareas', $task, $task->title, [], $request);

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
        $oldData = $task->toArray();

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

        $this->logActivity('update', 'Tareas', $task, $task->title, $this->getChanges($oldData, $task->fresh()->toArray()), $request);

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

        $this->logActivity('delete', 'Tareas', $task, $task->title);

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

        $this->logActivity('update', 'Tareas', $task, $task->title);

        return response()->json([
            'message' => 'Tarea archivada correctamente',
            'task' => $task->load('assignee'),
        ]);
    }

    /**
     * Get overdue tasks count for the authenticated user.
     */
    public function overdueCount()
    {
        $user = auth('sanctum')->user();
        $query = Task::whereIn('status', ['pendiente', 'en_progreso'])
            ->whereNotNull('due_date')
            ->where('due_date', '<', now()->toDateString());

        if ($user) {
            $canViewAll = false;
            if ($user->role) {
                $permissions = $user->role->getFormattedPermissions();
                $canViewAll = $permissions['tareas']['view'] ?? false;
            }
            if (!$canViewAll) {
                $query->where('assigned_to', $user->id);
            }
        }

        $tasks = $query->with('assignee:id,name')->orderBy('due_date', 'asc')->limit(10)->get();

        return response()->json([
            'count' => $query->count(),
            'tasks' => $tasks->map(fn ($t) => [
                'id' => $t->id,
                'title' => $t->title,
                'due_date' => $t->due_date?->format('Y-m-d'),
                'priority' => $t->priority,
                'assignee' => $t->assignee?->name,
                'days_overdue' => $t->due_date ? (int) now()->diffInDays($t->due_date) : 0,
            ]),
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
