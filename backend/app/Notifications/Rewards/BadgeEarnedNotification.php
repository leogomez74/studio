<?php

declare(strict_types=1);

namespace App\Notifications\Rewards;

use App\Models\Rewards\RewardBadge;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class BadgeEarnedNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected RewardBadge $badge
    ) {}

    /**
     * Canales de entrega de la notificación.
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Datos para la notificación en base de datos.
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'badge_earned',
            'badge_id' => $this->badge->id,
            'badge_name' => $this->badge->name,
            'badge_icon' => $this->badge->icon,
            'badge_rarity' => $this->badge->rarity,
            'message' => "¡Has ganado el badge \"{$this->badge->name}\"!",
        ];
    }
}
