<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomationTemplateExecution extends Model
{
    protected $fillable = [
        'template_id',
        'record_type',
        'record_id',
        'triggered_by',
        'task_id',
        'status',
        'notes',
        'executed_at',
    ];

    protected $casts = [
        'executed_at' => 'datetime',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(AutomationTemplate::class, 'template_id');
    }

    public function triggeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'triggered_by');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'task_id');
    }

    /**
     * Retorna el registro afectado (Credit, Lead, etc.) via morph-style lookup.
     */
    public function record(): ?Model
    {
        if (!$this->record_type || !$this->record_id) {
            return null;
        }
        return $this->record_type::find($this->record_id);
    }
}
