<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Task extends Model
{
    protected $fillable = [
        'workflow_id',
        'workflow_status_id',
        'project_code',
        'project_name',
        'title',
        'details',
        'status',
        'priority',
        'assigned_to',
        'created_by',
        'start_date',
        'due_date',
        'completed_at',
        'estimated_hours',
        'actual_hours',
        'archived_at',
    ];

    protected $casts = [
        'start_date' => 'date',
        'due_date' => 'date',
        'completed_at' => 'datetime',
        'archived_at' => 'datetime',
        'estimated_hours' => 'decimal:2',
        'actual_hours' => 'decimal:2',
    ];

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(TaskWorkflow::class, 'workflow_id');
    }

    public function workflowStatus(): BelongsTo
    {
        return $this->belongsTo(TaskWorkflowStatus::class, 'workflow_status_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(TaskDocument::class);
    }

    public function checklistItems(): HasMany
    {
        return $this->hasMany(TaskChecklistItem::class)->orderBy('sort_order');
    }

    public function labels(): BelongsToMany
    {
        return $this->belongsToMany(TaskLabel::class, 'task_task_label', 'task_id', 'label_id');
    }

    public function watchers(): HasMany
    {
        return $this->hasMany(TaskWatcher::class);
    }

    public function watcherUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'task_watchers', 'task_id', 'user_id');
    }

    public function copyChecklistFromAutomation(TaskAutomation $automation): void
    {
        foreach ($automation->checklistItems as $templateItem) {
            $this->checklistItems()->create([
                'title' => $templateItem->title,
                'sort_order' => $templateItem->sort_order,
            ]);
        }
    }

    public function currentStatusName(): string
    {
        if ($this->workflowStatus) {
            return $this->workflowStatus->name;
        }

        return match ($this->status) {
            'pendiente' => 'Pendiente',
            'en_progreso' => 'En Progreso',
            'completada' => 'Completada',
            'archivada' => 'Archivada',
            'deleted' => 'Eliminada',
            default => $this->status,
        };
    }

    public function isCompleted(): bool
    {
        if ($this->workflowStatus) {
            return $this->workflowStatus->is_terminal;
        }

        return $this->status === 'completada';
    }

    public function syncLegacyStatus(): void
    {
        if (!$this->workflow_status_id || !$this->workflowStatus) {
            return;
        }

        $ws = $this->workflowStatus;

        if ($ws->is_terminal) {
            $this->status = 'completada';
        } elseif ($ws->is_closed) {
            $this->status = 'archivada';
        } elseif ($ws->is_initial) {
            $this->status = 'pendiente';
        } else {
            $this->status = 'en_progreso';
        }
    }

    protected static function booted(): void
    {
        static::saving(function (Task $task) {
            // Sync legacy status from workflow status
            if ($task->isDirty('workflow_status_id') && $task->workflow_status_id) {
                $task->load('workflowStatus');
                $task->syncLegacyStatus();
            }

            // Auto-manage archived_at
            if (in_array($task->status, ['archivada', 'deleted'], true)) {
                $task->archived_at = $task->archived_at ?? Carbon::now();
            } else {
                $task->archived_at = null;
            }

            // Auto-manage completed_at
            if ($task->status === 'completada' && !$task->completed_at) {
                $task->completed_at = Carbon::now();
            } elseif ($task->status !== 'completada' && $task->completed_at) {
                $task->completed_at = null;
            }
        });

        static::created(function (Task $task) {
            if (!$task->reference) {
                $task->reference = 'TA-' . str_pad($task->id, 4, '0', STR_PAD_LEFT);
                $task->saveQuietly();
            }
        });
    }
}
