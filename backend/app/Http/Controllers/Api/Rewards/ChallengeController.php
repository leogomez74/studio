<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Rewards;

use App\Http\Controllers\Controller;
use App\Models\Rewards\RewardChallenge;
use App\Models\Rewards\RewardChallengeParticipation;
use App\Services\Rewards\RewardService;
use App\Services\Rewards\ChallengeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChallengeController extends Controller
{
    public function __construct(
        protected RewardService $rewardService,
        protected ChallengeService $challengeService
    ) {}

    /**
     * Lista los challenges disponibles y activos.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        $status = $request->input('status', 'active'); // active, upcoming, completed, all

        $challenges = $this->challengeService->getChallenges($rewardUser, $status);

        return response()->json([
            'success' => true,
            'data' => $challenges,
        ]);
    }

    /**
     * Muestra un challenge específico.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        $challenge = RewardChallenge::findOrFail($id);
        $participation = $this->challengeService->getParticipation($rewardUser, $challenge);

        return response()->json([
            'success' => true,
            'data' => [
                'challenge' => [
                    'id' => $challenge->id,
                    'slug' => $challenge->slug,
                    'name' => $challenge->name,
                    'description' => $challenge->description,
                    'type' => $challenge->type,
                    'objectives' => $challenge->objectives,
                    'rewards' => $challenge->rewards,
                    'start_date' => $challenge->start_date,
                    'end_date' => $challenge->end_date,
                    'max_participants' => $challenge->max_participants,
                    'current_participants' => $challenge->participations()->count(),
                ],
                'participation' => $participation,
            ],
        ]);
    }

    /**
     * Unirse a un challenge.
     */
    public function join(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        $challenge = RewardChallenge::findOrFail($id);

        try {
            $participation = $this->challengeService->joinChallenge($rewardUser, $challenge);

            return response()->json([
                'success' => true,
                'message' => 'Te has unido al desafío exitosamente.',
                'data' => $participation,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Obtiene el progreso del usuario en un challenge.
     */
    public function progress(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        $challenge = RewardChallenge::findOrFail($id);
        $progress = $this->challengeService->getProgress($rewardUser, $challenge);

        return response()->json([
            'success' => true,
            'data' => $progress,
        ]);
    }
}
