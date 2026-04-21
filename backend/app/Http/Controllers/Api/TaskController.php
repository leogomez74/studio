<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Task;
use App\Models\TaskChecklistItem;
use App\Models\TaskDocument;
use App\Models\TaskWatcher;
use App\Models\TaskWorkflow;
use App\Models\TaskWorkflowTransition;
use App\Events\TaskCompleted;
use App\Events\TaskStatusChanged;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class TaskController extends Controller
{
    use LogsActivity;

    public function index(Request $request)
    {
        $query = Task::with([
            'assignee:id,name,email',
            'workflowStatus:id,workflow_id,name,slug,color,icon,is_initial,is_terminal,is_closed',
            'workflow:id,name,slug,color',
            'labels:id,name,color',
        ]);

        if ($request->input('with_deleted') !== '1') {
            $query->whereNotIn('status', ['deleted']);
        }

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

        if ($request->filled('workflow_id')) {
            $query->where('workflow_id', $request->workflow_id);
        }

        if ($request->filled('workflow_status_id')) {
            $query->where('workflow_status_id', $request->workflow_status_id);
        }

        if ($request->filled('label_id')) {
            $query->whereHas('labels', fn ($q) => $q->where('task_labels.id', $request->label_id));
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('reference', 'LIKE', "%{$search}%")
                  ->orWhere('title', 'LIKE', "%{$search}%")
                  ->orWhere('project_code', 'LIKE', "%{$search}%");
            });
        }

        return $query->orderBy('created_at', 'desc')->get();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_code' => ['nullable', 'string', 'max:50', 'regex:/^(LEAD|OPP|ANA|CRED|CLIENT)-.+$/'],
            'project_name' => 'nullable|string|max:255',
            'title' => 'required|string|max:255',
            'details' => 'nullable|string',
            'status' => 'nullable|string|in:pendiente,en_progreso,completada,archivada,deleted',
            'priority' => 'nullable|string|in:alta,media,baja',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date|after_or_equal:start_date',
            'workflow_id' => 'nullable|integer|exists:task_workflows,id',
            'estimated_hours' => 'nullable|numeric|min:0',
            'label_ids' => 'nullable|array',
            'label_ids.*' => 'integer|exists:task_labels,id',
            'watcher_ids' => 'nullable|array',
            'watcher_ids.*' => 'integer|exists:users,id',
        ]);

        // If workflow specified, set initial status
        if (!empty($validated['workflow_id'])) {
            $workflow = TaskWorkflow::findOrFail($validated['workflow_id']);
            $initialStatus = $workflow->initialStatus();
            if ($initialStatus) {
                $validated['workflow_status_id'] = $initialStatus->id;
            }
        } elseif (!isset($validated['workflow_id'])) {
            // Use default workflow if none specified
            $defaultWorkflow = TaskWorkflow::where('is_default', true)->first();
            if ($defaultWorkflow) {
                $validated['workflow_id'] = $defaultWorkflow->id;
                $initialStatus = $defaultWorkflow->initialStatus();
                if ($initialStatus) {
                    $validated['workflow_status_id'] = $initialStatus->id;
                }
            }
        }

        $validated['created_by'] = auth('sanctum')->id();

        // Remove non-model fields
        $labelIds = $validated['label_ids'] ?? [];
        $watcherIds = $validated['watcher_ids'] ?? [];
        unset($validated['label_ids'], $validated['watcher_ids']);

        $task = Task::create($validated);

        // Attach labels
        if (!empty($labelIds)) {
            $task->labels()->sync($labelIds);
        }

        // Add watchers
        foreach ($watcherIds as $watcherId) {
            $task->watchers()->firstOrCreate(['user_id' => $watcherId]);
        }

        $this->logActivity('create', 'Tareas', $task, $task->title, [], $request);

        // Notify assigned user
        if ($task->assigned_to && $task->assigned_to !== auth('sanctum')->id()) {
            $this->notifyTaskAssigned($task);
        }

        return response()->json($task->load(['assignee', 'workflowStatus', 'workflow', 'labels']), 201);
    }

    public function show(string $id)
    {
        $task = Task::with([
            'assignee:id,name,email',
            'creator:id,name,email',
            'workflowStatus',
            'workflow.statuses',
            'workflow.transitions.fromStatus',
            'workflow.transitions.toStatus',
            'labels',
            'watchers.user:id,name,email',
        ])->findOrFail($id);

        // Add available transitions for current status
        $availableTransitions = [];
        if ($task->workflow_status_id && $task->workflow_id) {
            $availableTransitions = TaskWorkflowTransition::where('workflow_id', $task->workflow_id)
                ->where('from_status_id', $task->workflow_status_id)
                ->with('toStatus:id,name,slug,color,icon,is_terminal,is_closed')
                ->get()
                ->map(fn ($t) => [
                    'id' => $t->id,
                    'name' => $t->name,
                    'to_status' => $t->toStatus,
                    'points_award' => $t->points_award,
                    'xp_award' => $t->xp_award,
                ]);
        }

        $taskData = $task->toArray();
        $taskData['available_transitions'] = $availableTransitions;

        return response()->json($taskData);
    }

    public function update(Request $request, string $id)
    {
        $task = Task::findOrFail($id);
        $oldData = $task->toArray();
        $oldAssignedTo = $task->assigned_to;

        $validated = $request->validate([
            'project_code' => ['nullable', 'string', 'max:50', 'regex:/^(LEAD|OPP|ANA|CRED|CLIENT)-.+$/'],
            'project_name' => 'nullable|string|max:255',
            'title' => 'sometimes|required|string|max:255',
            'details' => 'nullable|string',
            'status' => 'sometimes|string|in:pendiente,en_progreso,completada,archivada,deleted',
            'priority' => 'sometimes|string|in:alta,media,baja',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date|after_or_equal:start_date',
            'estimated_hours' => 'nullable|numeric|min:0',
            'actual_hours' => 'nullable|numeric|min:0',
        ]);

        $task->update($validated);

        $this->logActivity('update', 'Tareas', $task, $task->title, $this->getChanges($oldData, $task->fresh()->toArray()), $request);

        // Notify if assignee changed
        if (isset($validated['assigned_to']) && $validated['assigned_to'] !== $oldAssignedTo && $validated['assigned_to'] !== auth('sanctum')->id()) {
            $this->notifyTaskAssigned($task->fresh());
        }

        return response()->json($task->load(['assignee', 'workflowStatus', 'workflow', 'labels']));
    }

    /**
     * Transition a task to a new workflow status.
     */
    public function transition(Request $request, string $id)
    {
        $task = Task::with(['workflowStatus', 'workflow'])->findOrFail($id);

        if (!$task->workflow_id || !$task->workflow_status_id) {
            return response()->json(['message' => 'Esta tarea no tiene un flujo de trabajo asignado.'], 422);
        }

        $validated = $request->validate([
            'to_status_id' => 'required|integer|exists:task_workflow_statuses,id',
        ]);

        // Validate transition is allowed
        $transition = TaskWorkflowTransition::where('workflow_id', $task->workflow_id)
            ->where('from_status_id', $task->workflow_status_id)
            ->where('to_status_id', $validated['to_status_id'])
            ->first();

        if (!$transition) {
            return response()->json(['message' => 'Transición no permitida en este flujo.'], 422);
        }

        $fromStatus = $task->workflowStatus;
        $oldData = $task->toArray();

        $task->workflow_status_id = $validated['to_status_id'];
        $task->save();

        $task->load('workflowStatus');
        $toStatus = $task->workflowStatus;

        $this->logActivity('update', 'Tareas', $task, $task->title, [
            ['field' => 'estado', 'old_value' => $fromStatus->name, 'new_value' => $toStatus->name],
        ], $request);

        // Dispatch events
        $user = auth('sanctum')->user();
        event(new TaskStatusChanged($task, $fromStatus, $toStatus, $user, $transition));

        if ($toStatus->is_terminal) {
            event(new TaskCompleted($task, $user));
        }

        return response()->json([
            'task' => $task->load(['assignee', 'workflowStatus', 'workflow', 'labels']),
            'transition' => [
                'name' => $transition->name,
                'points_award' => $transition->points_award,
                'xp_award' => $transition->xp_award,
            ],
        ]);
    }

    /**
     * Get board data for a workflow (tasks grouped by status columns).
     */
    public function boardData(Request $request, string $workflowId)
    {
        $workflow = TaskWorkflow::with('statuses')->findOrFail($workflowId);

        $query = Task::where('workflow_id', $workflowId)
            ->whereNotIn('status', ['deleted'])
            ->with(['assignee:id,name,email', 'labels:id,name,color', 'workflowStatus:id,name,slug,color']);

        // Apply same permission logic
        $user = auth('sanctum')->user();
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

        if ($request->filled('assigned_to')) {
            $query->where('assigned_to', $request->assigned_to);
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }

        $tasks = $query->get();

        // Group by status
        $columns = $workflow->statuses->map(function ($status) use ($tasks) {
            return [
                'status' => $status,
                'tasks' => $tasks->where('workflow_status_id', $status->id)->values(),
            ];
        });

        return response()->json([
            'workflow' => $workflow,
            'columns' => $columns,
        ]);
    }

    // --- Watchers ---

    public function addWatcher(Request $request, string $id)
    {
        $task = Task::findOrFail($id);

        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $watcher = $task->watchers()->firstOrCreate(['user_id' => $validated['user_id']]);

        return response()->json($watcher->load('user:id,name,email'), 201);
    }

    public function removeWatcher(string $id, string $userId)
    {
        TaskWatcher::where('task_id', $id)->where('user_id', $userId)->delete();

        return response()->json(null, 204);
    }

    // --- Labels ---

    public function addLabel(Request $request, string $id)
    {
        $task = Task::findOrFail($id);

        $validated = $request->validate([
            'label_id' => 'required|integer|exists:task_labels,id',
        ]);

        $task->labels()->syncWithoutDetaching([$validated['label_id']]);

        return response()->json($task->labels, 200);
    }

    public function removeLabel(string $id, string $labelId)
    {
        $task = Task::findOrFail($id);
        $task->labels()->detach($labelId);

        return response()->json(null, 204);
    }

    // --- Existing methods (unchanged) ---

    public function destroy(string $id)
    {
        $task = Task::findOrFail($id);
        $task->update(['status' => 'deleted']);
        $this->logActivity('delete', 'Tareas', $task, $task->title);

        return response()->json(['message' => 'Tarea eliminada correctamente']);
    }

    public function archive(string $id)
    {
        $task = Task::findOrFail($id);
        $task->update(['status' => 'archivada']);
        $this->logActivity('update', 'Tareas', $task, $task->title);

        return response()->json([
            'message' => 'Tarea archivada correctamente',
            'task' => $task->load('assignee'),
        ]);
    }

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

    public function restore(string $id)
    {
        $task = Task::findOrFail($id);
        $task->update(['status' => 'pendiente']);

        return response()->json([
            'message' => 'Tarea restaurada correctamente',
            'task' => $task->load('assignee'),
        ]);
    }

    public function timeline(string $id)
    {
        Task::findOrFail($id);
        $logs = ActivityLog::where('model_type', 'App\\Models\\Task')
            ->where('model_id', $id)
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get(['id', 'user_name', 'action', 'changes', 'created_at']);

        return response()->json($logs);
    }

    public function documents(string $id)
    {
        $task = Task::findOrFail($id);
        return response()->json($task->documents()->with('uploader:id,name')->orderBy('created_at', 'desc')->get());
    }

    public function storeDocument(Request $request, string $id)
    {
        $task = Task::findOrFail($id);

        $request->validate([
            'file' => 'required|file|max:10240|mimes:pdf,jpg,jpeg,png,webp,gif,doc,docx,xls,xlsx,csv,txt,zip',
            'name' => 'required|string|max:255',
            'notes' => 'nullable|string|max:500',
        ]);

        $path = $request->file('file')->store('task-docs/' . $id, 'public');

        $doc = $task->documents()->create([
            'uploaded_by' => auth('sanctum')->id(),
            'name' => $request->name,
            'path' => $path,
            'url' => asset(Storage::url($path)),
            'mime_type' => $request->file('file')->getClientMimeType(),
            'size' => $request->file('file')->getSize(),
            'notes' => $request->notes,
        ]);

        $this->logActivity('upload', 'Tareas', $task, $task->title, [
            ['field' => 'documento', 'old_value' => null, 'new_value' => $request->name],
        ], $request);

        return response()->json($doc->load('uploader:id,name'), 201);
    }

    public function destroyDocument(string $id, string $documentId)
    {
        $doc = TaskDocument::where('task_id', $id)->findOrFail($documentId);
        $task = $doc->task;

        Storage::disk('public')->delete($doc->path);
        $doc->delete();

        $this->logActivity('delete', 'Tareas', $task, $task->title, [
            ['field' => 'documento', 'old_value' => $doc->name, 'new_value' => null],
        ]);

        return response()->json(null, 204);
    }

    public function checklistItems(string $id)
    {
        $task = Task::findOrFail($id);
        return response()->json($task->checklistItems);
    }

    public function storeChecklistItem(Request $request, string $id)
    {
        $task = Task::findOrFail($id);
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $item = $task->checklistItems()->create([
            'title' => $validated['title'],
            'sort_order' => $validated['sort_order'] ?? $task->checklistItems()->count(),
        ]);

        return response()->json($item, 201);
    }

    public function toggleChecklistItem(string $id, string $itemId)
    {
        $item = TaskChecklistItem::where('task_id', $id)->findOrFail($itemId);
        $item->is_completed = !$item->is_completed;
        $item->completed_at = $item->is_completed ? now() : null;
        $item->save();

        return response()->json($item);
    }

    public function destroyChecklistItem(string $id, string $itemId)
    {
        $item = TaskChecklistItem::where('task_id', $id)->findOrFail($itemId);
        $item->delete();
        return response()->json(null, 204);
    }

    // --- Private helpers ---

    private function notifyTaskAssigned(Task $task): void
    {
        try {
            $assignee = $task->assignee;
            if (!$assignee) return;

            $assigner = auth('sanctum')->user();
            \App\Models\Notification::create([
                'user_id' => $task->assigned_to,
                'type' => 'task_assigned',
                'title' => 'Nueva tarea asignada',
                'body' => "Se te asignó la tarea \"{$task->title}\" ({$task->reference})",
                'data' => [
                    'task_id' => $task->id,
                    'task_reference' => $task->reference,
                    'task_title' => $task->title,
                    'assigner_name' => $assigner?->name ?? 'Sistema',
                ],
            ]);
        } catch (\Throwable $e) {
            // Don't fail the main operation for notification errors
            \Log::warning('Failed to send task assignment notification: ' . $e->getMessage());
        }
    }
}
