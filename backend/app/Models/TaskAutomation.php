<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaskAutomation extends Model
{
    protected $fillable = [
        'event_type',
        'title',
        'assigned_to',
        'priority',
        'due_days_offset',
        'is_active',
        'workflow_id',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Legacy single assignee (backward compat).
     */
    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /**
     * Multiple assignees via pivot table.
     */
    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'task_automation_assignees', 'automation_id', 'user_id');
    }

    public function checklistItems(): HasMany
    {
        return $this->hasMany(TaskAutomationChecklistItem::class, 'automation_id')->orderBy('sort_order');
    }

    /**
     * Get all user IDs that should receive tasks.
     * Prefers pivot table, falls back to legacy assigned_to.
     */
    public function getAssigneeIds(): array
    {
        $ids = $this->assignees()->pluck('users.id')->toArray();
        if (empty($ids) && $this->assigned_to) {
            $ids = [$this->assigned_to];
        }
        return $ids;
    }
}
