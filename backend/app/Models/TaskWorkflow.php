<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaskWorkflow extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'description',
        'color',
        'is_default',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function statuses(): HasMany
    {
        return $this->hasMany(TaskWorkflowStatus::class, 'workflow_id')->orderBy('sort_order');
    }

    public function transitions(): HasMany
    {
        return $this->hasMany(TaskWorkflowTransition::class, 'workflow_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'workflow_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function initialStatus(): ?TaskWorkflowStatus
    {
        return $this->statuses()->where('is_initial', true)->first();
    }
}
