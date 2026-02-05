<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskAutomation extends Model
{
    protected $fillable = [
        'event_type',
        'title',
        'assigned_to',
        'priority',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }
}
