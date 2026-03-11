<?php

declare(strict_types=1);

namespace App\Listeners\Rewards;

use App\Events\Rewards\BadgeEarned;
use App\Services\Rewards\RewardService;
use App\Services\Rewards\CacheService;
use App\Notifications\Rewards\BadgeEarnedNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

class HandleBadgeEarned implements ShouldQueue
{
    use InteractsWithQueue;

    public function __construct(
        protected RewardService $rewardService,
        protected CacheService $cacheService
    ) {}

    /**
     * Handle the event.
     */
    public function handle(BadgeEarned $event): void
    {
        $rewardUser = $event->rewardUser;
        $badge = $event->badge;

        // 1. Otorgar puntos del badge si los tiene configurados
        if ($badge->points_reward && $badge->points_reward > 0) {
            $this->rewardService->awardPoints(
                $rewardUser,
                $badge->points_reward,
                'badge_reward',
                [
                    'badge_id' => $badge->id,
                    'badge_name' => $badge->name,
                ]
            );
        }

        // 2. Otorgar XP del badge si lo tiene configurado
        if ($badge->xp_reward && $badge->xp_reward > 0) {
            $this->rewardService->awardExperience(
                $rewardUser,
                $badge->xp_reward,
                'badge_reward',
                [
                    'badge_id' => $badge->id,
                    'badge_name' => $badge->name,
                ]
            );
        }

        // 3. Invalidar caché del usuario
        $this->cacheService->invalidateUser($rewardUser->id);

        // 4. Enviar notificación si está habilitado
        if (config('gamification.notifications.badge_earned', true)) {
            $this->sendNotification($event);
        }

        \Log::info('Badge earned processed', [
            'user_id' => $event->getUserId(),
            'badge' => $badge->name,
            'rarity' => $badge->rarity,
        ]);
    }

    /**
     * Send notification to user
     */
    protected function sendNotification(BadgeEarned $event): void
    {
        try {
            $user = $event->rewardUser->user;
            
            if ($user) {
                $user->notify(new BadgeEarnedNotification($event->badge));
            }
        } catch (\Throwable $e) {
            \Log::warning('Failed to send badge notification', [
                'user_id' => $event->getUserId(),
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(BadgeEarned $event, \Throwable $exception): void
    {
        \Log::error('Failed to handle BadgeEarned event', [
            'user_id' => $event->getUserId(),
            'badge' => $event->getBadgeName(),
            'error' => $exception->getMessage(),
        ]);
    }
}
