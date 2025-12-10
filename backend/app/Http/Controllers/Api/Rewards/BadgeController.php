<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Rewards;

use App\Http\Controllers\Controller;
use App\Models\Rewards\RewardBadge;
use App\Services\Rewards\RewardService;
use App\Services\Rewards\Badges\BadgeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BadgeController extends Controller
{
    public function __construct(
        protected RewardService $rewardService,
        protected BadgeService $badgeService
    ) {}

    /**
     * Lista todos los badges ganados por el usuario.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        $badges = $this->badgeService->getUserBadges($rewardUser);

        return response()->json([
            'success' => true,
            'data' => $badges,
        ]);
    }

    /**
     * Lista los badges disponibles para ganar.
     */
    public function available(Request $request): JsonResponse
    {
        $user = $request->user();
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        $badges = $this->badgeService->getAvailableBadges($rewardUser);

        return response()->json([
            'success' => true,
            'data' => $badges,
        ]);
    }

    /**
     * Obtiene el progreso hacia todos los badges.
     */
    public function progress(Request $request): JsonResponse
    {
        $user = $request->user();
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        $earned = $this->badgeService->getUserBadges($rewardUser);
        $available = $this->badgeService->getAvailableBadges($rewardUser);

        return response()->json([
            'success' => true,
            'data' => [
                'total_badges' => RewardBadge::where('is_active', true)->count(),
                'earned_count' => count($earned),
                'earned' => $earned,
                'in_progress' => array_filter($available, fn($b) => $b['progress'] > 0),
                'locked' => array_filter($available, fn($b) => $b['progress'] === 0.0),
            ],
        ]);
    }

    /**
     * Muestra un badge específico.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $badge = RewardBadge::with('category')->findOrFail($id);

        $user = $request->user();
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        $hasEarned = $this->badgeService->userHasBadge($rewardUser, $badge);
        $progress = $hasEarned ? 1.0 : $this->badgeService->getProgress($rewardUser, $badge);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $badge->id,
                'slug' => $badge->slug,
                'name' => $badge->name,
                'description' => $badge->description,
                'icon' => $badge->icon,
                'rarity' => $badge->rarity,
                'category' => $badge->category?->name,
                'points_reward' => $badge->points_reward,
                'xp_reward' => $badge->xp_reward,
                'is_secret' => $badge->is_secret,
                'earned' => $hasEarned,
                'progress' => $progress,
            ],
        ]);
    }
}
