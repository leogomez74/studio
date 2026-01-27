<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadAlert extends Model
{
    protected $table = 'lead_alerts';

    protected $fillable = [
        'alert_type',
        'alert_number',
        'inactive_leads',
        'inactive_opportunities',
        'message',
        'is_read',
        'assigned_to_id',
    ];

    protected $casts = [
        'inactive_leads' => 'array',
        'inactive_opportunities' => 'array',
        'is_read' => 'boolean',
        'alert_number' => 'integer',
    ];

    public const TYPE_INACTIVITY_WARNING = 'inactivity_warning';
    public const TYPE_INACTIVITY_FINAL = 'inactivity_final';

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_id');
    }

    public function scopeUnread($query)
    {
        return $query->where('is_read', false);
    }

    public function scopeThisMonth($query)
    {
        return $query->whereBetween('created_at', [
            now()->startOfMonth(),
            now()->endOfMonth(),
        ]);
    }
}
