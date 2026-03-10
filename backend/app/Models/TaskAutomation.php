<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
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
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function checklistItems(): HasMany
    {
        return $this->hasMany(TaskAutomationChecklistItem::class, 'automation_id')->orderBy('sort_order');
    }
}
