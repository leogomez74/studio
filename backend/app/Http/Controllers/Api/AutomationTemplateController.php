<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AutomationTemplate;
// AutomationTemplateChecklistItem is accessed via relation, no direct use needed
use App\Services\AutomationConditionEvaluator;
use App\Services\AutomationEventDispatcher;
use App\Services\AutomationTemplateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AutomationTemplateController extends Controller
{
    public function __construct(
        private AutomationTemplateService $service,
        private AutomationConditionEvaluator $evaluator,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    //  CRUD
    // ─────────────────────────────────────────────────────────────────────────

    public function index(): JsonResponse
    {
        $templates = AutomationTemplate::with(['assignees:id,name', 'checklistItems'])
            ->orderBy('module')
            ->orderBy('name')
            ->get();

        return response()->json($templates);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'             => 'required|string|max:255',
            'module'           => 'required|string|in:' . implode(',', array_keys(config('automation_variables'))),
            'trigger_type'     => 'required|in:scheduled,event',
            'cron_expression'  => 'nullable|string|max:100|required_if:trigger_type,scheduled',
            'event_key'        => 'nullable|string|max:100|required_if:trigger_type,event',
            'condition_json'   => 'nullable|array',
            'condition_json.logic' => 'nullable|in:AND,OR',
            'condition_json.rules' => 'nullable|array',
            'default_title'    => 'required|string|max:255',
            'description'      => 'nullable|string',
            'priority'         => 'nullable|in:alta,media,baja',
            'due_days_offset'  => 'nullable|integer|min:0|max:365',
            'workflow_id'      => 'nullable|integer|exists:task_workflows,id',
            'is_active'        => 'boolean',
            'assignee_ids'     => 'nullable|array',
            'assignee_ids.*'   => 'integer|exists:users,id',
            'checklist_items'  => 'nullable|array',
            'checklist_items.*.title' => 'required|string|max:255',
        ]);

        $template = DB::transaction(function () use ($data, $request) {
            $template = AutomationTemplate::create([
                ...$data,
                'created_by' => $request->user()->id,
            ]);

            if (!empty($data['assignee_ids'])) {
                $template->assignees()->sync($data['assignee_ids']);
            }

            if (!empty($data['checklist_items'])) {
                foreach ($data['checklist_items'] as $i => $item) {
                    $template->checklistItems()->create([
                        'title'      => $item['title'],
                        'sort_order' => $i,
                    ]);
                }
            }

            return $template->load(['assignees:id,name', 'checklistItems']);
        });

        return response()->json($template, 201);
    }

    public function show(AutomationTemplate $automationTemplate): JsonResponse
    {
        return response()->json(
            $automationTemplate->load(['assignees:id,name', 'checklistItems', 'executions' => fn ($q) => $q->limit(20)])
        );
    }

    public function update(Request $request, AutomationTemplate $automationTemplate): JsonResponse
    {
        $data = $request->validate([
            'name'             => 'sometimes|string|max:255',
            'module'           => 'sometimes|string|in:' . implode(',', array_keys(config('automation_variables'))),
            'trigger_type'     => 'sometimes|in:scheduled,event',
            'cron_expression'  => 'nullable|string|max:100',
            'event_key'        => 'nullable|string|max:100',
            'condition_json'   => 'nullable|array',
            'condition_json.logic' => 'nullable|in:AND,OR',
            'condition_json.rules' => 'nullable|array',
            'default_title'    => 'sometimes|string|max:255',
            'description'      => 'nullable|string',
            'priority'         => 'nullable|in:alta,media,baja',
            'due_days_offset'  => 'nullable|integer|min:0|max:365',
            'workflow_id'      => 'nullable|integer|exists:task_workflows,id',
            'is_active'        => 'boolean',
            'assignee_ids'     => 'nullable|array',
            'assignee_ids.*'   => 'integer|exists:users,id',
            'checklist_items'  => 'nullable|array',
            'checklist_items.*.title' => 'required_with:checklist_items|string|max:255',
        ]);

        DB::transaction(function () use ($data, $automationTemplate) {
            $automationTemplate->update($data);

            if (\array_key_exists('assignee_ids', $data)) {
                $automationTemplate->assignees()->sync($data['assignee_ids'] ?? []);
            }

            if (\array_key_exists('checklist_items', $data)) {
                $automationTemplate->checklistItems()->delete();
                foreach ($data['checklist_items'] ?? [] as $i => $item) {
                    $automationTemplate->checklistItems()->create([
                        'title'      => $item['title'],
                        'sort_order' => $i,
                    ]);
                }
            }
        });

        return response()->json($automationTemplate->load(['assignees:id,name', 'checklistItems']));
    }

    public function destroy(AutomationTemplate $automationTemplate): JsonResponse
    {
        $automationTemplate->delete();
        return response()->json(['message' => 'Plantilla eliminada']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Variables disponibles (para el constructor de condiciones en el front)
    // ─────────────────────────────────────────────────────────────────────────

    public function variables(): JsonResponse
    {
        $modules = config('automation_variables');
        $operatorsByType = AutomationConditionEvaluator::operatorsByType();

        $result = [];
        foreach ($modules as $key => $config) {
            $fields = [];
            foreach ($config['fields'] as $fieldKey => $fieldConfig) {
                $fields[] = [
                    'key'       => $fieldKey,
                    'label'     => $fieldConfig['label'],
                    'type'      => $fieldConfig['type'],
                    'operators' => $operatorsByType[$fieldConfig['type']] ?? [],
                    'options'   => $fieldConfig['options'] ?? null,
                ];
            }

            $result[] = [
                'key'    => $key,
                'label'  => $config['label'],
                'fields' => $fields,
            ];
        }

        return response()->json($result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Event hooks catalog — eventos de código disponibles para tipo "event"
    // ─────────────────────────────────────────────────────────────────────────

    public function eventHooks(): JsonResponse
    {
        return response()->json(AutomationEventDispatcher::catalog());
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Evaluate — preview de registros que cumplen la condición
    // ─────────────────────────────────────────────────────────────────────────

    public function evaluateCondition(AutomationTemplate $automationTemplate): JsonResponse
    {
        try {
            $records = $this->service->evaluate($automationTemplate);
            return response()->json([
                'count'   => \count($records),
                'records' => $records,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Execute — crear tareas
    // ─────────────────────────────────────────────────────────────────────────

    public function execute(Request $request, AutomationTemplate $automationTemplate): JsonResponse
    {
        $data = $request->validate([
            'record_ids'   => 'nullable|array',
            'record_ids.*' => 'integer',
        ]);

        try {
            $result = $this->service->execute(
                $automationTemplate,
                $data['record_ids'] ?? null,
                $request->user()->id,
            );

            return response()->json([
                'message' => "{$result['created']} tarea(s) creada(s), {$result['skipped']} omitida(s).",
                'created' => $result['created'],
                'skipped' => $result['skipped'],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }
}
