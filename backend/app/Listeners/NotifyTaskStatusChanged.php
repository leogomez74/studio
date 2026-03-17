<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\TaskStatusChanged;
use App\Models\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;

class NotifyTaskStatusChanged implements ShouldQueue
{
    public function handle(TaskStatusChanged $event): void
    {
        try {
            $task = $event->task;
            $changer = $event->user;

            // Collect users to notify: assignee + watchers, excluding the changer
            $notifyUserIds = collect();

            if ($task->assigned_to && $task->assigned_to !== $changer->id) {
                $notifyUserIds->push($task->assigned_to);
            }

            $watcherIds = $task->watchers()->pluck('user_id')
                ->reject(fn ($id) => $id === $changer->id);
            $notifyUserIds = $notifyUserIds->merge($watcherIds)->unique();

            foreach ($notifyUserIds as $userId) {
                Notification::create([
                    'user_id' => $userId,
                    'type' => 'task_status_changed',
                    'title' => "Tarea actualizada: {$task->reference}",
                    'body' => "\"{$task->title}\" cambió de {$event->fromStatus->name} a {$event->toStatus->name}",
                    'data' => [
                        'task_id' => $task->id,
                        'task_reference' => $task->reference,
                        'task_title' => $task->title,
                        'from_status' => $event->fromStatus->name,
                        'to_status' => $event->toStatus->name,
                        'changer_name' => $changer->name,
                    ],
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('NotifyTaskStatusChanged failed: ' . $e->getMessage());
        }
    }
}
