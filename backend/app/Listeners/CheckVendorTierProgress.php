<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\VendorTierAchieved;
use App\Models\Credit;
use App\Models\MetaVenta;
use App\Models\Rewards\RewardUser;
use App\Models\User;
use App\Services\Rewards\RewardService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Se dispara cuando se formaliza un crédito.
 * Verifica si el vendedor cruzó un nuevo tier de bonificación y otorga los rewards correspondientes.
 *
 * Cómo conectarlo: en EventServiceProvider, escucha el evento que se dispara
 * al formalizar un crédito (BusinessActionPerformed con action='credit_formalized'
 * o el evento nativo que use CreditController).
 */
class CheckVendorTierProgress implements ShouldQueue
{
    public function __construct(private RewardService $rewardService) {}

    /**
     * Recibe el user_id y la fecha del crédito formalizado.
     * Se puede llamar directamente desde CreditController tras formalizar.
     */
    public static function checkForUser(int $userId, string $fechaFormalizacion): void
    {
        $fecha = \Carbon\Carbon::parse($fechaFormalizacion);
        $anio  = (int) $fecha->year;
        $mes   = (int) $fecha->month;

        $meta = MetaVenta::with('bonusTiers')
            ->where('user_id', $userId)
            ->where('anio', $anio)
            ->where('mes', $mes)
            ->where('activo', true)
            ->first();

        if (!$meta || $meta->bonusTiers->isEmpty()) {
            return;
        }

        $creditosAlcanzados = Credit::where('assigned_to', $userId)
            ->whereNotNull('formalized_at')
            ->whereYear('formalized_at', $anio)
            ->whereMonth('formalized_at', $mes)
            ->count();

        $tierActivo = $meta->tierActivo($creditosAlcanzados);

        if (!$tierActivo) {
            return;
        }

        // Usar caché para detectar si el tier cambió desde la última verificación
        $cacheKey       = "vendor_tier_{$userId}_{$anio}_{$mes}";
        $tierAnteriorId = Cache::get($cacheKey);

        if ($tierAnteriorId === $tierActivo->id) {
            return; // Mismo tier, nada nuevo
        }

        Cache::put($cacheKey, $tierActivo->id, now()->addDays(40));

        // Disparar evento para otorgar rewards
        $vendor = User::find($userId);
        if ($vendor) {
            event(new VendorTierAchieved($vendor, $tierActivo, $creditosAlcanzados));
        }
    }

    public function handle(VendorTierAchieved $event): void
    {
        if (!config('gamification.enabled', false)) {
            return;
        }

        if ($event->tier->puntos_reward <= 0) {
            return;
        }

        try {
            $rewardUser = RewardUser::findOrCreateForUser($event->vendor->id);

            $this->rewardService->awardPoints($rewardUser, $event->tier->puntos_reward, 'earn', [
                'description'    => 'Tier alcanzado: ' . ($event->tier->descripcion ?? $event->tier->creditos_minimos . ' créditos'),
                'reference_type' => 'meta-bonus-tier',
                'reference_id'   => $event->tier->id,
                'metadata'       => [
                    'tier_id'             => $event->tier->id,
                    'creditos_alcanzados' => $event->creditosAlcanzados,
                    'porcentaje'          => $event->tier->porcentaje,
                ],
            ]);

            Log::info("VendorTierAchieved: vendor #{$event->vendor->id} alcanzó tier '{$event->tier->descripcion}' con {$event->creditosAlcanzados} créditos. +{$event->tier->puntos_reward} pts");

        } catch (\Throwable $e) {
            Log::error('CheckVendorTierProgress failed: ' . $e->getMessage(), [
                'user_id' => $event->vendor->id,
                'tier_id' => $event->tier->id,
            ]);
        }
    }
}
