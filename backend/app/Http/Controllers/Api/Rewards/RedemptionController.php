<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Rewards;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Rewards\RewardService;
use App\Services\Rewards\RedemptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RedemptionController extends Controller
{
    public function __construct(
        protected RewardService $rewardService,
        protected RedemptionService $redemptionService
    ) {}

    /**
     * Helper para obtener el usuario (autenticado o de prueba).
     */
    protected function getUser(Request $request): User
    {
        return $request->user() ?? abort(401, 'No autenticado');
    }

    /**
     * Lista las redenciones del usuario.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $this->getUser($request);
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        $status = $request->input('status'); // pending, approved, rejected, delivered, cancelled
        $redemptions = $this->redemptionService->getUserRedemptions($rewardUser, $status);

        return response()->json([
            'success' => true,
            'data' => $redemptions,
        ]);
    }
}
