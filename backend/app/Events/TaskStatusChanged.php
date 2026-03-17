<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Task;
use App\Models\TaskWorkflowStatus;
use App\Models\TaskWorkflowTransition;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TaskStatusChanged
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Task $task,
        public TaskWorkflowStatus $fromStatus,
        public TaskWorkflowStatus $toStatus,
        public User $user,
        public ?TaskWorkflowTransition $transition = null
    ) {}
}
