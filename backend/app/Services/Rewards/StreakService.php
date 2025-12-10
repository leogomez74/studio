<?php

declare(strict_types=1);

namespace App\Services\Rewards;

use App\Models\Rewards\RewardUser;
use Carbon\Carbon;

class StreakService
{
    protected CacheService $cacheService;

    public function __construct(CacheService $cacheService)
    {
        $this->cacheService = $cacheService;
    }

    /**
     * Registra actividad del usuario y actualiza el streak.
     */
    public function recordActivity(RewardUser $user): array
    {
        $now = Carbon::now();
        $lastActivity = $user->last_activity_at ? Carbon::parse($user->last_activity_at) : null;
        $lastStreakUpdate = $user->streak_updated_at ? Carbon::parse($user->streak_updated_at) : null;

        $result = [
            'streak_updated' => false,
            'streak_broken' => false,
            'new_streak' => $user->current_streak,
            'streak_bonus' => 0,
        ];

        // Si no hay última actualización de streak, iniciar
        if (!$lastStreakUpdate) {
            $user->update([
                'current_streak' => 1,
                'longest_streak' => max(1, $user->longest_streak),
                'streak_updated_at' => $now,
                'last_activity_at' => $now,
            ]);
            $result['streak_updated'] = true;
            $result['new_streak'] = 1;
            return $result;
        }

        $daysSinceLastUpdate = $lastStreakUpdate->startOfDay()->diffInDays($now->startOfDay());

        if ($daysSinceLastUpdate === 0) {
            // Mismo día, solo actualizar last_activity
            $user->update(['last_activity_at' => $now]);
            return $result;
        }

        if ($daysSinceLastUpdate === 1) {
            // Día consecutivo, incrementar streak
            $newStreak = $user->current_streak + 1;
            $longestStreak = max($newStreak, $user->longest_streak);

            $user->update([
                'current_streak' => $newStreak,
                'longest_streak' => $longestStreak,
                'streak_updated_at' => $now,
                'last_activity_at' => $now,
            ]);

            $result['streak_updated'] = true;
            $result['new_streak'] = $newStreak;
            $result['streak_bonus'] = $this->calculateStreakBonus($newStreak);
            return $result;
        }

        // Más de un día sin actividad, resetear streak
        $user->update([
            'current_streak' => 1,
            'streak_updated_at' => $now,
            'last_activity_at' => $now,
        ]);

        $result['streak_broken'] = true;
        $result['new_streak'] = 1;
        return $result;
    }

    /**
     * Calcula el bonus por racha.
     */
    public function calculateStreakBonus(int $streakDays): int
    {
        // Bonus progresivo: 10% extra por cada 7 días de racha, máximo 50%
        $bonusMultiplier = min(50, floor($streakDays / 7) * 10);
        return (int) $bonusMultiplier;
    }

    /**
     * Verifica si el streak del usuario está activo hoy.
     */
    public function isStreakActiveToday(RewardUser $user): bool
    {
        if (!$user->streak_updated_at) {
            return false;
        }

        $lastUpdate = Carbon::parse($user->streak_updated_at);
        return $lastUpdate->isToday();
    }

    /**
     * Obtiene información del streak del usuario.
     */
    public function getStreakInfo(RewardUser $user): array
    {
        $isActiveToday = $this->isStreakActiveToday($user);
        $lastUpdate = $user->streak_updated_at ? Carbon::parse($user->streak_updated_at) : null;

        $willExpireAt = null;
        $hoursRemaining = null;

        if ($lastUpdate && !$isActiveToday) {
            // El streak expirará al final de mañana si no hay actividad hoy
            $willExpireAt = $lastUpdate->copy()->addDays(2)->startOfDay();
            $hoursRemaining = now()->diffInHours($willExpireAt, false);
        }

        return [
            'current_streak' => $user->current_streak,
            'longest_streak' => $user->longest_streak,
            'is_active_today' => $isActiveToday,
            'last_activity' => $user->last_activity_at?->toIso8601String(),
            'streak_bonus_percent' => $this->calculateStreakBonus($user->current_streak),
            'will_expire_at' => $willExpireAt?->toIso8601String(),
            'hours_remaining' => $hoursRemaining > 0 ? $hoursRemaining : null,
        ];
    }

    /**
     * Procesa los streaks diarios (comando de cron).
     * Resetea streaks de usuarios que no tuvieron actividad ayer.
     */
    public function processDailyStreaks(): array
    {
        $yesterday = Carbon::yesterday()->endOfDay();

        $usersToReset = RewardUser::where('current_streak', '>', 0)
            ->where(function ($q) use ($yesterday) {
                $q->whereNull('streak_updated_at')
                    ->orWhere('streak_updated_at', '<', $yesterday->subDay());
            })
            ->get();

        $resetCount = 0;

        foreach ($usersToReset as $user) {
            $user->update(['current_streak' => 0]);
            $this->cacheService->invalidateUser($user->id);
            $resetCount++;
        }

        return [
            'processed_at' => now()->toIso8601String(),
            'streaks_reset' => $resetCount,
        ];
    }
}
