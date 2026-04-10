<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomationTemplateChecklistItem extends Model
{
    protected $table = 'automation_template_checklist';

    protected $fillable = [
        'template_id',
        'title',
        'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(AutomationTemplate::class, 'template_id');
    }
}
