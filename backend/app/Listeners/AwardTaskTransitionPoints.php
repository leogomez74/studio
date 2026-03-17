<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\TaskStatusChanged;
use App\Models\Rewards\RewardUser;
use App\Services\Rewards\RewardService;
use App\Services\Rewards\StreakService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;

class AwardTaskTransitionPoints implements ShouldQueue
{
    public function __construct(
        private RewardService $rewardService,
        private StreakService $streakService,
    ) {}

    public function handle(TaskStatusChanged $event): void
    {
        try {
            $transition = $event->transition;
            if (!$transition) return;

            $rewardUser = RewardUser::findOrCreateForUser($event->user->id);

            // Award transition points
            if ($transition->points_award > 0) {
                $this->rewardService->awardPoints($rewardUser, $transition->points_award, 'earn', [
                    'description' => "Transición de tarea: {$transition->name} ({$event->task->reference})",
                    'reference_type' => 'task_transition',
                    'reference_id' => $event->task->id,
                    'metadata' => [
                        'task_id' => $event->task->id,
                        'from_status' => $event->fromStatus->name,
                        'to_status' => $event->toStatus->name,
                        'transition_name' => $transition->name,
                    ],
                ]);
            }

            // Award transition XP
            if ($transition->xp_award > 0) {
                $this->rewardService->addExperience($rewardUser, $transition->xp_award, 'task_transition');
            }

            // Record activity for streak
            $this->streakService->recordActivity($rewardUser);

        } catch (\Throwable $e) {
            Log::error('AwardTaskTransitionPoints failed: ' . $e->getMessage(), [
                'task_id' => $event->task->id,
                'user_id' => $event->user->id,
            ]);
        }
    }
}
