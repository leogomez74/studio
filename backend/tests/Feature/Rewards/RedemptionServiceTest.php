<?php

declare(strict_types=1);

namespace Tests\Feature\Rewards;

use App\Exceptions\Rewards\RedemptionException;
use App\Models\Rewards\RewardCatalogItem;
use App\Models\Rewards\RewardRedemption;
use App\Models\Rewards\RewardUser;
use App\Models\User;
use App\Services\Rewards\RedemptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RedemptionServiceTest extends TestCase
{
    use RefreshDatabase;

    private RedemptionService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(RedemptionService::class);
    }

    // ── Approve ──────────────────────────────────────────────────────

    public function test_approve_pending_redemption(): void
    {
        $admin = User::factory()->create();
        $redemption = RewardRedemption::factory()->pending()->create();

        $result = $this->service->approve($redemption, $admin->id);

        $this->assertEquals(RewardRedemption::STATUS_APPROVED, $result->status);
        $this->assertEquals($admin->id, $result->approved_by);
        $this->assertNotNull($result->approved_at);
    }

    public function test_approve_non_pending_throws_exception(): void
    {
        $admin = User::factory()->create();
        $redemption = RewardRedemption::factory()->approved()->create();

        $this->expectException(RedemptionException::class);
        $this->service->approve($redemption, $admin->id);
    }

    // ── Reject ───────────────────────────────────────────────────────

    public function test_reject_returns_points_and_stock(): void
    {
        $rewardUser = RewardUser::factory()->withPoints(500)->create();
        $item = RewardCatalogItem::factory()->withStock(5)->withCost(200)->create();
        $redemption = RewardRedemption::factory()->pending()->create([
            'reward_user_id' => $rewardUser->id,
            'catalog_item_id' => $item->id,
            'points_spent' => 200,
        ]);
        $admin = User::factory()->create();

        $result = $this->service->reject($redemption, $admin->id, 'Motivo de prueba');

        $this->assertEquals(RewardRedemption::STATUS_REJECTED, $result->status);
        $this->assertEquals($admin->id, $result->approved_by);
        $this->assertStringContainsString('Motivo de prueba', $result->notes);

        // Points returned
        $rewardUser->refresh();
        $this->assertEquals(700, $rewardUser->total_points);

        // Stock returned
        $item->refresh();
        $this->assertEquals(6, $item->stock);
    }

    public function test_reject_does_not_return_stock_when_unlimited(): void
    {
        $rewardUser = RewardUser::factory()->withPoints(500)->create();
        $item = RewardCatalogItem::factory()->withCost(200)->create([
            'stock' => RewardCatalogItem::UNLIMITED_STOCK,
        ]);
        $redemption = RewardRedemption::factory()->pending()->create([
            'reward_user_id' => $rewardUser->id,
            'catalog_item_id' => $item->id,
            'points_spent' => 200,
        ]);
        $admin = User::factory()->create();

        $this->service->reject($redemption, $admin->id);

        $item->refresh();
        $this->assertEquals(RewardCatalogItem::UNLIMITED_STOCK, $item->stock);
    }

    public function test_reject_non_pending_throws_exception(): void
    {
        $admin = User::factory()->create();
        $redemption = RewardRedemption::factory()->approved()->create();

        $this->expectException(RedemptionException::class);
        $this->service->reject($redemption, $admin->id);
    }

    // ── Deliver ──────────────────────────────────────────────────────

    public function test_deliver_approved_redemption(): void
    {
        $redemption = RewardRedemption::factory()->approved()->create();

        $result = $this->service->markAsDelivered($redemption);

        $this->assertEquals(RewardRedemption::STATUS_DELIVERED, $result->status);
        $this->assertNotNull($result->delivered_at);
    }

    public function test_deliver_non_approved_throws_exception(): void
    {
        $redemption = RewardRedemption::factory()->pending()->create();

        $this->expectException(RedemptionException::class);
        $this->service->markAsDelivered($redemption);
    }

    // ── Cancel ───────────────────────────────────────────────────────

    public function test_cancel_pending_returns_points_and_stock(): void
    {
        $rewardUser = RewardUser::factory()->withPoints(300)->create();
        $item = RewardCatalogItem::factory()->withStock(2)->withCost(150)->create();
        $redemption = RewardRedemption::factory()->pending()->create([
            'reward_user_id' => $rewardUser->id,
            'catalog_item_id' => $item->id,
            'points_spent' => 150,
        ]);

        $result = $this->service->cancel($redemption);

        $this->assertEquals(RewardRedemption::STATUS_CANCELLED, $result->status);

        $rewardUser->refresh();
        $this->assertEquals(450, $rewardUser->total_points);

        $item->refresh();
        $this->assertEquals(3, $item->stock);
    }

    public function test_cancel_approved_redemption_works(): void
    {
        $rewardUser = RewardUser::factory()->withPoints(100)->create();
        $item = RewardCatalogItem::factory()->withCost(100)->create();
        $redemption = RewardRedemption::factory()->approved()->create([
            'reward_user_id' => $rewardUser->id,
            'catalog_item_id' => $item->id,
            'points_spent' => 100,
        ]);

        $result = $this->service->cancel($redemption);
        $this->assertEquals(RewardRedemption::STATUS_CANCELLED, $result->status);
    }

    public function test_cancel_delivered_throws_exception(): void
    {
        $redemption = RewardRedemption::factory()->delivered()->create();

        $this->expectException(RedemptionException::class);
        $this->service->cancel($redemption);
    }

    public function test_cancel_rejected_throws_exception(): void
    {
        $redemption = RewardRedemption::factory()->rejected()->create();

        $this->expectException(RedemptionException::class);
        $this->service->cancel($redemption);
    }

    // ── getUserRedemptions ───────────────────────────────────────────

    public function test_get_user_redemptions_returns_correct_format(): void
    {
        $rewardUser = RewardUser::factory()->create();
        $item = RewardCatalogItem::factory()->create();

        RewardRedemption::factory()->count(3)->create([
            'reward_user_id' => $rewardUser->id,
            'catalog_item_id' => $item->id,
        ]);

        $result = $this->service->getUserRedemptions($rewardUser);

        $this->assertCount(3, $result);
        $this->assertArrayHasKey('id', $result[0]);
        $this->assertArrayHasKey('item', $result[0]);
        $this->assertArrayHasKey('points_spent', $result[0]);
        $this->assertArrayHasKey('status', $result[0]);
        $this->assertArrayHasKey('approved_at', $result[0]);
    }

    public function test_get_user_redemptions_filters_by_status(): void
    {
        $rewardUser = RewardUser::factory()->create();
        $item = RewardCatalogItem::factory()->create();

        RewardRedemption::factory()->pending()->count(2)->create([
            'reward_user_id' => $rewardUser->id,
            'catalog_item_id' => $item->id,
        ]);
        RewardRedemption::factory()->approved()->create([
            'reward_user_id' => $rewardUser->id,
            'catalog_item_id' => $item->id,
        ]);

        $pending = $this->service->getUserRedemptions($rewardUser, 'pending');
        $this->assertCount(2, $pending);

        $approved = $this->service->getUserRedemptions($rewardUser, 'approved');
        $this->assertCount(1, $approved);
    }
}
