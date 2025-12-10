<?php

declare(strict_types=1);

namespace App\Services\Rewards;

use App\Models\Rewards\RewardUser;
use App\Models\Rewards\RewardRedemption;
use Illuminate\Support\Facades\DB;

class RedemptionService
{
    /**
     * Obtiene las redenciones del usuario.
     */
    public function getUserRedemptions(RewardUser $user, ?string $status = null): array
    {
        $query = RewardRedemption::where('reward_user_id', $user->id)
            ->with('catalogItem');

        if ($status) {
            $query->where('status', $status);
        }

        return $query->orderByDesc('created_at')
            ->get()
            ->map(fn ($redemption) => [
                'id' => $redemption->id,
                'item' => [
                    'id' => $redemption->catalogItem->id,
                    'name' => $redemption->catalogItem->name,
                    'image_url' => $redemption->catalogItem->image_url,
                    'category' => $redemption->catalogItem->category,
                ],
                'points_spent' => $redemption->points_spent,
                'status' => $redemption->status,
                'notes' => $redemption->notes,
                'created_at' => $redemption->created_at->toIso8601String(),
                'approved_at' => $redemption->approved_at?->toIso8601String(),
                'delivered_at' => $redemption->delivered_at?->toIso8601String(),
            ])
            ->toArray();
    }

    /**
     * Obtiene todas las redenciones (admin).
     */
    public function getAllRedemptions(?string $status = null, int $limit = 50): array
    {
        $query = RewardRedemption::with(['rewardUser.user', 'catalogItem']);

        if ($status) {
            $query->where('status', $status);
        }

        return $query->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn ($redemption) => [
                'id' => $redemption->id,
                'user' => [
                    'id' => $redemption->rewardUser->user->id,
                    'name' => $redemption->rewardUser->user->name,
                    'email' => $redemption->rewardUser->user->email,
                ],
                'item' => [
                    'id' => $redemption->catalogItem->id,
                    'name' => $redemption->catalogItem->name,
                    'category' => $redemption->catalogItem->category,
                ],
                'points_spent' => $redemption->points_spent,
                'status' => $redemption->status,
                'notes' => $redemption->notes,
                'delivery_info' => $redemption->delivery_info,
                'created_at' => $redemption->created_at->toIso8601String(),
                'approved_at' => $redemption->approved_at?->toIso8601String(),
                'approved_by' => $redemption->approvedBy?->name,
                'delivered_at' => $redemption->delivered_at?->toIso8601String(),
            ])
            ->toArray();
    }

    /**
     * Aprueba una redención.
     */
    public function approve(RewardRedemption $redemption, int $approvedById): RewardRedemption
    {
        if ($redemption->status !== 'pending') {
            throw new \Exception('Solo se pueden aprobar redenciones pendientes.');
        }

        $redemption->update([
            'status' => 'approved',
            'approved_by' => $approvedById,
            'approved_at' => now(),
        ]);

        return $redemption->fresh();
    }

    /**
     * Rechaza una redención y devuelve los puntos.
     */
    public function reject(RewardRedemption $redemption, int $rejectedById, ?string $reason = null): RewardRedemption
    {
        if ($redemption->status !== 'pending') {
            throw new \Exception('Solo se pueden rechazar redenciones pendientes.');
        }

        return DB::transaction(function () use ($redemption, $rejectedById, $reason) {
            // Devolver puntos
            $user = $redemption->rewardUser;
            $user->increment('total_points', $redemption->points_spent);

            // Devolver stock si aplica
            $item = $redemption->catalogItem;
            if ($item->stock !== -1) {
                $item->increment('stock');
            }

            $redemption->update([
                'status' => 'rejected',
                'approved_by' => $rejectedById,
                'approved_at' => now(),
                'notes' => $reason ? ($redemption->notes . "\nRazón de rechazo: " . $reason) : $redemption->notes,
            ]);

            return $redemption->fresh();
        });
    }

    /**
     * Marca una redención como entregada.
     */
    public function markAsDelivered(RewardRedemption $redemption): RewardRedemption
    {
        if ($redemption->status !== 'approved') {
            throw new \Exception('Solo se pueden marcar como entregadas las redenciones aprobadas.');
        }

        $redemption->update([
            'status' => 'delivered',
            'delivered_at' => now(),
        ]);

        return $redemption->fresh();
    }

    /**
     * Cancela una redención.
     */
    public function cancel(RewardRedemption $redemption): RewardRedemption
    {
        if (!in_array($redemption->status, ['pending', 'approved'])) {
            throw new \Exception('Solo se pueden cancelar redenciones pendientes o aprobadas.');
        }

        return DB::transaction(function () use ($redemption) {
            // Devolver puntos
            $user = $redemption->rewardUser;
            $user->increment('total_points', $redemption->points_spent);

            // Devolver stock si aplica
            $item = $redemption->catalogItem;
            if ($item->stock !== -1) {
                $item->increment('stock');
            }

            $redemption->update([
                'status' => 'cancelled',
            ]);

            return $redemption->fresh();
        });
    }
}
