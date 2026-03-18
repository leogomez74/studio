<?php

declare(strict_types=1);

namespace App\Listeners\Rewards;

use App\Events\Rewards\PointsEarned;
use App\Services\Rewards\Badges\BadgeService;
use App\Services\Rewards\StreakService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

class HandlePointsEarned implements ShouldQueue
{
    use InteractsWithQueue;

    public function __construct(
        protected BadgeService $badgeService,
        protected StreakService $streakService
    ) {}

    /**
     * Handle the event.
     */
    public function handle(PointsEarned $event): void
    {
        $rewardUser = $event->rewardUser;
        
        // 1. Verificar y otorgar badges relacionados con puntos
        $this->badgeService->checkAndAwardBadges(
            $rewardUser,
            'points_earned',
            [
                'amount' => $event->getAmount(),
                'type' => $event->getType(),
                'total_points' => $event->getTotalPoints(),
                'lifetime_points' => $event->getLifetimePoints(),
                ...$event->context,
            ]
        );

        // 2. Actualizar streak del usuario
        $this->streakService->updateStreak($rewardUser);

        // 3. Verificar badges de nivel alcanzado
        $this->badgeService->checkAndAwardBadges(
            $rewardUser,
            'level_check',
            ['current_level' => $rewardUser->level]
        );
    }

    /**
     * Handle a job failure.
     */
    public function failed(PointsEarned $event, \Throwable $exception): void
    {
        \Log::error('Failed to handle PointsEarned event', [
            'user_id' => $event->getUserId(),
            'amount' => $event->getAmount(),
            'error' => $exception->getMessage(),
        ]);
    }
}
