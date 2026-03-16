<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentVerification extends Model
{
    protected $fillable = [
        'credit_id',
        'requested_by',
        'assigned_to',
        'payment_type',
        'payment_data',
        'status',
        'verified_at',
        'verification_notes',
        'task_id',
    ];

    protected $casts = [
        'payment_data' => 'array',
        'verified_at' => 'datetime',
    ];

    public function credit(): BelongsTo
    {
        return $this->belongsTo(Credit::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }
}
