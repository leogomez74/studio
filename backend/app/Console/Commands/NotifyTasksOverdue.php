<?php

namespace App\Console\Commands;

use App\Models\Notification;
use App\Models\Task;
use Illuminate\Console\Command;

class NotifyTasksOverdue extends Command
{
    protected $signature = 'tasks:notify-overdue';
    protected $description = 'Notificar tareas vencidas no completadas (recordatorio diario)';

    public function handle(): int
    {
        $tasks = Task::whereIn('status', ['pendiente', 'en_progreso'])
            ->whereNotNull('due_date')
            ->whereNotNull('assigned_to')
            ->where('due_date', '<', now()->startOfDay())
            ->get();

        $count = 0;
        foreach ($tasks as $task) {
            // Only send once per day per task
            $alreadySent = Notification::where('user_id', $task->assigned_to)
                ->where('type', 'task_overdue')
                ->where('data->task_id', $task->id)
                ->where('created_at', '>=', now()->startOfDay())
                ->exists();

            if ($alreadySent) continue;

            $daysOverdue = (int) $task->due_date->diffInDays(now());

            Notification::create([
                'user_id' => $task->assigned_to,
                'type' => 'task_overdue',
                'title' => 'Tarea vencida',
                'body' => "\"{$task->title}\" ({$task->reference}) está vencida por {$daysOverdue} día(s)",
                'data' => [
                    'task_id' => $task->id,
                    'task_reference' => $task->reference,
                    'task_title' => $task->title,
                    'due_date' => $task->due_date->format('Y-m-d'),
                    'days_overdue' => $daysOverdue,
                ],
            ]);
            $count++;
        }

        $this->info("Se enviaron {$count} notificaciones de tareas vencidas.");
        return 0;
    }
}
