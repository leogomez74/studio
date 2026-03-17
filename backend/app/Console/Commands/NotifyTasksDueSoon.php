<?php

namespace App\Console\Commands;

use App\Models\Notification;
use App\Models\Task;
use Illuminate\Console\Command;

class NotifyTasksDueSoon extends Command
{
    protected $signature = 'tasks:notify-due-soon';
    protected $description = 'Notificar tareas con vencimiento en las próximas 24 horas';

    public function handle(): int
    {
        $tasks = Task::whereIn('status', ['pendiente', 'en_progreso'])
            ->whereNotNull('due_date')
            ->whereNotNull('assigned_to')
            ->whereBetween('due_date', [now(), now()->addHours(24)])
            ->get();

        $count = 0;
        foreach ($tasks as $task) {
            // Avoid duplicate notifications (check if already sent in last 24h)
            $alreadySent = Notification::where('user_id', $task->assigned_to)
                ->where('type', 'task_due_soon')
                ->where('data->task_id', $task->id)
                ->where('created_at', '>=', now()->subHours(24))
                ->exists();

            if ($alreadySent) continue;

            $hoursRemaining = (int) now()->diffInHours($task->due_date, false);

            Notification::create([
                'user_id' => $task->assigned_to,
                'type' => 'task_due_soon',
                'title' => 'Tarea próxima a vencer',
                'body' => "\"{$task->title}\" ({$task->reference}) vence en {$hoursRemaining} horas",
                'data' => [
                    'task_id' => $task->id,
                    'task_reference' => $task->reference,
                    'task_title' => $task->title,
                    'due_date' => $task->due_date->format('Y-m-d'),
                    'hours_remaining' => $hoursRemaining,
                ],
            ]);
            $count++;
        }

        $this->info("Se enviaron {$count} notificaciones de vencimiento próximo.");
        return 0;
    }
}
