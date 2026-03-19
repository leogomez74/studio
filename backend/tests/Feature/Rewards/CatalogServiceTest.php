<?php

declare(strict_types=1);

namespace Tests\Feature\Rewards;

use App\Exceptions\Rewards\RedemptionException;
use App\Models\Rewards\RewardCatalogItem;
use App\Models\Rewards\RewardUser;
use App\Services\Rewards\CatalogService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CatalogServiceTest extends TestCase
{
    use RefreshDatabase;

    private CatalogService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(CatalogService::class);
    }

    // ── canRedeem ────────────────────────────────────────────────────

    public function test_can_redeem_with_sufficient_points(): void
    {
        $user = RewardUser::factory()->withPoints(500)->create();
        $item = RewardCatalogItem::factory()->withCost(200)->create();

        $result = $this->service->canRedeem($user, $item);

        $this->assertTrue($result['can_redeem']);
    }

    public function test_cannot_redeem_with_insufficient_points(): void
    {
        $user = RewardUser::factory()->withPoints(100)->create();
        $item = RewardCatalogItem::factory()->withCost(500)->create();

        $result = $this->service->canRedeem($user, $item);

        $this->assertFalse($result['can_redeem']);
        $this->assertStringContainsString('puntos', $result['reason']);
    }

    public function test_cannot_redeem_inactive_item(): void
    {
        $user = RewardUser::factory()->withPoints(1000)->create();
        $item = RewardCatalogItem::factory()->withCost(100)->inactive()->create();

        $result = $this->service->canRedeem($user, $item);

        $this->assertFalse($result['can_redeem']);
        $this->assertStringContainsString('no está disponible', $result['reason']);
    }

    public function test_cannot_redeem_out_of_stock(): void
    {
        $user = RewardUser::factory()->withPoints(1000)->create();
        $item = RewardCatalogItem::factory()->withCost(100)->withStock(0)->create();

        $result = $this->service->canRedeem($user, $item);

        $this->assertFalse($result['can_redeem']);
        $this->assertStringContainsString('agotado', $result['reason']);
    }

    public function test_can_redeem_unlimited_stock(): void
    {
        $user = RewardUser::factory()->withPoints(1000)->create();
        $item = RewardCatalogItem::factory()->withCost(100)->create([
            'stock' => RewardCatalogItem::UNLIMITED_STOCK,
        ]);

        $result = $this->service->canRedeem($user, $item);

        $this->assertTrue($result['can_redeem']);
    }

    public function test_cannot_redeem_below_required_level(): void
    {
        $user = RewardUser::factory()->withPoints(1000)->withLevel(2)->create();
        $item = RewardCatalogItem::factory()
            ->withCost(100)
            ->withRequirements(['min_level' => 5])
            ->create();

        $result = $this->service->canRedeem($user, $item);

        $this->assertFalse($result['can_redeem']);
        $this->assertStringContainsString('nivel', $result['reason']);
    }

    public function test_cannot_redeem_future_available_item(): void
    {
        $user = RewardUser::factory()->withPoints(1000)->create();
        $item = RewardCatalogItem::factory()->withCost(100)->create([
            'available_from' => now()->addDays(7),
        ]);

        $result = $this->service->canRedeem($user, $item);

        $this->assertFalse($result['can_redeem']);
        $this->assertStringContainsString('aún no está disponible', $result['reason']);
    }

    public function test_cannot_redeem_expired_item(): void
    {
        $user = RewardUser::factory()->withPoints(1000)->create();
        $item = RewardCatalogItem::factory()->withCost(100)->create([
            'available_until' => now()->subDays(1),
        ]);

        $result = $this->service->canRedeem($user, $item);

        $this->assertFalse($result['can_redeem']);
        $this->assertStringContainsString('ya no está disponible', $result['reason']);
    }

    // ── getAvailableItems ────────────────────────────────────────────

    public function test_get_available_items_excludes_inactive(): void
    {
        $user = RewardUser::factory()->withPoints(1000)->create();

        RewardCatalogItem::factory()->withCost(100)->create();
        RewardCatalogItem::factory()->withCost(200)->inactive()->create();

        $items = $this->service->getAvailableItems($user);

        $this->assertCount(1, $items);
    }

    public function test_get_available_items_excludes_out_of_stock(): void
    {
        $user = RewardUser::factory()->withPoints(1000)->create();

        RewardCatalogItem::factory()->withCost(100)->create();
        RewardCatalogItem::factory()->withCost(200)->withStock(0)->create();

        $items = $this->service->getAvailableItems($user);

        $this->assertCount(1, $items);
    }

    public function test_get_available_items_includes_unlimited_stock(): void
    {
        $user = RewardUser::factory()->withPoints(1000)->create();

        RewardCatalogItem::factory()->withCost(100)->create([
            'stock' => RewardCatalogItem::UNLIMITED_STOCK,
        ]);

        $items = $this->service->getAvailableItems($user);

        $this->assertCount(1, $items);
    }

    public function test_get_available_items_filters_by_category(): void
    {
        $user = RewardUser::factory()->withPoints(1000)->create();

        RewardCatalogItem::factory()->withCost(100)->create(['category' => 'digital']);
        RewardCatalogItem::factory()->withCost(200)->create(['category' => 'physical']);

        $digital = $this->service->getAvailableItems($user, 'digital');
        $this->assertCount(1, $digital);
        $this->assertEquals('digital', $digital[0]['category']);
    }

    public function test_get_available_items_returns_correct_format(): void
    {
        $user = RewardUser::factory()->withPoints(1000)->create();
        RewardCatalogItem::factory()->withCost(100)->create();

        $items = $this->service->getAvailableItems($user);

        $this->assertCount(1, $items);
        $item = $items[0];
        $this->assertArrayHasKey('id', $item);
        $this->assertArrayHasKey('name', $item);
        $this->assertArrayHasKey('points_cost', $item);
        $this->assertArrayHasKey('can_redeem', $item);
        $this->assertArrayHasKey('is_featured', $item);
        $this->assertArrayHasKey('requirements', $item);
        $this->assertTrue($item['can_redeem']);
    }

    public function test_get_available_items_sorted_by_cost(): void
    {
        $user = RewardUser::factory()->withPoints(1000)->create();

        RewardCatalogItem::factory()->withCost(500)->create();
        RewardCatalogItem::factory()->withCost(100)->create();
        RewardCatalogItem::factory()->withCost(300)->create();

        $items = $this->service->getAvailableItems($user);

        $this->assertEquals(100, $items[0]['points_cost']);
        $this->assertEquals(300, $items[1]['points_cost']);
        $this->assertEquals(500, $items[2]['points_cost']);
    }

    // ── getCategories ────────────────────────────────────────────────

    public function test_get_categories_returns_active_only(): void
    {
        RewardCatalogItem::factory()->create(['category' => 'digital', 'is_active' => true]);
        RewardCatalogItem::factory()->create(['category' => 'physical', 'is_active' => true]);
        RewardCatalogItem::factory()->create(['category' => 'experience', 'is_active' => false]);

        $categories = $this->service->getCategories();

        $this->assertCount(2, $categories);
        $this->assertContains('digital', $categories);
        $this->assertContains('physical', $categories);
        $this->assertNotContains('experience', $categories);
    }
}
