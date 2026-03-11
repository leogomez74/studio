<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Rewards;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Rewards\RewardCatalogItem;
use App\Services\Rewards\RewardService;
use App\Services\Rewards\CatalogService;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CatalogController extends Controller
{
    use LogsActivity;
    public function __construct(
        protected RewardService $rewardService,
        protected CatalogService $catalogService
    ) {}

    /**
     * Helper para obtener el usuario (autenticado o de prueba).
     */
    protected function getUser(Request $request): User
    {
        return $request->user() ?? User::firstOrFail();
    }

    /**
     * Lista los items del catálogo disponibles.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $this->getUser($request);
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        $category = $request->input('category');
        $items = $this->catalogService->getAvailableItems($rewardUser, $category);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items,
                'user_points' => $rewardUser->total_points,
                'user_level' => $rewardUser->level,
            ],
        ]);
    }

    /**
     * Muestra un item específico del catálogo.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $this->getUser($request);
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        $item = RewardCatalogItem::findOrFail($id);
        $canRedeem = $this->catalogService->canRedeem($rewardUser, $item);

        return response()->json([
            'success' => true,
            'data' => [
                'item' => [
                    'id' => $item->id,
                    'slug' => $item->slug,
                    'name' => $item->name,
                    'description' => $item->description,
                    'category' => $item->category,
                    'cost' => $item->cost,
                    'currency' => $item->currency,
                    'stock' => $item->stock,
                    'image_url' => $item->image_url,
                    'level_required' => $item->level_required,
                    'available_from' => $item->available_from,
                    'available_until' => $item->available_until,
                ],
                'can_redeem' => $canRedeem['can_redeem'],
                'reason' => $canRedeem['reason'] ?? null,
                'user_points' => $rewardUser->total_points,
                'user_level' => $rewardUser->level,
            ],
        ]);
    }

    /**
     * Canjea un item del catálogo.
     */
    public function redeem(Request $request, int $id): JsonResponse
    {
        $user = $this->getUser($request);
        $rewardUser = $this->rewardService->getOrCreateRewardUser($user->id);

        $item = RewardCatalogItem::findOrFail($id);

        $deliveryInfo = $request->validate([
            'delivery_info' => 'nullable|array',
            'notes' => 'nullable|string|max:500',
        ]);

        try {
            $redemption = $this->catalogService->redeemItem(
                $rewardUser,
                $item,
                $deliveryInfo['delivery_info'] ?? null,
                $deliveryInfo['notes'] ?? null
            );

            $this->logActivity('create', 'Rewards - Canje', $redemption, $item->name, [
                ['field' => 'item', 'old_value' => null, 'new_value' => $item->name],
                ['field' => 'points_spent', 'old_value' => null, 'new_value' => $redemption->points_spent],
                ['field' => 'new_balance', 'old_value' => null, 'new_value' => $rewardUser->fresh()->total_points],
            ], $request);

            return response()->json([
                'success' => true,
                'message' => 'Item canjeado exitosamente.',
                'data' => [
                    'redemption_id' => $redemption->id,
                    'status' => $redemption->status,
                    'points_spent' => $redemption->points_spent,
                    'new_balance' => $rewardUser->fresh()->total_points,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }
}
