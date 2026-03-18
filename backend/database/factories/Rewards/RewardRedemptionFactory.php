<?php

declare(strict_types=1);

namespace Database\Factories\Rewards;

use App\Models\Rewards\RewardRedemption;
use App\Models\Rewards\RewardUser;
use App\Models\Rewards\RewardCatalogItem;
use Illuminate\Database\Eloquent\Factories\Factory;

class RewardRedemptionFactory extends Factory
{
    protected $model = RewardRedemption::class;

    public function definition(): array
    {
        return [
            'reward_user_id' => RewardUser::factory(),
            'catalog_item_id' => RewardCatalogItem::factory(),
            'points_spent' => $this->faker->numberBetween(100, 1000),
            'status' => RewardRedemption::STATUS_PENDING,
        ];
    }

    public function pending(): static
    {
        return $this->state(fn () => ['status' => RewardRedemption::STATUS_PENDING]);
    }

    public function approved(): static
    {
        return $this->state(fn () => [
            'status' => RewardRedemption::STATUS_APPROVED,
            'approved_at' => now(),
        ]);
    }

    public function rejected(): static
    {
        return $this->state(fn () => [
            'status' => RewardRedemption::STATUS_REJECTED,
            'approved_at' => now(),
        ]);
    }

    public function delivered(): static
    {
        return $this->state(fn () => [
            'status' => RewardRedemption::STATUS_DELIVERED,
            'approved_at' => now(),
            'delivered_at' => now(),
        ]);
    }

    public function cancelled(): static
    {
        return $this->state(fn () => ['status' => RewardRedemption::STATUS_CANCELLED]);
    }
}
