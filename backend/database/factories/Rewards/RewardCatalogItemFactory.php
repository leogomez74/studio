<?php

declare(strict_types=1);

namespace Database\Factories\Rewards;

use App\Models\Rewards\RewardCatalogItem;
use Illuminate\Database\Eloquent\Factories\Factory;

class RewardCatalogItemFactory extends Factory
{
    protected $model = RewardCatalogItem::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->words(3, true),
            'slug' => $this->faker->unique()->slug(3),
            'description' => $this->faker->sentence(),
            'category' => $this->faker->randomElement(['digital', 'physical', 'experience', 'discount', 'general']),
            'points_cost' => $this->faker->numberBetween(100, 1000),
            'stock' => RewardCatalogItem::UNLIMITED_STOCK,
            'is_active' => true,
            'is_featured' => false,
            'sort_order' => 0,
        ];
    }

    public function withCost(int $cost): static
    {
        return $this->state(fn () => [
            'points_cost' => $cost,
        ]);
    }

    public function withStock(int $stock): static
    {
        return $this->state(fn () => [
            'stock' => $stock,
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn () => [
            'is_active' => false,
        ]);
    }

    public function featured(): static
    {
        return $this->state(fn () => [
            'is_featured' => true,
        ]);
    }

    public function withRequirements(array $requirements): static
    {
        return $this->state(fn () => [
            'requirements' => $requirements,
        ]);
    }
}
