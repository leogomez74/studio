<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BusinessActionPerformed
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param string $action Clave de la acción (debe existir en config('gamification.actions'))
     * @param User $user Usuario que realizó la acción
     * @param Model|null $model Modelo relacionado (Lead, Opportunity, Credit, etc.)
     * @param array $metadata Datos adicionales de contexto
     */
    public function __construct(
        public string $action,
        public User $user,
        public ?Model $model = null,
        public array $metadata = [],
    ) {}
}
