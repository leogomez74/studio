<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Event;

// Rewards Events
use App\Events\Rewards\PointsEarned;
use App\Events\Rewards\BadgeEarned;
use App\Events\Rewards\LevelUp;
use App\Events\Rewards\ChallengeCompleted;
use App\Events\Rewards\StreakUpdated;
use App\Events\Rewards\RewardRedeemed;

// Task Events
use App\Events\TaskStatusChanged;
use App\Events\TaskCompleted;

// Rewards Listeners
use App\Listeners\Rewards\HandlePointsEarned;
use App\Listeners\Rewards\HandleBadgeEarned;
use App\Listeners\Rewards\HandleLevelUp;
use App\Listeners\Rewards\HandleChallengeCompleted;
use App\Listeners\Rewards\HandleStreakUpdated;
use App\Listeners\Rewards\HandleRewardRedeemed;

// Task Listeners
use App\Listeners\AwardTaskTransitionPoints;
use App\Listeners\HandleTaskCompletion;
use App\Listeners\NotifyTaskStatusChanged;

class EventServiceProvider extends ServiceProvider
{
    /**
     * The event to listener mappings for the application.
     *
     * @var array<class-string, array<int, class-string>>
     */
    protected $listen = [
        // Gamification Events
        PointsEarned::class => [
            HandlePointsEarned::class,
        ],
        BadgeEarned::class => [
            HandleBadgeEarned::class,
        ],
        LevelUp::class => [
            HandleLevelUp::class,
        ],
        ChallengeCompleted::class => [
            HandleChallengeCompleted::class,
        ],
        StreakUpdated::class => [
            HandleStreakUpdated::class,
        ],
        RewardRedeemed::class => [
            HandleRewardRedeemed::class,
        ],

        // Task Events
        TaskStatusChanged::class => [
            AwardTaskTransitionPoints::class,
            NotifyTaskStatusChanged::class,
        ],
        TaskCompleted::class => [
            HandleTaskCompletion::class,
        ],
    ];

    public function boot(): void
    {
        //
    }

    public function shouldDiscoverEvents(): bool
    {
        return false;
    }
}
