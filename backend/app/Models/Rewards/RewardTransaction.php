<?php

declare(strict_types=1);

namespace App\Models\Rewards;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class RewardTransaction extends Model
{
    use HasFactory;

    protected $table = 'reward_transactions';

    protected $fillable = [
        'reward_user_id',
        'type',
        'amount',
        'currency',
        'balance_after',
        'description',
        'reference_type',
        'reference_id',
        'metadata',
        'expires_at',
    ];

    protected $casts = [
        'reward_user_id' => 'integer',
        'amount' => 'integer',
        'balance_after' => 'integer',
        'metadata' => 'array',
        'expires_at' => 'datetime',
    ];

    /**
     * Transaction types
     */
    public const TYPE_EARN = 'earn';
    public const TYPE_SPEND = 'spend';
    public const TYPE_BONUS = 'bonus';
    public const TYPE_ADJUSTMENT = 'adjustment';
    public const TYPE_EXPIRED = 'expired';
    public const TYPE_REFUND = 'refund';

    public const TYPES = [
        self::TYPE_EARN,
        self::TYPE_SPEND,
        self::TYPE_BONUS,
        self::TYPE_ADJUSTMENT,
        self::TYPE_EXPIRED,
        self::TYPE_REFUND,
    ];

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    /**
     * Get the reward user
     */
    public function rewardUser(): BelongsTo
    {
        return $this->belongsTo(RewardUser::class);
    }

    /**
     * Get the source model (polymorphic)
     */
    public function source()
    {
        return $this->morphTo('reference');
    }

    /*
    |--------------------------------------------------------------------------
    | Scopes
    |--------------------------------------------------------------------------
    */

    /**
     * Scope to get only earn transactions
     */
    public function scopeEarned($query)
    {
        return $query->where('amount', '>', 0);
    }

    /**
     * Scope to get only spend transactions
     */
    public function scopeSpent($query)
    {
        return $query->where('amount', '<', 0);
    }

    /**
     * Scope to filter by type
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Scope to filter by date range
     */
    public function scopeBetweenDates($query, $start, $end)
    {
        return $query->whereBetween('created_at', [$start, $end]);
    }

    /**
     * Scope to get non-expired transactions
     */
    public function scopeNotExpired($query)
    {
        return $query->where(function ($q) {
            $q->whereNull('expires_at')
              ->orWhere('expires_at', '>', now());
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Accessors
    |--------------------------------------------------------------------------
    */

    /**
     * Check if transaction is positive (earn)
     */
    public function getIsEarnAttribute(): bool
    {
        return $this->amount > 0;
    }

    /**
     * Check if transaction is negative (spend)
     */
    public function getIsSpendAttribute(): bool
    {
        return $this->amount < 0;
    }

    /**
     * Get absolute amount
     */
    public function getAbsoluteAmountAttribute(): int
    {
        return abs($this->amount);
    }

    /**
     * Get formatted amount with sign
     */
    public function getFormattedAmountAttribute(): string
    {
        $prefix = $this->amount >= 0 ? '+' : '';
        return $prefix . number_format($this->amount);
    }

    /**
     * Check if transaction is expired
     */
    public function getIsExpiredAttribute(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }
}
