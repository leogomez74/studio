<?php

declare(strict_types=1);

namespace App\Models\Rewards;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class RewardChallengeParticipation extends Model
{
    use HasFactory;

    protected $table = 'reward_challenge_participations';

    protected $fillable = [
        'challenge_id',
        'reward_user_id',
        'progress',
        'status',
        'joined_at',
        'completed_at',
        'metadata',
        'rewards_claimed',
    ];

    protected $casts = [
        'challenge_id' => 'integer',
        'reward_user_id' => 'integer',
        'progress' => 'array',
        'rewards_claimed' => 'array',
        'joined_at' => 'datetime',
        'completed_at' => 'datetime',
        'metadata' => 'array',
    ];

    protected $attributes = [
        'status' => 'active',
    ];

    /**
     * Participation statuses
     */
    public const STATUS_ACTIVE = 'active';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_ABANDONED = 'abandoned';

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    /**
     * Get the challenge
     */
    public function challenge(): BelongsTo
    {
        return $this->belongsTo(RewardChallenge::class, 'challenge_id');
    }

    /**
     * Get the reward user
     */
    public function rewardUser(): BelongsTo
    {
        return $this->belongsTo(RewardUser::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Scopes
    |--------------------------------------------------------------------------
    */

    /**
     * Scope to get active participations
     */
    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    /**
     * Scope to get completed participations
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', self::STATUS_COMPLETED);
    }

    /**
     * Scope to filter by status
     */
    public function scopeWithStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /*
    |--------------------------------------------------------------------------
    | Accessors
    |--------------------------------------------------------------------------
    */

    /**
     * Check if participation is completed
     */
    public function getIsCompletedAttribute(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    /**
     * Check if participation is active
     */
    public function getIsActiveAttribute(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /**
     * Get progress percentage
     */
    public function getProgressPercentageAttribute(): float
    {
        if (!$this->progress || !$this->challenge) {
            return 0;
        }

        $objectives = $this->challenge->objectives ?? [];
        
        if (empty($objectives)) {
            return $this->is_completed ? 100 : 0;
        }

        $totalProgress = 0;
        $objectiveCount = count($objectives);

        foreach ($objectives as $index => $objective) {
            $target = $objective['target'] ?? 1;
            $current = $this->progress[$index]['current'] ?? 0;
            $totalProgress += min(100, ($current / $target) * 100);
        }

        return round($totalProgress / $objectiveCount, 2);
    }

    /*
    |--------------------------------------------------------------------------
    | Methods
    |--------------------------------------------------------------------------
    */

    /**
     * Update progress for an objective
     */
    public function updateObjectiveProgress(int $objectiveIndex, int $value): self
    {
        $progress = $this->progress ?? [];
        
        if (!isset($progress[$objectiveIndex])) {
            $progress[$objectiveIndex] = ['current' => 0];
        }
        
        $progress[$objectiveIndex]['current'] = $value;
        $this->progress = $progress;
        
        return $this;
    }

    /**
     * Increment progress for an objective
     */
    public function incrementObjectiveProgress(int $objectiveIndex, int $amount = 1): self
    {
        $progress = $this->progress ?? [];
        
        if (!isset($progress[$objectiveIndex])) {
            $progress[$objectiveIndex] = ['current' => 0];
        }
        
        $progress[$objectiveIndex]['current'] = ($progress[$objectiveIndex]['current'] ?? 0) + $amount;
        $this->progress = $progress;
        
        return $this;
    }

    /**
     * Mark as completed
     */
    public function markCompleted(): self
    {
        $this->status = self::STATUS_COMPLETED;
        $this->completed_at = now();
        
        return $this;
    }

    /**
     * Check if all objectives are met
     */
    public function areObjectivesMet(): bool
    {
        $objectives = $this->challenge->objectives ?? [];
        $progress = $this->progress ?? [];

        foreach ($objectives as $index => $objective) {
            $target = $objective['target'] ?? 1;
            $current = $progress[$index]['current'] ?? 0;
            
            if ($current < $target) {
                return false;
            }
        }

        return true;
    }
}
