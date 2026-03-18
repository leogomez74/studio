<?php

declare(strict_types=1);

namespace App\Services\Rewards;

use App\Models\Rewards\RewardUser;
use App\Models\Rewards\RewardLeaderboard;
use App\Models\Rewards\RewardLeaderboardEntry;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class LeaderboardService
{
    private const SNAPSHOT_LIMIT = 100;
    private const DEFAULT_NEARBY_RANGE = 2;

    protected CacheService $cacheService;

    public function __construct(CacheService $cacheService)
    {
        $this->cacheService = $cacheService;
    }

    /**
     * Obtiene el ranking con caché.
     */
    public function getRanking(string $metric, string $period, int $limit = 50): array
    {
        $cacheKey = "rewards:leaderboard:{$metric}:{$period}:{$limit}";

        $ttl = config('gamification.cache.ttl_rankings', 300);

        return Cache::remember($cacheKey, $ttl, function () use ($metric, $period, $limit) {
            return $this->calculateRanking($metric, $period, $limit);
        });
    }

    /**
     * Calcula el ranking en tiempo real.
     */
    protected function calculateRanking(string $metric, string $period, int $limit): array
    {
        $query = $this->buildRankingQuery($metric, $period);

        $entries = $query->limit($limit)->get();

        return [
            'metric' => $metric,
            'period' => $period,
            'entries' => $entries->map(function ($entry, $index) {
                return [
                    'rank' => $index + 1,
                    'user' => [
                        'id' => $entry->user_id,
                        'name' => $entry->user->name ?? 'Usuario',
                        'avatar' => $entry->user->avatar ?? null,
                        'level' => $entry->level,
                    ],
                    'value' => (int) $entry->value,
                ];
            })->toArray(),
            'generated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Construye la query del ranking.
     */
    protected function buildRankingQuery(string $metric, string $period)
    {
        $column = match ($metric) {
            'points' => 'total_points',
            'experience' => 'experience_points',
            'streak' => 'current_streak',
            'level' => 'level',
            'lifetime_points' => 'lifetime_points',
            default => 'total_points',
        };

        $query = RewardUser::with('user:id,name,email,avatar')
            ->select('reward_users.*', DB::raw("{$column} as value"))
            ->where($column, '>', 0)
            ->orderByDesc('value');

        // Filtrar por período si aplica
        if ($period !== 'all_time') {
            $startDate = $this->getPeriodStartDate($period);
            $query->where('last_activity_at', '>=', $startDate);
        }

        return $query;
    }

    /**
     * Obtiene la fecha de inicio del período.
     */
    protected function getPeriodStartDate(string $period): Carbon
    {
        return match ($period) {
            'daily' => now()->startOfDay(),
            'weekly' => now()->startOfWeek(),
            'monthly' => now()->startOfMonth(),
            'yearly' => now()->startOfYear(),
            default => now()->startOfMonth(),
        };
    }

    /**
     * Obtiene la posición del usuario en el ranking.
     */
    public function getUserPosition(int $userId, string $metric, string $period): ?array
    {
        $cacheKey = "rewards:leaderboard:position:{$userId}:{$metric}:{$period}";

        $ttl = config('gamification.cache.ttl_user_data', 60);

        return Cache::remember($cacheKey, $ttl, function () use ($userId, $metric, $period) {
            return $this->calculateUserPosition($userId, $metric, $period);
        });
    }

    /**
     * Calcula la posición del usuario.
     */
    protected function calculateUserPosition(int $userId, string $metric, string $period): ?array
    {
        $user = RewardUser::where('user_id', $userId)->first();

        if (!$user) {
            return null;
        }

        $column = match ($metric) {
            'points' => 'total_points',
            'experience' => 'experience_points',
            'streak' => 'current_streak',
            'level' => 'level',
            default => 'total_points',
        };

        $userValue = $user->{$column};

        // Contar usuarios con mayor valor
        $query = RewardUser::where($column, '>', $userValue);

        if ($period !== 'all_time') {
            $startDate = $this->getPeriodStartDate($period);
            $query->where('last_activity_at', '>=', $startDate);
        }

        $position = $query->count() + 1;

        // Contar total de participantes
        $totalQuery = RewardUser::where($column, '>', 0);
        if ($period !== 'all_time') {
            $totalQuery->where('last_activity_at', '>=', $this->getPeriodStartDate($period));
        }
        $total = $totalQuery->count();

        return [
            'position' => $position,
            'value' => $userValue,
            'total_participants' => $total,
            'percentile' => $total > 0 ? round((1 - ($position / $total)) * 100, 1) : 0,
        ];
    }

    /**
     * Obtiene los usuarios cercanos en el ranking.
     */
    public function getNearbyUsers(int $userId, string $metric, string $period, int $range = self::DEFAULT_NEARBY_RANGE): array
    {
        $position = $this->getUserPosition($userId, $metric, $period);

        if (!$position) {
            return [];
        }

        $ranking = $this->getRanking($metric, $period, $position['position'] + $range);

        $start = max(0, $position['position'] - $range - 1);
        $entries = array_slice($ranking['entries'], $start, ($range * 2) + 1);

        return [
            'user_position' => $position['position'],
            'entries' => $entries,
        ];
    }

    /**
     * Actualiza los snapshots de leaderboard.
     */
    public function updateLeaderboardSnapshots(): void
    {
        $leaderboards = RewardLeaderboard::where('is_active', true)->get();

        foreach ($leaderboards as $leaderboard) {
            $this->updateLeaderboardSnapshot($leaderboard);
        }
    }

    /**
     * Actualiza el snapshot de un leaderboard específico.
     */
    protected function updateLeaderboardSnapshot(RewardLeaderboard $leaderboard): void
    {
        $ranking = $this->calculateRanking($leaderboard->metric, $leaderboard->period, self::SNAPSHOT_LIMIT);
        $periodDates = $this->getPeriodDates($leaderboard->period);

        foreach ($ranking['entries'] as $entry) {
            $rewardUser = RewardUser::where('user_id', $entry['user']['id'])->first();

            if (!$rewardUser) {
                continue;
            }

            // Obtener rank anterior
            $previousEntry = RewardLeaderboardEntry::where('leaderboard_id', $leaderboard->id)
                ->where('reward_user_id', $rewardUser->id)
                ->where('period_start', '<', $periodDates['start'])
                ->orderByDesc('period_start')
                ->first();

            RewardLeaderboardEntry::updateOrCreate(
                [
                    'leaderboard_id' => $leaderboard->id,
                    'reward_user_id' => $rewardUser->id,
                    'period_start' => $periodDates['start'],
                ],
                [
                    'rank' => $entry['rank'],
                    'value' => $entry['value'],
                    'previous_rank' => $previousEntry?->rank,
                    'period_end' => $periodDates['end'],
                ]
            );
        }
    }

    /**
     * Obtiene las fechas del período.
     */
    protected function getPeriodDates(string $period): array
    {
        return match ($period) {
            'daily' => [
                'start' => now()->startOfDay()->toDateString(),
                'end' => now()->endOfDay()->toDateString(),
            ],
            'weekly' => [
                'start' => now()->startOfWeek()->toDateString(),
                'end' => now()->endOfWeek()->toDateString(),
            ],
            'monthly' => [
                'start' => now()->startOfMonth()->toDateString(),
                'end' => now()->endOfMonth()->toDateString(),
            ],
            default => [
                'start' => now()->startOfYear()->toDateString(),
                'end' => now()->endOfYear()->toDateString(),
            ],
        };
    }
}
