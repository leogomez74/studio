<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaskWorkflow;
use App\Models\TaskWorkflowStatus;
use App\Models\TaskWorkflowTransition;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TaskWorkflowController extends Controller
{
    public function index()
    {
        $workflows = TaskWorkflow::withCount(['statuses', 'tasks'])
            ->orderBy('is_default', 'desc')
            ->orderBy('name')
            ->get();

        return response()->json($workflows);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:7',
            'is_default' => 'nullable|boolean',
            'statuses' => 'required|array|min:2',
            'statuses.*.name' => 'required|string|max:100',
            'statuses.*.color' => 'nullable|string|max:7',
            'statuses.*.icon' => 'nullable|string|max:50',
            'statuses.*.is_initial' => 'nullable|boolean',
            'statuses.*.is_terminal' => 'nullable|boolean',
            'statuses.*.is_closed' => 'nullable|boolean',
            'transitions' => 'nullable|array',
            'transitions.*.from_index' => 'required|integer|min:0',
            'transitions.*.to_index' => 'required|integer|min:0',
            'transitions.*.name' => 'nullable|string|max:100',
            'transitions.*.points_award' => 'nullable|integer|min:0',
            'transitions.*.xp_award' => 'nullable|integer|min:0',
        ]);

        // If setting as default, unset current default
        if (!empty($validated['is_default'])) {
            TaskWorkflow::where('is_default', true)->update(['is_default' => false]);
        }

        $workflow = TaskWorkflow::create([
            'name' => $validated['name'],
            'slug' => Str::slug($validated['name']),
            'description' => $validated['description'] ?? null,
            'color' => $validated['color'] ?? '#3b82f6',
            'is_default' => $validated['is_default'] ?? false,
            'created_by' => auth('sanctum')->id(),
        ]);

        // Create statuses
        $statusIds = [];
        foreach ($validated['statuses'] as $i => $statusData) {
            $status = $workflow->statuses()->create([
                'name' => $statusData['name'],
                'slug' => Str::slug($statusData['name']),
                'color' => $statusData['color'] ?? '#6b7280',
                'icon' => $statusData['icon'] ?? null,
                'sort_order' => $i + 1,
                'is_initial' => $statusData['is_initial'] ?? ($i === 0),
                'is_terminal' => $statusData['is_terminal'] ?? false,
                'is_closed' => $statusData['is_closed'] ?? false,
            ]);
            $statusIds[] = $status->id;
        }

        // Create transitions
        if (!empty($validated['transitions'])) {
            foreach ($validated['transitions'] as $t) {
                if (isset($statusIds[$t['from_index']], $statusIds[$t['to_index']])) {
                    $workflow->transitions()->create([
                        'from_status_id' => $statusIds[$t['from_index']],
                        'to_status_id' => $statusIds[$t['to_index']],
                        'name' => $t['name'] ?? null,
                        'points_award' => $t['points_award'] ?? 0,
                        'xp_award' => $t['xp_award'] ?? 0,
                    ]);
                }
            }
        }

        return response()->json(
            $workflow->load(['statuses', 'transitions.fromStatus', 'transitions.toStatus']),
            201
        );
    }

    public function show(string $id)
    {
        $workflow = TaskWorkflow::with([
            'statuses',
            'transitions.fromStatus',
            'transitions.toStatus',
        ])->withCount('tasks')->findOrFail($id);

        return response()->json($workflow);
    }

    public function update(Request $request, string $id)
    {
        $workflow = TaskWorkflow::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:7',
            'is_default' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
        ]);

        if (!empty($validated['is_default']) && !$workflow->is_default) {
            TaskWorkflow::where('is_default', true)->update(['is_default' => false]);
        }

        if (isset($validated['name']) && $validated['name'] !== $workflow->name) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        $workflow->update($validated);

        return response()->json($workflow);
    }

    public function destroy(string $id)
    {
        $workflow = TaskWorkflow::withCount('tasks')->findOrFail($id);

        if ($workflow->is_default) {
            return response()->json(['message' => 'No se puede eliminar el flujo por defecto.'], 422);
        }

        if ($workflow->tasks_count > 0) {
            // Deactivate instead of delete
            $workflow->update(['is_active' => false]);
            return response()->json(['message' => 'Flujo desactivado (tiene tareas asociadas).']);
        }

        $workflow->delete();
        return response()->json(null, 204);
    }

    // --- Status management ---

    public function statuses(string $id)
    {
        $workflow = TaskWorkflow::findOrFail($id);
        return response()->json($workflow->statuses);
    }

    public function storeStatus(Request $request, string $id)
    {
        $workflow = TaskWorkflow::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'color' => 'nullable|string|max:7',
            'icon' => 'nullable|string|max:50',
            'is_initial' => 'nullable|boolean',
            'is_terminal' => 'nullable|boolean',
            'is_closed' => 'nullable|boolean',
        ]);

        // If setting as initial, unset current initial
        if (!empty($validated['is_initial'])) {
            $workflow->statuses()->where('is_initial', true)->update(['is_initial' => false]);
        }

        $maxOrder = $workflow->statuses()->max('sort_order') ?? 0;

        $status = $workflow->statuses()->create([
            'name' => $validated['name'],
            'slug' => Str::slug($validated['name']),
            'color' => $validated['color'] ?? '#6b7280',
            'icon' => $validated['icon'] ?? null,
            'sort_order' => $maxOrder + 1,
            'is_initial' => $validated['is_initial'] ?? false,
            'is_terminal' => $validated['is_terminal'] ?? false,
            'is_closed' => $validated['is_closed'] ?? false,
        ]);

        return response()->json($status, 201);
    }

    public function updateStatus(Request $request, string $id, string $statusId)
    {
        $status = TaskWorkflowStatus::where('workflow_id', $id)->findOrFail($statusId);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'color' => 'nullable|string|max:7',
            'icon' => 'nullable|string|max:50',
            'is_initial' => 'nullable|boolean',
            'is_terminal' => 'nullable|boolean',
            'is_closed' => 'nullable|boolean',
        ]);

        if (!empty($validated['is_initial']) && !$status->is_initial) {
            TaskWorkflowStatus::where('workflow_id', $id)->where('is_initial', true)->update(['is_initial' => false]);
        }

        if (isset($validated['name']) && $validated['name'] !== $status->name) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        $status->update($validated);

        return response()->json($status);
    }

    public function deleteStatus(string $id, string $statusId)
    {
        $status = TaskWorkflowStatus::where('workflow_id', $id)->withCount('tasks')->findOrFail($statusId);

        if ($status->tasks_count > 0) {
            return response()->json(['message' => 'No se puede eliminar un estado con tareas asociadas.'], 422);
        }

        $status->delete();
        return response()->json(null, 204);
    }

    public function reorderStatuses(Request $request, string $id)
    {
        TaskWorkflow::findOrFail($id);

        $validated = $request->validate([
            'order' => 'required|array',
            'order.*' => 'required|integer|exists:task_workflow_statuses,id',
        ]);

        foreach ($validated['order'] as $index => $statusId) {
            TaskWorkflowStatus::where('id', $statusId)
                ->where('workflow_id', $id)
                ->update(['sort_order' => $index + 1]);
        }

        return response()->json(['message' => 'Orden actualizado.']);
    }

    // --- Transition management ---

    public function transitions(string $id)
    {
        $workflow = TaskWorkflow::findOrFail($id);
        return response()->json(
            $workflow->transitions()->with(['fromStatus', 'toStatus'])->get()
        );
    }

    public function storeTransition(Request $request, string $id)
    {
        $workflow = TaskWorkflow::findOrFail($id);

        $validated = $request->validate([
            'from_status_id' => 'required|integer|exists:task_workflow_statuses,id',
            'to_status_id' => 'required|integer|exists:task_workflow_statuses,id|different:from_status_id',
            'name' => 'nullable|string|max:100',
            'points_award' => 'nullable|integer|min:0',
            'xp_award' => 'nullable|integer|min:0',
        ]);

        // Verify both statuses belong to this workflow
        $statusIds = $workflow->statuses()->pluck('id')->toArray();
        if (!in_array($validated['from_status_id'], $statusIds) || !in_array($validated['to_status_id'], $statusIds)) {
            return response()->json(['message' => 'Los estados deben pertenecer a este flujo.'], 422);
        }

        $transition = $workflow->transitions()->updateOrCreate(
            [
                'from_status_id' => $validated['from_status_id'],
                'to_status_id' => $validated['to_status_id'],
            ],
            [
                'name' => $validated['name'] ?? null,
                'points_award' => $validated['points_award'] ?? 0,
                'xp_award' => $validated['xp_award'] ?? 0,
            ]
        );

        return response()->json($transition->load(['fromStatus', 'toStatus']), 201);
    }

    public function deleteTransition(string $id, string $transitionId)
    {
        $transition = TaskWorkflowTransition::where('workflow_id', $id)->findOrFail($transitionId);
        $transition->delete();

        return response()->json(null, 204);
    }
}
