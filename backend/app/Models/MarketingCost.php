<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketingCost extends Model
{
    use HasFactory;

    protected $fillable = [
        'period_month',
        'channel',
        'amount',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'period_month' => 'date',
        'amount'       => 'decimal:2',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
