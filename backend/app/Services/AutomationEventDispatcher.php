<?php

namespace App\Services;

use App\Models\AutomationTemplate;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

/**
 * Dispatcher de eventos personalizados para AutomationTemplates.
 *
 * Se invoca desde cualquier punto del código (Controller, Service, Observer)
 * cuando ocurre un evento registrado en config/automation_event_hooks.php.
 *
 * Uso:
 *   AutomationEventDispatcher::dispatch('credit.deductora_changed', $credit);
 *   AutomationEventDispatcher::dispatch('judicial.actuacion_registrada', $expediente, ['nota' => 'impulso']);
 */
class AutomationEventDispatcher
{
    /**
     * Busca plantillas activas suscritas al evento y ejecuta las que cumplen
     * la condición sobre el registro dado.
     *
     * @param string     $eventKey   Clave del evento (ej: 'credit.deductora_changed')
     * @param Model      $record     Instancia del modelo afectado
     * @param array      $context    Datos adicionales opcionales (para interpolación futura)
     * @param int|null   $userId     Usuario que disparó la acción (null = sistema)
     */
    public static function dispatch(string $eventKey, Model $record, array $context = [], ?int $userId = null): void
    {
        $templates = AutomationTemplate::where('trigger_type', 'event')
            ->where('event_key', $eventKey)
            ->where('is_active', true)
            ->with(['assignees', 'checklistItems'])
            ->get();

        if ($templates->isEmpty()) {
            return;
        }

        $service = new AutomationTemplateService(new AutomationConditionEvaluator());

        foreach ($templates as $template) {
            try {
                // Si tiene condición, verificar que este registro la cumple
                if ($template->hasCondition()) {
                    $passes = (new AutomationConditionEvaluator())->evaluateSingle(
                        $template->module,
                        $template->condition_json,
                        $record->id
                    );

                    if (!$passes) {
                        continue;
                    }
                }

                $service->execute($template, [$record->id], $userId);

            } catch (\Throwable $e) {
                Log::error("AutomationEventDispatcher: error al ejecutar plantilla #{$template->id} para evento {$eventKey}", [
                    'error'       => $e->getMessage(),
                    'template_id' => $template->id,
                    'record_id'   => $record->id,
                    'record_type' => get_class($record),
                ]);
            }
        }
    }

    /**
     * Retorna el catálogo completo de eventos agrupados por módulo.
     * Expuesto via API para el frontend.
     */
    public static function catalog(): array
    {
        $catalog = config('automation_event_hooks', []);
        $result  = [];

        foreach ($catalog as $moduleKey => $events) {
            $moduleLabel = config("automation_variables.{$moduleKey}.label", $moduleKey);
            $items = [];

            foreach ($events as $eventKey => $eventConfig) {
                $items[] = [
                    'key'         => $eventKey,
                    'label'       => $eventConfig['label'],
                    'description' => $eventConfig['description'],
                ];
            }

            $result[] = [
                'module' => $moduleKey,
                'label'  => $moduleLabel,
                'events' => $items,
            ];
        }

        return $result;
    }
}
