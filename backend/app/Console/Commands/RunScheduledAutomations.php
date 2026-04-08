<?php

namespace App\Console\Commands;

use App\Services\AutomationTemplateService;
use App\Services\AutomationConditionEvaluator;
use Illuminate\Console\Command;

class RunScheduledAutomations extends Command
{
    protected $signature   = 'automations:run-scheduled';
    protected $description = 'Evalúa y ejecuta las plantillas de automatización programadas (scheduled).';

    public function handle(): int
    {
        $service = new AutomationTemplateService(new AutomationConditionEvaluator());
        $results = $service->runScheduled();

        if (empty($results)) {
            $this->info('No hay plantillas programadas para ejecutar en este momento.');
            return self::SUCCESS;
        }

        foreach ($results as $r) {
            $this->line(sprintf(
                '[%s] %s → %d tareas creadas, %d omitidas',
                $r['template_id'],
                $r['template_name'],
                $r['created'],
                $r['skipped'],
            ));
        }

        $total = array_sum(array_column($results, 'created'));
        $this->info("Total: {$total} tarea(s) creada(s).");

        return self::SUCCESS;
    }
}
