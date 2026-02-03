<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Task extends Model
{
    protected $fillable = [
        'project_code',
        'project_name',
        'title',
        'details',
        'status',
        'priority',
        'assigned_to',
        'start_date',
        'due_date',
        'archived_at',
    ];

    protected $casts = [
        'start_date' => 'date',
        'due_date' => 'date',
        'archived_at' => 'datetime',
    ];

    /**
     * Relación con el usuario asignado.
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /**
     * Auto-gestión de archived_at basado en status.
     */
    protected static function booted(): void
    {
        static::saving(function (Task $task) {
            if (in_array($task->status, ['archivada', 'deleted'], true)) {
                $task->archived_at = $task->archived_at ?? Carbon::now();
            } else {
                $task->archived_at = null;
            }
        });
    }
}
