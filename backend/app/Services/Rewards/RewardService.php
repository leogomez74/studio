<?php

declare(strict_types=1);

namespace App\Services\Rewards;

use App\Models\Rewards\RewardUser;
use App\Models\Rewards\RewardTransaction;
use App\Events\Rewards\PointsEarned;
use App\Events\Rewards\LevelUp;
use Illuminate\Support\Facades\DB;

class RewardService
{
    protected CacheService $cacheService;

    public function __construct(CacheService $cacheService)
    {
        $this->cacheService = $cacheService;
    }

    /**
     * Otorga puntos a un usuario.
     */
    public function awardPoints(
        RewardUser $user,
        int $amount,
        string $type,
        array $options = []
    ): RewardTransaction {
        return DB::transaction(function () use ($user, $amount, $type, $options) {
            $user->increment('total_points', $amount);
            $user->increment('lifetime_points', $amount);

            $transaction = RewardTransaction::create([
                'reward_user_id' => $user->id,
                'type' => $type,
                'amount' => $amount,
                'currency' => 'points',
                'description' => $options['description'] ?? null,
                'reference_type' => $options['reference_type'] ?? null,
                'reference_id' => $options['reference_id'] ?? null,
                'balance_after' => $user->fresh()->total_points,
                'metadata' => $options['metadata'] ?? null,
            ]);

            // Actualizar actividad
            $user->update(['last_activity_at' => now()]);

            // Invalidar caché
            $this->cacheService->invalidateUser($user->id);

            // Disparar evento
            event(new PointsEarned($user, $transaction));

            return $transaction;
        });
    }

    /**
     * Gasta puntos.
     */
    public function spendPoints(
        RewardUser $user,
        int $amount,
        string $type,
        array $options = []
    ): RewardTransaction {
        if ($user->total_points < $amount) {
            throw new \Exception('Puntos insuficientes');
        }

        return DB::transaction(function () use ($user, $amount, $type, $options) {
            $user->decrement('total_points', $amount);

            $transaction = RewardTransaction::create([
                'reward_user_id' => $user->id,
                'type' => $type,
                'amount' => -$amount,
                'currency' => 'points',
                'description' => $options['description'] ?? null,
                'reference_type' => $options['reference_type'] ?? null,
                'reference_id' => $options['reference_id'] ?? null,
                'balance_after' => $user->fresh()->total_points,
                'metadata' => $options['metadata'] ?? null,
            ]);

            $this->cacheService->invalidateUser($user->id);

            return $transaction;
        });
    }

    /**
     * Agrega experiencia y verifica level up.
     */
    public function addExperience(RewardUser $user, int $xp, string $source): void
    {
        $oldLevel = $user->level;
        $user->increment('experience_points', $xp);

        // Calcular nuevo nivel
        $newLevel = $this->calculateLevel($user->fresh()->experience_points);

        if ($newLevel > $oldLevel) {
            $user->update(['level' => $newLevel]);
            event(new LevelUp($user, $oldLevel, $newLevel));
        }

        $this->cacheService->invalidateUser($user->id);
    }

    /**
     * Fórmula de nivel: XP = base * (level ^ multiplier)
     */
    protected function calculateLevel(int $xp): int
    {
        $base = config('gamification.levels.base_xp', 100);
        $multiplier = config('gamification.levels.multiplier', 1.5);

        $level = 1;
        $requiredXp = $base;

        while ($xp >= $requiredXp) {
            $level++;
            $requiredXp = (int) ($base * pow($level, $multiplier));
        }

        return $level;
    }

    /**
     * Calcula XP requerido para el siguiente nivel.
     */
    public function getXpForNextLevel(int $currentLevel): int
    {
        $base = config('gamification.levels.base_xp', 100);
        $multiplier = config('gamification.levels.multiplier', 1.5);

        return (int) ($base * pow($currentLevel + 1, $multiplier));
    }

    /**
     * Obtiene o crea RewardUser para un User.
     */
    public function getOrCreateRewardUser(int $userId): RewardUser
    {
        return RewardUser::firstOrCreate(
            ['user_id' => $userId],
            [
                'level' => 1,
                'experience_points' => 0,
                'total_points' => 0,
                'lifetime_points' => 0,
                'current_streak' => 0,
                'longest_streak' => 0,
            ]
        );
    }

    /**
     * Obtiene el resumen de recompensas del usuario.
     */
    public function getUserSummary(RewardUser $user): array
    {
        $cached = $this->cacheService->getUserStats($user->id);

        if ($cached) {
            return $cached;
        }

        $user->loadCount('badges');

        $summary = [
            'level' => $user->level,
            'experience_points' => $user->experience_points,
            'xp_for_next_level' => $this->getXpForNextLevel($user->level),
            'total_points' => $user->total_points,
            'lifetime_points' => $user->lifetime_points,
            'current_streak' => $user->current_streak,
            'longest_streak' => $user->longest_streak,
            'badges_count' => $user->badges_count,
            'last_activity_at' => $user->last_activity_at?->toIso8601String(),
        ];

        $this->cacheService->setUserStats($user->id, $summary);

        return $summary;
    }

    /**
     * Obtiene historial de transacciones del usuario.
     */
    public function getTransactionHistory(RewardUser $user, int $limit = 20): array
    {
        return $user->transactions()
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn ($t) => [
                'id' => $t->id,
                'type' => $t->type,
                'amount' => $t->amount,
                'currency' => $t->currency,
                'description' => $t->description,
                'balance_after' => $t->balance_after,
                'created_at' => $t->created_at->toIso8601String(),
            ])
            ->toArray();
    }
}
