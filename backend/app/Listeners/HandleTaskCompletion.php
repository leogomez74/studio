<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\TaskCompleted;
use App\Models\Rewards\RewardUser;
use App\Services\Rewards\Badges\BadgeService;
use App\Services\Rewards\RewardService;
use App\Services\Rewards\StreakService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;

class HandleTaskCompletion implements ShouldQueue
{
    public function __construct(
        private RewardService $rewardService,
        private StreakService $streakService,
        private BadgeService $badgeService,
    ) {}

    public function handle(TaskCompleted $event): void
    {
        try {
            $task = $event->task;
            $rewardUser = RewardUser::findOrCreateForUser($event->user->id);

            $config = config('gamification.tasks', []);
            $basePoints = $config['base_completion_points'] ?? 50;
            $baseXp = $config['base_completion_xp'] ?? 25;
            $onTimeBonusPoints = $config['on_time_bonus_points'] ?? 20;
            $onTimeBonusXp = $config['on_time_bonus_xp'] ?? 10;

            // Check if completed on time
            $onTime = $task->due_date && $task->completed_at && $task->completed_at->lte($task->due_date);

            $totalPoints = $basePoints + ($onTime ? $onTimeBonusPoints : 0);
            $totalXp = $baseXp + ($onTime ? $onTimeBonusXp : 0);

            // Award base completion points
            $this->rewardService->awardPoints($rewardUser, $totalPoints, 'earn', [
                'description' => "Tarea completada: {$task->reference}" . ($onTime ? ' (a tiempo)' : ''),
                'reference_type' => 'task',
                'reference_id' => $task->id,
                'metadata' => [
                    'task_id' => $task->id,
                    'task_reference' => $task->reference,
                    'on_time' => $onTime,
                ],
            ]);

            // Award XP
            $this->rewardService->addExperience($rewardUser, $totalXp, 'task_completed');

            // Record activity for streak
            $this->streakService->recordActivity($rewardUser);

            // Check and award badges for 'task_completed' event
            $this->badgeService->checkAndAwardBadges($rewardUser, 'task_completed', [
                'task_id' => $task->id,
            ]);

        } catch (\Throwable $e) {
            Log::error('HandleTaskCompletion failed: ' . $e->getMessage(), [
                'task_id' => $event->task->id,
                'user_id' => $event->user->id,
            ]);
        }
    }
}
