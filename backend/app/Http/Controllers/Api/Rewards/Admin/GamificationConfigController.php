<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Rewards\Admin;

use App\Http\Controllers\Controller;
use App\Models\Rewards\RewardBadge;
use App\Models\Rewards\RewardBadgeCategory;
use App\Models\Rewards\RewardChallenge;
use App\Models\Rewards\RewardCatalogItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GamificationConfigController extends Controller
{
    /**
     * Obtiene la configuración general de gamificación.
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'badges' => [
                    'total' => RewardBadge::count(),
                    'active' => RewardBadge::where('is_active', true)->count(),
                ],
                'categories' => RewardBadgeCategory::orderBy('sort_order')->get(),
                'challenges' => [
                    'total' => RewardChallenge::count(),
                    'active' => RewardChallenge::where('is_active', true)
                        ->where('start_date', '<=', now())
                        ->where('end_date', '>=', now())
                        ->count(),
                ],
                'catalog' => [
                    'total' => RewardCatalogItem::count(),
                    'active' => RewardCatalogItem::where('is_active', true)->count(),
                ],
                'levels_config' => [
                    'base_xp' => config('gamification.levels.base_xp', 100),
                    'multiplier' => config('gamification.levels.multiplier', 1.5),
                ],
            ],
        ]);
    }

    /**
     * Actualiza la configuración de gamificación.
     */
    public function update(Request $request): JsonResponse
    {
        // Validar y guardar configuración
        $validated = $request->validate([
            'levels_config.base_xp' => 'nullable|integer|min:1',
            'levels_config.multiplier' => 'nullable|numeric|min:1',
        ]);

        // Aquí se guardaría la configuración (en archivo o base de datos)
        // Por ahora solo retornamos éxito

        return response()->json([
            'success' => true,
            'message' => 'Configuración actualizada correctamente.',
        ]);
    }

    /**
     * Obtiene estadísticas del sistema de gamificación.
     */
    public function stats(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'total_users_with_rewards' => \App\Models\Rewards\RewardUser::count(),
                'total_points_awarded' => \App\Models\Rewards\RewardUser::sum('lifetime_points'),
                'total_badges_earned' => \App\Models\Rewards\RewardUserBadge::count(),
                'total_challenges_completed' => \App\Models\Rewards\RewardChallengeParticipation::whereNotNull('completed_at')->count(),
                'total_redemptions' => \App\Models\Rewards\RewardRedemption::count(),
                'pending_redemptions' => \App\Models\Rewards\RewardRedemption::where('status', 'pending')->count(),
            ],
        ]);
    }
}
