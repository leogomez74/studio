<?php

declare(strict_types=1);

namespace Database\Factories\Rewards;

use App\Models\Rewards\RewardUser;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class RewardUserFactory extends Factory
{
    protected $model = RewardUser::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'level' => 1,
            'experience_points' => 0,
            'total_points' => $this->faker->numberBetween(0, 5000),
            'lifetime_points' => $this->faker->numberBetween(0, 10000),
            'current_streak' => 0,
            'longest_streak' => 0,
        ];
    }

    public function withPoints(int $points): static
    {
        return $this->state(fn () => [
            'total_points' => $points,
            'lifetime_points' => $points,
        ]);
    }

    public function withLevel(int $level): static
    {
        return $this->state(fn () => [
            'level' => $level,
        ]);
    }
}
