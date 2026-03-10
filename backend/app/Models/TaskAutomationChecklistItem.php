<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskAutomationChecklistItem extends Model
{
    protected $fillable = [
        'automation_id',
        'title',
        'sort_order',
    ];

    public function automation(): BelongsTo
    {
        return $this->belongsTo(TaskAutomation::class, 'automation_id');
    }
}
