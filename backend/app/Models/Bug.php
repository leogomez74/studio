<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Bug extends Model
{
    protected $fillable = [
        'reference',
        'jira_key',
        'title',
        'description',
        'status',
        'priority',
        'assigned_to',
        'created_by',
        'closed_at',
        'archived_at',
    ];

    protected $casts = [
        'closed_at'   => 'datetime',
        'archived_at' => 'datetime',
    ];

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function images(): HasMany
    {
        return $this->hasMany(BugImage::class);
    }

    protected static function booted(): void
    {
        static::creating(function (Bug $bug) {
            if (!$bug->reference) {
                $lastId = static::max('id') ?? 0;
                $bug->reference = 'BUG-' . str_pad($lastId + 1, 4, '0', STR_PAD_LEFT);
            }
        });

        static::saving(function (Bug $bug) {
            if ($bug->status === 'cerrado' && !$bug->closed_at) {
                $bug->closed_at = Carbon::now();
            } elseif ($bug->status !== 'cerrado') {
                $bug->closed_at = null;
            }
        });
    }
}
