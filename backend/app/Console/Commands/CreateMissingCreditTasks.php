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

        if (!$automation || !$automation->assigned_to) {
            $this->error('No hay configuración de tarea automática activa para credit_created');
            return Command::FAILURE;
        }

        $this->info("Configuración encontrada: {$automation->title}");
        $this->info("Usuario asignado por defecto: {$automation->assigned_to}");

        // Obtener todos los créditos
        $credits = Credit::with('lead')->get();
        $this->info("Total de créditos: {$credits->count()}");

        $tasksCreated = 0;
        $creditsUpdated = 0;

        foreach ($credits as $credit) {
            // Verificar si ya existe una tarea para este crédito
            $existingTask = Task::where('project_code', $credit->reference)->first();

            if (!$existingTask) {
                // Crear la tarea
                Task::create([
                    'project_code' => $credit->reference,
                    'project_name' => $credit->title,
                    'title' => $automation->title,
                    'details' => 'Al crearse un nuevo crédito, se asigna tarea para realizar entrega de pagaré, formalización, entrega de hoja de cierre.',
                    'status' => 'pendiente',
                    'priority' => $automation->priority ?? 'media',
                    'assigned_to' => $automation->assigned_to,
                ]);

                $tasksCreated++;
                $this->line("✓ Tarea creada para crédito: {$credit->reference}");
            }

            // Actualizar el crédito con assigned_to si no lo tiene
            if (!$credit->assigned_to) {
                // Usar el assigned_to del lead si existe, sino usar el de la automation
                $assignedTo = $credit->lead?->assigned_to_id ?? $automation->assigned_to;
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
