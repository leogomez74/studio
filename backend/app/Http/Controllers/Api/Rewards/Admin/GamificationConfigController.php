<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Rewards\Admin;

use App\Http\Controllers\Controller;
use App\Models\Rewards\RewardBadge;
use App\Models\Rewards\RewardBadgeCategory;
use App\Models\Rewards\RewardChallenge;
use App\Models\Rewards\RewardCatalogItem;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class GamificationConfigController extends Controller
{
    use LogsActivity;

    // ─── Config General ─────────────────────────────────────────────

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
                        ->where('starts_at', '<=', now())
                        ->where('ends_at', '>=', now())
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
                'actions' => config('gamification.actions', []),
                'streaks' => config('gamification.streaks', []),
                'points' => config('gamification.points', []),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'levels_config.base_xp' => 'nullable|integer|min:1',
            'levels_config.multiplier' => 'nullable|numeric|min:1',
        ]);

        $this->logActivity('update', 'Rewards - Configuración', null, 'Gamificación', [
            ['field' => 'config', 'old_value' => null, 'new_value' => $validated],
        ], $request);

        return response()->json([
            'success' => true,
            'message' => 'Configuración actualizada correctamente.',
        ]);
    }

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

    // ─── Catalog Items CRUD ─────────────────────────────────────────

    public function catalogIndex(Request $request): JsonResponse
    {
        $query = RewardCatalogItem::query()->ordered();

        if ($category = $request->input('category')) {
            $query->inCategory($category);
        }

        $items = $query->get();

        return response()->json([
            'success' => true,
            'data' => $items,
        ]);
    }

    public function catalogStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'category' => 'required|string|in:digital,physical,experience,discount,general',
            'points_cost' => 'required|integer|min:0',
            'stock' => 'nullable|integer|min:-1',
            'max_per_user' => 'nullable|integer|min:1',
            'icon' => 'nullable|string|max:255',
            'image_url' => 'nullable|string|max:255',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
            'available_from' => 'nullable|date',
            'available_until' => 'nullable|date|after_or_equal:available_from',
        ]);

        $validated['slug'] = Str::slug($validated['name']) . '-' . Str::random(4);
        $validated['stock'] = $validated['stock'] ?? -1;

        $item = RewardCatalogItem::create($validated);

        $this->logActivity('create', 'Rewards - Catálogo', $item, $item->name, [
            ['field' => 'name', 'old_value' => null, 'new_value' => $item->name],
            ['field' => 'points_cost', 'old_value' => null, 'new_value' => $item->points_cost],
        ], $request);

        return response()->json([
            'success' => true,
            'message' => 'Item creado exitosamente.',
            'data' => $item,
        ], 201);
    }

    public function catalogUpdate(Request $request, int $id): JsonResponse
    {
        $item = RewardCatalogItem::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'category' => 'sometimes|string|in:digital,physical,experience,discount,general',
            'points_cost' => 'sometimes|integer|min:0',
            'stock' => 'nullable|integer|min:-1',
            'max_per_user' => 'nullable|integer|min:1',
            'icon' => 'nullable|string|max:255',
            'image_url' => 'nullable|string|max:255',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
            'available_from' => 'nullable|date',
            'available_until' => 'nullable|date',
        ]);

        $old = $item->toArray();
        $item->update($validated);

        $this->logActivity('update', 'Rewards - Catálogo', $item, $item->name, [
            ['field' => 'changes', 'old_value' => $old, 'new_value' => $validated],
        ], $request);

        return response()->json([
            'success' => true,
            'message' => 'Item actualizado exitosamente.',
            'data' => $item->fresh(),
        ]);
    }

    public function catalogDestroy(int $id): JsonResponse
    {
        $item = RewardCatalogItem::findOrFail($id);

        if ($item->redemptions()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'No se puede eliminar un item con redenciones asociadas. Desactívelo en su lugar.',
            ], 422);
        }

        $item->delete();

        return response()->json([
            'success' => true,
            'message' => 'Item eliminado exitosamente.',
        ]);
    }

    // ─── Badges CRUD ────────────────────────────────────────────────

    public function badgeIndex(Request $request): JsonResponse
    {
        $query = RewardBadge::with('category')->ordered();

        if ($rarity = $request->input('rarity')) {
            $query->byRarity($rarity);
        }

        $badges = $query->get();

        return response()->json([
            'success' => true,
            'data' => $badges,
        ]);
    }

    public function badgeStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'icon' => 'nullable|string|max:255',
            'image_url' => 'nullable|string|max:255',
            'category_id' => 'nullable|integer|exists:reward_badge_categories,id',
            'rarity' => 'required|string|in:common,uncommon,rare,epic,legendary',
            'criteria_type' => 'nullable|string|max:255',
            'criteria_config' => 'nullable|array',
            'points_reward' => 'integer|min:0',
            'xp_reward' => 'integer|min:0',
            'is_secret' => 'boolean',
            'is_active' => 'boolean',
        ]);

        $validated['slug'] = Str::slug($validated['name']) . '-' . Str::random(4);
        $validated['criteria_type'] = $validated['criteria_type'] ?? 'manual';
        $validated['icon'] = $validated['icon'] ?? 'award';

        $badge = RewardBadge::create($validated);

        $this->logActivity('create', 'Rewards - Badge', $badge, $badge->name, [
            ['field' => 'name', 'old_value' => null, 'new_value' => $badge->name],
            ['field' => 'rarity', 'old_value' => null, 'new_value' => $badge->rarity],
        ], $request);

        return response()->json([
            'success' => true,
            'message' => 'Badge creado exitosamente.',
            'data' => $badge->load('category'),
        ], 201);
    }

    public function badgeUpdate(Request $request, int $id): JsonResponse
    {
        $badge = RewardBadge::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'icon' => 'nullable|string|max:255',
            'image_url' => 'nullable|string|max:255',
            'category_id' => 'nullable|integer|exists:reward_badge_categories,id',
            'rarity' => 'sometimes|string|in:common,uncommon,rare,epic,legendary',
            'criteria_type' => 'nullable|string|max:255',
            'criteria_config' => 'nullable|array',
            'points_reward' => 'integer|min:0',
            'xp_reward' => 'integer|min:0',
            'is_secret' => 'boolean',
            'is_active' => 'boolean',
        ]);

        $old = $badge->toArray();
        $badge->update($validated);

        $this->logActivity('update', 'Rewards - Badge', $badge, $badge->name, [
            ['field' => 'changes', 'old_value' => $old, 'new_value' => $validated],
        ], $request);

        return response()->json([
            'success' => true,
            'message' => 'Badge actualizado exitosamente.',
            'data' => $badge->fresh()->load('category'),
        ]);
    }

    public function badgeDestroy(int $id): JsonResponse
    {
        $badge = RewardBadge::findOrFail($id);

        if ($badge->userBadges()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'No se puede eliminar un badge que ya fue otorgado. Desactívelo en su lugar.',
            ], 422);
        }

        $badge->delete();

        return response()->json([
            'success' => true,
            'message' => 'Badge eliminado exitosamente.',
        ]);
    }

    // ─── Challenges CRUD ────────────────────────────────────────────

    public function challengeIndex(Request $request): JsonResponse
    {
        $query = RewardChallenge::withCount('participations');

        if ($type = $request->input('type')) {
            $query->ofType($type);
        }

        $challenges = $query->orderByDesc('created_at')->get();

        return response()->json([
            'success' => true,
            'data' => $challenges,
        ]);
    }

    public function challengeStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'type' => 'required|string|in:daily,weekly,monthly,special,individual,team',
            'difficulty' => 'nullable|string|in:easy,medium,hard,expert',
            'icon' => 'nullable|string|max:255',
            'image_url' => 'nullable|string|max:255',
            'objectives' => 'required|array|min:1',
            'objectives.*.key' => 'required|string',
            'objectives.*.name' => 'required|string',
            'objectives.*.target' => 'required|integer|min:1',
            'objectives.*.type' => 'nullable|string',
            'points_reward' => 'integer|min:0',
            'xp_reward' => 'integer|min:0',
            'badge_reward_id' => 'nullable|integer|exists:reward_badges,id',
            'max_participants' => 'nullable|integer|min:1',
            'starts_at' => 'required|date',
            'ends_at' => 'required|date|after:starts_at',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
        ]);

        $validated['slug'] = Str::slug($validated['name']) . '-' . Str::random(4);
        $validated['difficulty'] = $validated['difficulty'] ?? 'medium';

        $challenge = RewardChallenge::create($validated);

        $this->logActivity('create', 'Rewards - Challenge', $challenge, $challenge->name, [
            ['field' => 'name', 'old_value' => null, 'new_value' => $challenge->name],
            ['field' => 'type', 'old_value' => null, 'new_value' => $challenge->type],
        ], $request);

        return response()->json([
            'success' => true,
            'message' => 'Challenge creado exitosamente.',
            'data' => $challenge,
        ], 201);
    }

    public function challengeUpdate(Request $request, int $id): JsonResponse
    {
        $challenge = RewardChallenge::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'type' => 'sometimes|string|in:daily,weekly,monthly,special,individual,team',
            'difficulty' => 'nullable|string|in:easy,medium,hard,expert',
            'icon' => 'nullable|string|max:255',
            'image_url' => 'nullable|string|max:255',
            'objectives' => 'sometimes|array|min:1',
            'points_reward' => 'integer|min:0',
            'xp_reward' => 'integer|min:0',
            'badge_reward_id' => 'nullable|integer|exists:reward_badges,id',
            'max_participants' => 'nullable|integer|min:1',
            'starts_at' => 'sometimes|date',
            'ends_at' => 'sometimes|date',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
        ]);

        $old = $challenge->toArray();
        $challenge->update($validated);

        $this->logActivity('update', 'Rewards - Challenge', $challenge, $challenge->name, [
            ['field' => 'changes', 'old_value' => $old, 'new_value' => $validated],
        ], $request);

        return response()->json([
            'success' => true,
            'message' => 'Challenge actualizado exitosamente.',
            'data' => $challenge->fresh(),
        ]);
    }

    public function challengeDestroy(int $id): JsonResponse
    {
        $challenge = RewardChallenge::findOrFail($id);

        if ($challenge->participations()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'No se puede eliminar un challenge con participantes. Desactívelo en su lugar.',
            ], 422);
        }

        $challenge->delete();

        return response()->json([
            'success' => true,
            'message' => 'Challenge eliminado exitosamente.',
        ]);
    }
}
