<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AutomationTemplate extends Model
{
    protected $fillable = [
        'name',
        'module',
        'trigger_type',
        'cron_expression',
        'event_key',
        'condition_json',
        'default_title',
        'description',
        'priority',
        'due_days_offset',
        'workflow_id',
        'is_active',
        'created_by',
        'last_run_at',
    ];

    protected $casts = [
        'condition_json' => 'array',
        'is_active'      => 'boolean',
        'due_days_offset' => 'integer',
        'last_run_at'    => 'datetime',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(TaskWorkflow::class, 'workflow_id');
    }

    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'automation_template_assignees', 'template_id', 'user_id');
    }

    public function checklistItems(): HasMany
    {
        return $this->hasMany(AutomationTemplateChecklistItem::class, 'template_id')->orderBy('sort_order');
    }

    public function executions(): HasMany
    {
        return $this->hasMany(AutomationTemplateExecution::class, 'template_id')->latest('executed_at');
    }

    public function getAssigneeIds(): array
    {
        return $this->assignees()->pluck('users.id')->toArray();
    }

    /**
     * Indica si la plantilla tiene condición definida.
     */
    public function hasCondition(): bool
    {
        return !empty($this->condition_json['rules']);
    }
}
