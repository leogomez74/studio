<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Rewards;

use App\Http\Controllers\Controller;
use App\Services\Rewards\RewardService;
use App\Services\Rewards\Badges\BadgeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RewardController extends Controller
{
    public function __construct(
        protected RewardService $rewardService,
        protected BadgeService $badgeService
    ) {}

    /**
     * Obtiene el perfil de gamificación del usuario.
     */
    public function profile(Request $request): JsonResponse
    {
        $user = $request->user();
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
        $user = $request->user();
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
        $user = $request->user();
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
     */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        return response()->json([
            'success' => true,
            'data' => [
                'summary' => $this->rewardService->getUserSummary($rewardUser),
                'badges' => [
                    'earned' => $this->badgeService->getUserBadges($rewardUser),
                    'available' => $this->badgeService->getAvailableBadges($rewardUser),
                ],
                'recent_activity' => $this->rewardService->getTransactionHistory($rewardUser, 10),
            ],
        ]);
    }
}
