<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskWorkflowTransition extends Model
{
    protected $fillable = [
        'workflow_id',
        'from_status_id',
        'to_status_id',
        'name',
        'points_award',
        'xp_award',
    ];

    protected $casts = [
        'points_award' => 'integer',
        'xp_award' => 'integer',
    ];

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(TaskWorkflow::class, 'workflow_id');
    }

    public function fromStatus(): BelongsTo
    {
        return $this->belongsTo(TaskWorkflowStatus::class, 'from_status_id');
    }

    public function toStatus(): BelongsTo
    {
        return $this->belongsTo(TaskWorkflowStatus::class, 'to_status_id');
    }
}
