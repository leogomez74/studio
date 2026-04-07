<?php

declare(strict_types=1);

namespace App\Traits;

use App\Models\Task;
use App\Models\TaskAutomation;
use Illuminate\Support\Facades\Log;

trait DisparaAutoTareas
{
    /**
     * Busca una automatización activa para el event_type dado y crea las tareas correspondientes.
     * Retorna el array de tareas creadas (vacío si no hay automation activa o sin assignees).
     */
    protected function dispararAutoTarea(string $eventType, string $projectCode, string $details = ''): array
    {
        $automation = TaskAutomation::where('event_type', $eventType)
            ->where('is_active', true)
            ->first();

        if (! $automation) {
            return [];
        }

        $tasks = Task::createFromAutomation($automation, $projectCode, $details ?: null);

        if (empty($tasks)) {
            Log::warning("Auto-tarea '{$eventType}' no creó tareas: automation sin assignees.", [
                'event_type'   => $eventType,
                'project_code' => $projectCode,
                'automation_id' => $automation->id,
            ]);
        } else {
            Log::info("Auto-tarea '{$eventType}' creada.", [
                'event_type'   => $eventType,
                'project_code' => $projectCode,
                'count'        => count($tasks),
            ]);
        }

        return $tasks;
    }
}
