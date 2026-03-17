<?php

namespace App\Console\Commands;

use App\Models\Credit;
use App\Models\Task;
use App\Models\TaskAutomation;
use Illuminate\Console\Command;

class CreateMissingCreditTasks extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'credits:create-missing-tasks';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Crea tareas automáticas para créditos que no tienen una tarea asociada';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Buscando configuración de tarea automática...');

        // Obtener la configuración de tarea automática
        $automation = TaskAutomation::where('event_type', 'credit_created')
            ->where('is_active', true)
            ->first();

        $assigneeIds = $automation ? $automation->getAssigneeIds() : [];
        if (!$automation || empty($assigneeIds)) {
            $this->error('No hay configuración de tarea automática activa para credit_created');
            return Command::FAILURE;
        }

        $this->info("Configuración encontrada: {$automation->title}");
        $this->info("Usuarios asignados: " . implode(', ', $assigneeIds));

        // Obtener todos los créditos
        $credits = Credit::with('lead')->get();
        $this->info("Total de créditos: {$credits->count()}");

        $tasksCreated = 0;
        $creditsUpdated = 0;

        foreach ($credits as $credit) {
            // Verificar si ya existe una tarea para este crédito
            $existingTask = Task::where('project_code', 'CRED-' . $credit->id)->first();

            if (!$existingTask) {
                // Crear tareas (una por responsable configurado)
                $tasks = Task::createFromAutomation(
                    $automation,
                    'CRED-' . $credit->id,
                    'Al crearse un nuevo crédito, se asigna tarea para realizar entrega de pagaré, formalización, entrega de hoja de cierre.'
                );

                $tasksCreated += count($tasks);
                $this->line("✓ " . count($tasks) . " tarea(s) creada(s) para crédito: {$credit->reference}");
            }

            // Actualizar el crédito con assigned_to si no lo tiene
            if (!$credit->assigned_to) {
                // Usar el assigned_to del lead si existe, sino usar el primero de la automation
                $assignedTo = $credit->lead?->assigned_to_id ?? $assigneeIds[0];
                $credit->update(['assigned_to' => $assignedTo]);
                $creditsUpdated++;
                $this->line("✓ Responsable asignado al crédito: {$credit->reference} (Usuario ID: {$assignedTo})");
            }
        }

        $this->newLine();
        $this->info("Resumen:");
        $this->info("- Tareas creadas: {$tasksCreated}");
        $this->info("- Créditos actualizados con responsable: {$creditsUpdated}");
        $this->newLine();
        $this->info('✓ ¡Proceso completado exitosamente!');

        return Command::SUCCESS;
    }
}
