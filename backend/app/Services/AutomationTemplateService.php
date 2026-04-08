<?php

namespace App\Services;

use App\Models\AutomationTemplate;
use App\Models\AutomationTemplateExecution;
use App\Models\Task;
use App\Models\TaskChecklistItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class AutomationTemplateService
{
    public function __construct(
        private AutomationConditionEvaluator $evaluator
    ) {}

    /**
     * Evalúa la condición de la plantilla y retorna los registros que la cumplen.
     * No crea ninguna tarea. Útil para preview en el frontend.
     */
    public function evaluate(AutomationTemplate $template): array
    {
        if (!$template->hasCondition()) {
            // Sin condición: retorna todos los registros del módulo (limitado a 50 para preview)
            $config = config("automation_variables.{$template->module}");
            $modelClass = $config['model'];
            $records = $modelClass::query()->limit(50)->get();
        } else {
            $records = $this->evaluator->evaluate($template->module, $template->condition_json);
        }

        $config = config("automation_variables.{$template->module}");
        $labelField = $config['record_label_field'] ?? 'id';

        return $records->map(fn ($r) => [
            'id'    => $r->id,
            'label' => $r->$labelField ?? $r->id,
        ])->values()->toArray();
    }

    /**
     * Ejecuta la plantilla sobre registros específicos (o todos los que cumplen la condición).
     * Crea las tareas y registra las ejecuciones.
     *
     * @param AutomationTemplate $template
     * @param int[]|null         $recordIds  Si null, usa evaluate() para obtener los registros
     * @param int|null           $triggeredBy user_id del admin que ejecuta (null = sistema)
     * @return array  ['created' => int, 'skipped' => int, 'tasks' => Task[]]
     */
    public function execute(AutomationTemplate $template, ?array $recordIds = null, ?int $triggeredBy = null, ?array $conditionOverride = null): array
    {
        $template->loadMissing(['assignees', 'checklistItems']);
        $assigneeIds = $template->getAssigneeIds();
        $effectiveCondition = $conditionOverride ?? ($template->condition_json ?? []);

        if (empty($assigneeIds)) {
            return ['created' => 0, 'skipped' => 0, 'tasks' => [], 'error' => 'Sin responsables asignados'];
        }

        // Determinar registros a procesar
        if ($recordIds !== null) {
            $config = config("automation_variables.{$template->module}");
            $modelClass = $config['model'];
            $records = $modelClass::whereIn('id', $recordIds)->get();
        } else {
            $records = $this->evaluator->evaluate($template->module, $effectiveCondition);
        }

        $created = 0;
        $skipped = 0;
        $allTasks = [];

        DB::transaction(function () use ($template, $records, $assigneeIds, $triggeredBy, $effectiveCondition, &$created, &$skipped, &$allTasks) {
            foreach ($records as $record) {
                // Si tiene condición efectiva, verificar que este registro aún la cumple
                if (!empty($effectiveCondition['rules'])) {
                    $passes = $this->evaluator->evaluateSingle(
                        $template->module,
                        $effectiveCondition,
                        $record->id
                    );

                    if (!$passes) {
                        $skipped++;
                        $this->logExecution($template, $record, $triggeredBy, null, 'skipped', 'No cumple la condición');
                        continue;
                    }
                }

                // Crear una tarea por cada responsable
                foreach ($assigneeIds as $userId) {
                    $task = Task::create([
                        'project_code' => $this->getProjectCode($template->module, $record),
                        'project_name' => $this->getProjectName($template->module, $record),
                        'title'        => $this->interpolateTitle($template->default_title, $record),
                        'status'       => 'pendiente',
                        'priority'     => $template->priority,
                        'assigned_to'  => $userId,
                        'workflow_id'  => $template->workflow_id,
                        'created_by'   => $triggeredBy,
                        'start_date'   => now()->toDateString(),
                        'due_date'     => now()->addDays($template->due_days_offset)->toDateString(),
                    ]);

                    // Copiar checklist desde la plantilla
                    foreach ($template->checklistItems as $item) {
                        $task->checklistItems()->create([
                            'title'      => $item->title,
                            'sort_order' => $item->sort_order,
                        ]);
                    }

                    $allTasks[] = $task;
                    $created++;

                    $this->logExecution($template, $record, $triggeredBy, $task->id, 'success');
                }
            }

            // Actualizar last_run_at
            $template->update(['last_run_at' => now()]);
        });

        return ['created' => $created, 'skipped' => $skipped, 'tasks' => $allTasks];
    }

    /**
     * Ejecuta todas las plantillas scheduled cuyo cron corresponde al momento actual.
     */
    public function runScheduled(): array
    {
        $templates = AutomationTemplate::where('trigger_type', 'scheduled')
            ->where('is_active', true)
            ->whereNotNull('cron_expression')
            ->get();

        $results = [];

        foreach ($templates as $template) {
            if (!$this->cronMatchesNow($template->cron_expression)) {
                continue;
            }

            $result = $this->execute($template, null, null, $this->resolveConditionJson($template));
            $results[] = [
                'template_id'   => $template->id,
                'template_name' => $template->name,
                'created'       => $result['created'],
                'skipped'       => $result['skipped'],
            ];
        }

        return $results;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Helpers privados
    // ─────────────────────────────────────────────────────────────────────────

    private function logExecution(
        AutomationTemplate $template,
        $record,
        ?int $triggeredBy,
        ?int $taskId,
        string $status,
        ?string $notes = null
    ): void {
        AutomationTemplateExecution::create([
            'template_id'  => $template->id,
            'record_type'  => get_class($record),
            'record_id'    => $record->id,
            'triggered_by' => $triggeredBy,
            'task_id'      => $taskId,
            'status'       => $status,
            'notes'        => $notes,
            'executed_at'  => now(),
        ]);
    }

    private function getProjectCode(string $module, $record): string
    {
        return match ($module) {
            'credits'       => $record->reference ?? (string) $record->id,
            'opportunities' => (string) $record->id,
            'leads'         => 'LEAD-' . $record->id,
            'investments'   => 'INV-' . $record->id,
            default         => (string) $record->id,
        };
    }

    private function getProjectName(string $module, $record): string
    {
        return match ($module) {
            'credits'       => $record->reference ?? 'Crédito #' . $record->id,
            'opportunities' => 'Oportunidad #' . $record->id,
            'leads'         => $record->name ?? 'Lead #' . $record->id,
            'investments'   => 'Inversión #' . ($record->numero_desembolso ?? $record->id),
            default         => '#' . $record->id,
        };
    }

    /**
     * Interpola variables en el título de la tarea.
     * Ejemplo: "Contactar a {{lead.name}}" → "Contactar a Juan Pérez"
     */
    private function interpolateTitle(string $title, $record): string
    {
        return preg_replace_callback('/\{\{(\w+)\}\}/', function ($matches) use ($record) {
            $field = $matches[1];
            return $record->$field ?? $matches[0];
        }, $title);
    }

    /**
     * Verifica si una expresión cron (o after_days) corresponde al momento actual.
     *
     * Formato after_days: "after_days:<N>:<dateField>"
     * Se ejecuta en la pasada de las 8:00 AM diarias; la condición real (days_ago_eq)
     * se inyecta dinámicamente sobre el condition_json del template en runScheduled().
     */
    private function cronMatchesNow(string $expression): bool
    {
        if (str_starts_with($expression, 'after_days:')) {
            // Corre una vez al día a las 8:00 AM
            $now = Carbon::now('America/Costa_Rica');
            return $now->hour === 8 && $now->minute === 0;
        }

        try {
            $cron = new \Cron\CronExpression($expression);
            return $cron->isDue(Carbon::now('America/Costa_Rica'));
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Para plantillas after_days: devuelve el condition_json efectivo que incluye
     * la regla "campo estuvo hace exactamente N días", fusionado con las condiciones
     * propias de la plantilla.
     */
    private function resolveConditionJson(AutomationTemplate $template): array
    {
        $base = $template->condition_json ?? [];
        $cron = $template->cron_expression ?? '';

        if (!str_starts_with($cron, 'after_days:')) {
            return $base;
        }

        [, $days, $field] = array_pad(explode(':', $cron, 3), 3, 'created_at');

        // Regla: campo == hace exactamente N días (days_ago_gt N-1 AND days_ago_lt N+1)
        $afterRule1 = ['field' => $field, 'operator' => 'days_ago_gt', 'value' => (int) $days - 1];
        $afterRule2 = ['field' => $field, 'operator' => 'days_ago_lt', 'value' => (int) $days + 1];

        $existingRules = $base['rules'] ?? [];

        return [
            'logic' => 'AND',
            'rules' => array_merge([$afterRule1, $afterRule2], $existingRules),
        ];
    }
}
