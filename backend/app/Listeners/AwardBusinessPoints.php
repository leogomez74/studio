<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\BusinessActionPerformed;
use App\Models\Rewards\RewardUser;
use App\Services\Rewards\Badges\BadgeService;
use App\Services\Rewards\RewardService;
use App\Services\Rewards\StreakService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;

class AwardBusinessPoints implements ShouldQueue
{
    public function __construct(
        private RewardService $rewardService,
        private StreakService $streakService,
        private BadgeService $badgeService,
    ) {}

    public function handle(BusinessActionPerformed $event): void
    {
        if (!config('gamification.enabled', false)) {
            return;
        }

        $actionConfig = config("gamification.actions.{$event->action}");

        if (!$actionConfig) {
            Log::warning("Gamification: acción no configurada '{$event->action}'");
            return;
        }

        try {
            $rewardUser = RewardUser::findOrCreateForUser($event->user->id);

            $points = (int) ($actionConfig['points'] ?? 0);
            $xp = (int) ($actionConfig['xp'] ?? 0);
            $description = $actionConfig['description'] ?? $event->action;

            $referenceType = str_replace('_', '-', $event->action);
            $referenceId = $event->model?->getKey();

            // Otorgar puntos
            if ($points > 0) {
                $this->rewardService->awardPoints($rewardUser, $points, 'earn', [
                    'description' => $description,
                    'reference_type' => $referenceType,
                    'reference_id' => $referenceId,
                    'metadata' => array_merge([
                        'action' => $event->action,
                    ], $event->metadata),
                ]);
            }

            // Otorgar XP
            if ($xp > 0) {
                $this->rewardService->addExperience($rewardUser, $xp, $event->action);
            }

            // Registrar actividad para racha
            $this->streakService->recordActivity($rewardUser);

            // Verificar badges
            $this->badgeService->checkAndAwardBadges($rewardUser, 'task_completed', [
                'action' => $event->action,
                'model_type' => $event->model ? get_class($event->model) : null,
                'model_id' => $referenceId,
            ]);

        } catch (\Throwable $e) {
            Log::error("AwardBusinessPoints failed for action '{$event->action}': " . $e->getMessage(), [
                'action' => $event->action,
                'user_id' => $event->user->id,
                'model' => $event->model ? get_class($event->model) . '#' . $event->model->getKey() : null,
            ]);
        }
    }
}
