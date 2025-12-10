<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Rewards;

use App\Http\Controllers\Controller;
use App\Services\Rewards\RewardService;
use App\Services\Rewards\LeaderboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaderboardController extends Controller
{
    public function __construct(
        protected RewardService $rewardService,
        protected LeaderboardService $leaderboardService
    ) {}

    /**
     * Obtiene el ranking principal.
     */
    public function index(Request $request): JsonResponse
    {
        $metric = $request->input('metric', 'points');
        $period = $request->input('period', 'monthly');
        $limit = min((int) $request->input('limit', 50), 100);

        $ranking = $this->leaderboardService->getRanking($metric, $period, $limit);

        return response()->json([
            'success' => true,
            'data' => $ranking,
        ]);
    }

    /**
     * Obtiene la posición del usuario actual.
     */
    public function myPosition(Request $request): JsonResponse
    {
        $user = $request->user();
        $metric = $request->input('metric', 'points');
        $period = $request->input('period', 'monthly');

        $position = $this->leaderboardService->getUserPosition($user->id, $metric, $period);
        $nearby = $this->leaderboardService->getNearbyUsers($user->id, $metric, $period);

        return response()->json([
            'success' => true,
            'data' => [
                'position' => $position,
                'nearby_users' => $nearby,
            ],
        ]);
    }

    /**
     * Obtiene estadísticas de los leaderboards.
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();

        $metrics = ['points', 'experience', 'streak', 'level'];
        $periods = ['weekly', 'monthly', 'all_time'];

        $stats = [];
        foreach ($metrics as $metric) {
            $stats[$metric] = [];
            foreach ($periods as $period) {
                $position = $this->leaderboardService->getUserPosition($user->id, $metric, $period);
                $stats[$metric][$period] = $position;
            }
        }

        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }
}
