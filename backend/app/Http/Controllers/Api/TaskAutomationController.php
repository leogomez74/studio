<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaskAutomation;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskAutomationController extends Controller
{
    use LogsActivity;

    public function index()
    {
        return TaskAutomation::with(['assignee:id,name', 'assignees:id,name', 'checklistItems'])->get();
    }

    public function upsert(Request $request)
    {
        $validated = $request->validate([
            'event_type' => 'required|string|max:50',
            'title' => 'required|string|max:255',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'assigned_to_ids' => 'nullable|array',
            'assigned_to_ids.*' => 'integer|exists:users,id',
            'priority' => 'nullable|string|in:alta,media,baja',
            'due_days_offset' => 'nullable|integer|min:0|max:365',
            'is_active' => 'required|boolean',
            'checklist_items' => 'nullable|array',
            'checklist_items.*.title' => 'required|string|max:255',
        ]);

        $checklistItems = $validated['checklist_items'] ?? null;
        $assigneeIds = $validated['assigned_to_ids'] ?? null;
        unset($validated['checklist_items'], $validated['assigned_to_ids']);

        // Si se envían assigned_to_ids, usar el primero como assigned_to legacy
        if ($assigneeIds !== null && count($assigneeIds) > 0) {
            $validated['assigned_to'] = $assigneeIds[0];
        }

        $automation = TaskAutomation::updateOrCreate(
            ['event_type' => $validated['event_type']],
            $validated
        );

        // Sincronizar assignees en tabla pivote
        if ($assigneeIds !== null) {
            $automation->assignees()->sync($assigneeIds);
        }

        // Sincronizar checklist items si se enviaron
        if ($checklistItems !== null) {
            $automation->checklistItems()->delete();
            foreach ($checklistItems as $index => $item) {
                $automation->checklistItems()->create([
                    'title' => $item['title'],
                    'sort_order' => $index,
                ]);
            }
        }

        $this->logActivity('upsert', 'Automatización Tareas', $automation, $automation->title, null, $request);

        return response()->json($automation->load(['assignee:id,name', 'assignees:id,name', 'checklistItems']));
    }

    public function destroy(TaskAutomation $taskAutomation, Request $request): JsonResponse
    {
        $this->logActivity('delete', 'Automatización Tareas', $taskAutomation, $taskAutomation->title, null, $request);

        $taskAutomation->delete();

        return response()->json(null, 204);
    }
}
