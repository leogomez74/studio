<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaskWorkflowStatus extends Model
{
    protected $fillable = [
        'workflow_id',
        'name',
        'slug',
        'color',
        'icon',
        'sort_order',
        'is_initial',
        'is_terminal',
        'is_closed',
    ];

    protected $casts = [
        'is_initial' => 'boolean',
        'is_terminal' => 'boolean',
        'is_closed' => 'boolean',
    ];

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(TaskWorkflow::class, 'workflow_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'workflow_status_id');
    }

    public function outgoingTransitions(): HasMany
    {
        return $this->hasMany(TaskWorkflowTransition::class, 'from_status_id');
    }

    public function incomingTransitions(): HasMany
    {
        return $this->hasMany(TaskWorkflowTransition::class, 'to_status_id');
    }

    public function scopeInitial($query)
    {
        return $query->where('is_initial', true);
    }

    public function scopeTerminal($query)
    {
        return $query->where('is_terminal', true);
    }
}
