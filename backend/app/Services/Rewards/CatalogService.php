<?php

declare(strict_types=1);

namespace App\Services\Rewards;

use App\Models\Rewards\RewardUser;
use App\Models\Rewards\RewardCatalogItem;
use App\Models\Rewards\RewardRedemption;
use Illuminate\Support\Facades\DB;

class CatalogService
{
    protected RewardService $rewardService;

    public function __construct(RewardService $rewardService)
    {
        $this->rewardService = $rewardService;
    }

    /**
     * Obtiene los items disponibles del catálogo.
     */
    public function getAvailableItems(RewardUser $user, ?string $category = null): array
    {
        $query = RewardCatalogItem::where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('available_from')
                    ->orWhere('available_from', '<=', now());
            })
            ->where(function ($q) {
                $q->whereNull('available_until')
                    ->orWhere('available_until', '>=', now());
            })
            ->where(function ($q) {
                $q->where('stock', '=', -1)  // Ilimitado
                    ->orWhere('stock', '>', 0);
            });

        if ($category) {
            $query->where('category', $category);
        }

        return $query->orderBy('cost')->get()->map(function ($item) use ($user) {
            $canRedeem = $this->canRedeem($user, $item);

            return [
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
                'can_redeem' => $canRedeem['can_redeem'],
                'reason' => $canRedeem['reason'] ?? null,
            ];
        })->toArray();
    }

    /**
     * Verifica si el usuario puede canjear un item.
     */
    public function canRedeem(RewardUser $user, RewardCatalogItem $item): array
    {
        // Verificar si está activo
        if (!$item->is_active) {
            return ['can_redeem' => false, 'reason' => 'Este item no está disponible.'];
        }

        // Verificar fechas de disponibilidad
        $now = now();
        if ($item->available_from && $now < $item->available_from) {
            return ['can_redeem' => false, 'reason' => 'Este item aún no está disponible.'];
        }
        if ($item->available_until && $now > $item->available_until) {
            return ['can_redeem' => false, 'reason' => 'Este item ya no está disponible.'];
        }

        // Verificar stock
        if ($item->stock !== -1 && $item->stock <= 0) {
            return ['can_redeem' => false, 'reason' => 'Este item está agotado.'];
        }

        // Verificar nivel
        if ($user->level < $item->level_required) {
            return [
                'can_redeem' => false,
                'reason' => "Necesitas nivel {$item->level_required} para canjear este item."
            ];
        }

        // Verificar puntos
        if ($user->total_points < $item->cost) {
            return [
                'can_redeem' => false,
                'reason' => "No tienes suficientes puntos. Necesitas {$item->cost} puntos."
            ];
        }

        return ['can_redeem' => true];
    }

    /**
     * Canjea un item del catálogo.
     */
    public function redeemItem(
        RewardUser $user,
        RewardCatalogItem $item,
        ?array $deliveryInfo = null,
        ?string $notes = null
    ): RewardRedemption {
        $canRedeem = $this->canRedeem($user, $item);

        if (!$canRedeem['can_redeem']) {
            throw new \Exception($canRedeem['reason']);
        }

        return DB::transaction(function () use ($user, $item, $deliveryInfo, $notes) {
            // Descontar puntos
            $this->rewardService->spendPoints($user, $item->cost, 'spend', [
                'description' => "Canje: {$item->name}",
                'reference_type' => 'catalog_item',
                'reference_id' => $item->id,
            ]);

            // Reducir stock si no es ilimitado
            if ($item->stock !== -1) {
                $item->decrement('stock');
            }

            // Crear redención
            return RewardRedemption::create([
                'reward_user_id' => $user->id,
                'catalog_item_id' => $item->id,
                'points_spent' => $item->cost,
                'status' => 'pending',
                'notes' => $notes,
                'delivery_info' => $deliveryInfo,
            ]);
        });
    }

    /**
     * Obtiene las categorías disponibles.
     */
    public function getCategories(): array
    {
        return RewardCatalogItem::where('is_active', true)
            ->distinct()
            ->pluck('category')
            ->toArray();
    }
}
