<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    protected $fillable = [
        'user_id',
        'user_name',
        'action',
        'module',
        'model_type',
        'model_id',
        'model_label',
        'changes',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'changes' => 'json',
    ];

    // -------------------------------------------------------
    // Relaciones
    // -------------------------------------------------------

    public function user()
    {
        return $this->belongsTo(User::class)->withDefault(['name' => 'Sistema']);
    }

    // -------------------------------------------------------
    // Scopes
    // -------------------------------------------------------

    public function scopeByModule($query, string $module)
    {
        return $query->where('module', $module);
    }

    public function scopeByUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeByAction($query, string $action)
    {
        return $query->where('action', $action);
    }

    public function scopeDateRange($query, ?string $from, ?string $to)
    {
        if ($from) $query->whereDate('created_at', '>=', $from);
        if ($to)   $query->whereDate('created_at', '<=', $to);
        return $query;
    }
}
