<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\MetaBonusTier;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class VendorTierAchieved
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public User $vendor,
        public MetaBonusTier $tier,
        public int $creditosAlcanzados,
    ) {}
}
