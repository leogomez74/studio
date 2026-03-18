<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Rewards;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Rewards\CacheService;
use App\Services\Rewards\ChallengeService;
use App\Services\Rewards\LeaderboardService;
use App\Services\Rewards\RewardService;
use App\Services\Rewards\Badges\BadgeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RewardController extends Controller
{
    public function __construct(
        protected RewardService $rewardService,
        protected BadgeService $badgeService,
        protected CacheService $cacheService,
        protected LeaderboardService $leaderboardService,
        protected ChallengeService $challengeService,
    ) {}

    /**
     * Helper para obtener el usuario (autenticado o de prueba).
     */
    protected function getUser(Request $request): User
    {
        return $request->user() ?? abort(401, 'No autenticado');
    }

    /**
     * Obtiene el perfil de gamificación del usuario.
     */
    public function profile(Request $request): JsonResponse
    {
        $user = $this->getUser($request);
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ],
                'gamification' => $this->rewardService->getUserSummary($rewardUser),
                'recent_badges' => array_slice($this->badgeService->getUserBadges($rewardUser), 0, 5),
            ],
        ]);
    }

    /**
     * Obtiene el balance de puntos del usuario.
     */
    public function balance(Request $request): JsonResponse
    {
        $user = $this->getUser($request);
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        return response()->json([
            'success' => true,
            'data' => [
                'total_points' => $rewardUser->total_points,
                'lifetime_points' => $rewardUser->lifetime_points,
                'level' => $rewardUser->level,
                'experience_points' => $rewardUser->experience_points,
            ],
        ]);
    }

    /**
     * Obtiene el historial de transacciones del usuario.
     */
    public function history(Request $request): JsonResponse
    {
        $user = $this->getUser($request);
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        $limit = $request->input('limit', 20);
        $history = $this->rewardService->getTransactionHistory($rewardUser, $limit);

        return response()->json([
            'success' => true,
            'data' => $history,
        ]);
    }

    /**
     * Obtiene el dashboard completo del usuario.
     * Consolidado: retorna summary + badges + leaderboard + challenges + actividad
     * en 1 solo request (cacheado 60s).
     */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $this->getUser($request);
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        // Intentar desde caché
        $cached = $this->cacheService->getDashboard($rewardUser->user_id);
        if ($cached) {
            return response()->json(['success' => true, 'data' => $cached]);
        }

        $availableBadges = $this->badgeService->getAvailableBadges($rewardUser);
        $leaderboard = $this->leaderboardService->getRanking('points', 'weekly', 5);
        $challenges = $this->challengeService->getChallenges($rewardUser, 'active');

        $data = [
            'summary' => $this->rewardService->getUserSummary($rewardUser),
            'badges' => [
                'earned' => $this->badgeService->getUserBadges($rewardUser),
                'available' => $availableBadges,
            ],
            'leaderboard' => $leaderboard,
            'challenges' => $challenges,
            'recent_activity' => $this->rewardService->getTransactionHistory($rewardUser, 10),
        ];

        $this->cacheService->setDashboard($rewardUser->user_id, $data);

        return response()->json(['success' => true, 'data' => $data]);
    }
}
