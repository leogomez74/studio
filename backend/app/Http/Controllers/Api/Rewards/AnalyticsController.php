<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Rewards;

use App\Http\Controllers\Controller;
use App\Models\Rewards\RewardUser;
use App\Models\Rewards\RewardBadge;
use App\Models\Rewards\RewardUserBadge;
use App\Models\Rewards\RewardTransaction;
use App\Models\Rewards\RewardChallenge;
use App\Models\Rewards\RewardChallengeParticipation;
use App\Models\Rewards\RewardCatalogItem;
use App\Models\Rewards\RewardRedemption;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AnalyticsController extends Controller
{
    /**
     * Obtiene las estadísticas generales del sistema de gamificación.
     */
    public function overview(Request $request): JsonResponse
    {
        $period = $request->get('period', 'month');
        $startDate = $this->getStartDate($period);
        $previousStartDate = $this->getPreviousStartDate($period);

        // Estadísticas actuales
        $totalUsers = RewardUser::count();
        $activeUsers = RewardUser::where('last_activity_at', '>=', $startDate)->count();
        $totalPointsDistributed = RewardTransaction::where('type', 'earn')
            ->where('created_at', '>=', $startDate)
            ->sum('amount');
        $totalBadgesAwarded = RewardUserBadge::where('earned_at', '>=', $startDate)->count();
        $totalChallengesCompleted = RewardChallengeParticipation::whereNotNull('completed_at')
            ->where('completed_at', '>=', $startDate)
            ->count();
        $totalRedemptions = RewardRedemption::where('created_at', '>=', $startDate)->count();

        // Estadísticas del período anterior para calcular cambios
        $previousActiveUsers = RewardUser::where('last_activity_at', '>=', $previousStartDate)
            ->where('last_activity_at', '<', $startDate)
            ->count();
        $previousPointsDistributed = RewardTransaction::where('type', 'earn')
            ->where('created_at', '>=', $previousStartDate)
            ->where('created_at', '<', $startDate)
            ->sum('amount');
        $previousBadgesAwarded = RewardUserBadge::where('earned_at', '>=', $previousStartDate)
            ->where('earned_at', '<', $startDate)
            ->count();
        $previousChallengesCompleted = RewardChallengeParticipation::whereNotNull('completed_at')
            ->where('completed_at', '>=', $previousStartDate)
            ->where('completed_at', '<', $startDate)
            ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'overview' => [
                    'total_users' => $totalUsers,
                    'active_users' => $activeUsers,
                    'total_points_distributed' => (int) $totalPointsDistributed,
                    'total_badges_awarded' => $totalBadgesAwarded,
                    'total_challenges_completed' => $totalChallengesCompleted,
                    'total_redemptions' => $totalRedemptions,
                ],
                'trends' => [
                    'users_change' => $this->calculateChange($activeUsers, $previousActiveUsers),
                    'points_change' => $this->calculateChange($totalPointsDistributed, $previousPointsDistributed),
                    'badges_change' => $this->calculateChange($totalBadgesAwarded, $previousBadgesAwarded),
                    'challenges_change' => $this->calculateChange($totalChallengesCompleted, $previousChallengesCompleted),
                ],
                'period' => $period,
            ],
        ]);
    }

    /**
     * Obtiene las acciones más realizadas y sus puntos.
     */
    public function topActions(Request $request): JsonResponse
    {
        $period = $request->get('period', 'month');
        $startDate = $this->getStartDate($period);
        $limit = $request->get('limit', 10);

        // Usamos reference_type para agrupar las acciones ya que no existe columna 'action'
        $topActions = RewardTransaction::where('type', 'earn')
            ->where('created_at', '>=', $startDate)
            ->whereNotNull('reference_type')
            ->select('reference_type')
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('SUM(amount) as total_points')
            ->groupBy('reference_type')
            ->orderByDesc('total_points')
            ->limit($limit)
            ->get()
            ->map(function ($item) {
                return [
                    'action' => $item->reference_type,
                    'label' => $this->getActionLabel($item->reference_type),
                    'count' => (int) $item->count,
                    'points' => (int) $item->total_points,
                ];
            });

        // Si no hay datos por reference_type, mostrar por tipo de transacción
        if ($topActions->isEmpty()) {
            $topActions = RewardTransaction::where('type', 'earn')
                ->where('created_at', '>=', $startDate)
                ->select('type')
                ->selectRaw('COUNT(*) as count')
                ->selectRaw('SUM(amount) as total_points')
                ->groupBy('type')
                ->orderByDesc('total_points')
                ->limit($limit)
                ->get()
                ->map(function ($item) {
                    return [
                        'action' => $item->type,
                        'label' => $this->getActionLabel($item->type),
                        'count' => (int) $item->count,
                        'points' => (int) $item->total_points,
                    ];
                });
        }

        return response()->json([
            'success' => true,
            'data' => $topActions,
        ]);
    }

    /**
     * Obtiene la distribución de badges por rareza.
     */
    public function badgeDistribution(): JsonResponse
    {
        $distribution = RewardUserBadge::join('reward_badges', 'reward_user_badges.reward_badge_id', '=', 'reward_badges.id')
            ->select('reward_badges.rarity')
            ->selectRaw('COUNT(*) as count')
            ->groupBy('reward_badges.rarity')
            ->get();

        $total = $distribution->sum('count');

        $rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        $result = collect($rarities)->map(function ($rarity) use ($distribution, $total) {
            $item = $distribution->firstWhere('rarity', $rarity);
            $count = $item ? $item->count : 0;
            return [
                'rarity' => $rarity,
                'count' => $count,
                'percentage' => $total > 0 ? round(($count / $total) * 100, 1) : 0,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    /**
     * Obtiene estadísticas de challenges.
     */
    public function challengeStats(): JsonResponse
    {
        $now = now();

        $activeChallenges = RewardChallenge::where('is_active', true)
            ->where('starts_at', '<=', $now)
            ->where('ends_at', '>=', $now)
            ->count();

        $completedParticipations = RewardChallengeParticipation::whereNotNull('completed_at')->count();
        $totalParticipations = RewardChallengeParticipation::count();

        $participationRate = $totalParticipations > 0 
            ? round(($completedParticipations / $totalParticipations) * 100, 1) 
            : 0;

        // Tiempo promedio de completado (en días)
        $avgCompletionTime = RewardChallengeParticipation::whereNotNull('completed_at')
            ->selectRaw('AVG(DATEDIFF(completed_at, joined_at)) as avg_days')
            ->value('avg_days');

        return response()->json([
            'success' => true,
            'data' => [
                'active' => $activeChallenges,
                'completed' => $completedParticipations,
                'participation_rate' => $participationRate,
                'avg_completion_time' => round((float) ($avgCompletionTime ?? 0), 1),
            ],
        ]);
    }

    /**
     * Obtiene canjes agrupados por categoría.
     */
    public function redemptionsByCategory(Request $request): JsonResponse
    {
        $period = $request->get('period', 'month');
        $startDate = $this->getStartDate($period);

        $redemptions = RewardRedemption::where('reward_redemptions.created_at', '>=', $startDate)
            ->join('reward_catalog_items', 'reward_redemptions.catalog_item_id', '=', 'reward_catalog_items.id')
            ->select('reward_catalog_items.category')
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('SUM(reward_redemptions.points_spent) as total_points')
            ->groupBy('reward_catalog_items.category')
            ->orderByDesc('count')
            ->get()
            ->map(function ($item) {
                return [
                    'category' => $item->category ?? 'other',
                    'count' => (int) $item->count,
                    'value' => (int) $item->total_points,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $redemptions,
        ]);
    }

    /**
     * Obtiene actividad diaria de la última semana.
     */
    public function weeklyActivity(): JsonResponse
    {
        $days = collect();
        $dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

        for ($i = 6; $i >= 0; $i--) {
            $date = Carbon::now()->subDays($i);
            $dayStart = $date->copy()->startOfDay();
            $dayEnd = $date->copy()->endOfDay();

            $points = RewardTransaction::where('type', 'earn')
                ->whereBetween('created_at', [$dayStart, $dayEnd])
                ->sum('amount');

            $badges = RewardUserBadge::whereBetween('earned_at', [$dayStart, $dayEnd])->count();

            $challenges = RewardChallengeParticipation::whereNotNull('completed_at')
                ->whereBetween('completed_at', [$dayStart, $dayEnd])
                ->count();

            $days->push([
                'day' => $dayNames[$date->dayOfWeek],
                'date' => $date->format('Y-m-d'),
                'points' => (int) $points,
                'badges' => $badges,
                'challenges' => $challenges,
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => $days,
        ]);
    }

    /**
     * Obtiene todos los analytics en una sola llamada.
     */
    public function all(Request $request): JsonResponse
    {
        $period = $request->get('period', 'month');

        // Recopilar todos los datos
        $overviewResponse = $this->overview($request);
        $topActionsResponse = $this->topActions($request);
        $badgeDistributionResponse = $this->badgeDistribution();
        $challengeStatsResponse = $this->challengeStats();
        $redemptionsResponse = $this->redemptionsByCategory($request);
        $weeklyActivityResponse = $this->weeklyActivity();

        return response()->json([
            'success' => true,
            'data' => [
                'overview' => json_decode($overviewResponse->getContent(), true)['data']['overview'],
                'trends' => json_decode($overviewResponse->getContent(), true)['data']['trends'],
                'top_actions' => json_decode($topActionsResponse->getContent(), true)['data'],
                'badge_distribution' => json_decode($badgeDistributionResponse->getContent(), true)['data'],
                'challenge_stats' => json_decode($challengeStatsResponse->getContent(), true)['data'],
                'redemptions_by_category' => json_decode($redemptionsResponse->getContent(), true)['data'],
                'weekly_activity' => json_decode($weeklyActivityResponse->getContent(), true)['data'],
                'period' => $period,
            ],
        ]);
    }

    /**
     * Calcula la fecha de inicio según el período.
     */
    private function getStartDate(string $period): Carbon
    {
        return match ($period) {
            'week' => Carbon::now()->subWeek(),
            'month' => Carbon::now()->subMonth(),
            'quarter' => Carbon::now()->subMonths(3),
            'year' => Carbon::now()->subYear(),
            default => Carbon::now()->subMonth(),
        };
    }

    /**
     * Calcula la fecha de inicio del período anterior.
     */
    private function getPreviousStartDate(string $period): Carbon
    {
        return match ($period) {
            'week' => Carbon::now()->subWeeks(2),
            'month' => Carbon::now()->subMonths(2),
            'quarter' => Carbon::now()->subMonths(6),
            'year' => Carbon::now()->subYears(2),
            default => Carbon::now()->subMonths(2),
        };
    }

    /**
     * Calcula el porcentaje de cambio entre dos valores.
     */
    private function calculateChange($current, $previous): float
    {
        if ($previous == 0) {
            return $current > 0 ? 100 : 0;
        }
        return round((($current - $previous) / $previous) * 100, 1);
    }

    /**
     * Obtiene la etiqueta legible de una acción.
     */
    private function getActionLabel(string $action): string
    {
        $labels = [
            // Tipos de transacción
            'earn' => 'Puntos ganados',
            'spend' => 'Puntos gastados',
            'bonus' => 'Bonus',
            'expire' => 'Puntos expirados',
            'badge_reward' => 'Recompensa por badge',
            'challenge_reward' => 'Recompensa por challenge',
            // Reference types (modelos)
            'App\\Models\\Rewards\\RewardBadge' => 'Badge obtenido',
            'App\\Models\\Rewards\\RewardChallenge' => 'Challenge completado',
            'App\\Models\\Credit' => 'Préstamo creado',
            'App\\Models\\Client' => 'Cliente agregado',
            'App\\Models\\CreditPayment' => 'Pago recibido',
            'App\\Models\\CreditDocument' => 'Documento subido',
            'App\\Models\\User' => 'Actividad de usuario',
            // Acciones generales
            'loan_created' => 'Préstamo creado',
            'client_added' => 'Cliente agregado',
            'payment_received' => 'Pago recibido',
            'document_uploaded' => 'Documento subido',
            'daily_login' => 'Login diario',
            'profile_completed' => 'Perfil completado',
            'referral' => 'Referido exitoso',
            'streak_bonus' => 'Bonus de racha',
            'challenge_completed' => 'Challenge completado',
            'badge_earned' => 'Badge obtenido',
        ];

        return $labels[$action] ?? ucfirst(str_replace(['_', 'App\\Models\\', 'App\\Models\\Rewards\\'], [' ', '', ''], $action));
    }
}
