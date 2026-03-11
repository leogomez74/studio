<?php

declare(strict_types=1);

namespace App\Models\Rewards;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class RewardCatalogItem extends Model
{
    use HasFactory;

    public const UNLIMITED_STOCK = -1;

    protected $table = 'reward_catalog_items';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'category',
        'icon',
        'image_url',
        'points_cost',
        'stock',
        'max_per_user',
        'requirements',
        'metadata',
        'is_active',
        'is_featured',
        'available_from',
        'available_until',
        'sort_order',
    ];

    protected $casts = [
        'points_cost' => 'integer',
        'stock' => 'integer',
        'max_per_user' => 'integer',
        'requirements' => 'array',
        'metadata' => 'array',
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
        'available_from' => 'datetime',
        'available_until' => 'datetime',
        'sort_order' => 'integer',
    ];

    protected $attributes = [
        'category' => 'general',
        'points_cost' => 0,
        'is_active' => true,
        'is_featured' => false,
        'sort_order' => 0,
    ];

    /**
     * Item categories
     */
    public const CATEGORY_DIGITAL = 'digital';
    public const CATEGORY_PHYSICAL = 'physical';
    public const CATEGORY_EXPERIENCE = 'experience';
    public const CATEGORY_DISCOUNT = 'discount';
    public const CATEGORY_GENERAL = 'general';

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    /**
     * Get item redemptions
     */
    public function redemptions(): HasMany
    {
        return $this->hasMany(RewardRedemption::class, 'catalog_item_id');
    }

    /*
    |--------------------------------------------------------------------------
    | Scopes
    |--------------------------------------------------------------------------
    */

    /**
     * Scope to get only active items
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get featured items
     */
    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
    }

    /**
     * Scope to get available items (in stock and date range)
     */
    public function scopeAvailable($query)
    {
        return $query->active()
            ->where(function ($q) {
                $q->whereNull('stock')
                  ->orWhere('stock', '>', 0);
            })
            ->where(function ($q) {
                $q->whereNull('available_from')
                  ->orWhere('available_from', '<=', now());
            })
            ->where(function ($q) {
                $q->whereNull('available_until')
                  ->orWhere('available_until', '>=', now());
            });
    }

    /**
     * Scope to filter by category
     */
    public function scopeInCategory($query, string $category)
    {
        return $query->where('category', $category);
    }

    /**
     * Scope to filter by max cost
     */
    public function scopeMaxCost($query, int $points)
    {
        return $query->where('points_cost', '<=', $points);
    }

    /**
     * Scope to order by sort order
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order')->orderBy('name');
    }

    /*
    |--------------------------------------------------------------------------
    | Accessors
    |--------------------------------------------------------------------------
    */

    /**
     * Check if item is currently available
     */
    public function getIsAvailableAttribute(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        if ($this->stock !== null && $this->stock <= 0) {
            return false;
        }

        $now = now();
        
        if ($this->available_from && $this->available_from->gt($now)) {
            return false;
        }
        
        if ($this->available_until && $this->available_until->lt($now)) {
            return false;
        }

        return true;
    }

    /**
     * Check if item is in stock
     */
    public function getInStockAttribute(): bool
    {
        return $this->stock === null || $this->stock > 0;
    }

    /**
     * Get redemption count
     */
    public function getRedemptionCountAttribute(): int
    {
        return $this->redemptions()->count();
    }

    /*
    |--------------------------------------------------------------------------
    | Methods
    |--------------------------------------------------------------------------
    */

    /**
     * Check if user can redeem this item
     */
    public function canBeRedeemedBy(RewardUser $user): array
    {
        $errors = [];

        // Check if available
        if (!$this->is_available) {
            $errors[] = 'Item is not available';
        }

        // Check points
        if ($user->total_points < $this->points_cost) {
            $errors[] = 'Insufficient points';
        }

        // Check max per user
        if ($this->max_per_user !== null) {
            $userRedemptions = $this->redemptions()
                ->where('reward_user_id', $user->id)
                ->where('status', '!=', 'cancelled')
                ->count();

            if ($userRedemptions >= $this->max_per_user) {
                $errors[] = 'Maximum redemptions reached';
            }
        }

        // Check requirements
        if (!empty($this->requirements)) {
            // Level requirement
            if (isset($this->requirements['min_level']) && $user->level < $this->requirements['min_level']) {
                $errors[] = 'Level requirement not met';
            }

            // Badge requirement
            if (isset($this->requirements['badge_id']) && !$user->hasBadge($this->requirements['badge_id'])) {
                $errors[] = 'Badge requirement not met';
            }
        }

        return [
            'can_redeem' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Decrease stock by amount
     */
    public function decreaseStock(int $amount = 1): bool
    {
        if ($this->stock === null) {
            return true;
        }

        if ($this->stock < $amount) {
            return false;
        }

        $this->decrement('stock', $amount);
        return true;
    }
}
