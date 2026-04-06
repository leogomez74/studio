<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comision;
use App\Models\Credit;
use App\Models\MetaVenta;
use App\Models\Rewards\RewardUser;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VentasDashboardController extends Controller
{
    /**
     * Dashboard personal del vendedor autenticado.
     * Si el usuario tiene full_access y pasa ?all=true, retorna el leaderboard completo.
     */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json($this->buildVendorData($user->id));
    }

    /**
     * Dashboard de un vendedor específico (admin only).
     */
    public function dashboardVendor(Request $request, int $userId): JsonResponse
    {
        $user = User::findOrFail($userId);

        return response()->json($this->buildVendorData($user->id, fullData: true));
    }

    /**
     * Ranking del mes — datos diferenciados según rol.
     * Admin recibe métricas completas. Vendedor recibe solo datos públicos.
     */
    public function leaderboard(Request $request): JsonResponse
    {
        $user  = $request->user();
        $isAdmin = $user->role?->full_access ?? false;

        $anio = (int) $request->input('anio', date('Y'));
        $mes  = (int) $request->input('mes', date('n'));

        // Todos los vendedores con meta activa en el período
        $metas = MetaVenta::with(['user:id,name,role_id', 'user.role:id,name', 'bonusTiers'])
            ->where('anio', $anio)
            ->where('mes', $mes)
            ->where('activo', true)
            ->get();

        $ranking = $metas->map(function (MetaVenta $meta) use ($anio, $mes, $isAdmin, $user) {
            $creditosQuery = Credit::where('assigned_to', $meta->user_id)
                ->whereNotNull('formalized_at')
                ->whereYear('formalized_at', $anio)
                ->whereMonth('formalized_at', $mes);

            $creditosAlcanzados = $creditosQuery->count();
            $montoColocado      = (float) $creditosQuery->sum('monto_credito');
            $tierActivo         = $meta->tierActivo($creditosAlcanzados);

            // Datos públicos (visibles para todos los vendedores)
            $entry = [
                'user_id'             => $meta->user_id,
                'name'                => $meta->user?->name,
                'role_name'           => $meta->user?->role?->name ?? 'Vendedor',
                'creditos_mes'        => $creditosAlcanzados,
                'meta_cantidad'       => (int) $meta->meta_creditos_cantidad,
                'alcance_pct'         => $meta->meta_creditos_cantidad > 0
                    ? round(($creditosAlcanzados / $meta->meta_creditos_cantidad) * 100, 1)
                    : 0,
                'tier_activo_nombre'  => $tierActivo?->descripcion ?? 'Sin tier',
            ];

            // Datos privados — solo para admin
            if ($isAdmin) {
                $comisionAcumulada = (float) Comision::where('user_id', $meta->user_id)
                    ->whereYear('fecha_operacion', $anio)
                    ->whereMonth('fecha_operacion', $mes)
                    ->sum('monto_comision');

                $ticketPromedio = $creditosAlcanzados > 0
                    ? round($montoColocado / $creditosAlcanzados, 2)
                    : 0;

                $ultimaActividad = Credit::where('assigned_to', $meta->user_id)
                    ->whereNotNull('formalized_at')
                    ->max('formalized_at');

                $entry['monto_colocado']      = $montoColocado;
                $entry['ticket_promedio']     = $ticketPromedio;
                $entry['comision_acumulada']  = $comisionAcumulada;
                $entry['tier_porcentaje']     = $tierActivo ? (float) $tierActivo->porcentaje : null;
                $entry['ultima_actividad']    = $ultimaActividad;
            }

            return $entry;
        })
        ->sortByDesc('creditos_mes')
        ->values()
        ->map(function (array $entry, int $index) use ($user) {
            $entry['posicion']  = $index + 1;
            $entry['es_propio'] = ($entry['user_id'] === $user->id);
            return $entry;
        });

        // Si el usuario autenticado no está en el top visible, asegurar que aparezca al final
        $usuarioEnRanking = $ranking->firstWhere('user_id', $user->id);

        return response()->json([
            'anio'    => $anio,
            'mes'     => $mes,
            'ranking' => $ranking,
            'mi_posicion' => $usuarioEnRanking['posicion'] ?? null,
        ]);
    }

    // -----------------------------------------------------------------------

    private function buildVendorData(int $userId, bool $fullData = false): array
    {
        $anio = (int) date('Y');
        $mes  = (int) date('n');

        $meta = MetaVenta::with('bonusTiers')
            ->where('user_id', $userId)
            ->where('anio', $anio)
            ->where('mes', $mes)
            ->where('activo', true)
            ->first();

        $creditosQuery = Credit::where('assigned_to', $userId)
            ->whereNotNull('formalized_at')
            ->whereYear('formalized_at', $anio)
            ->whereMonth('formalized_at', $mes);

        $creditosAlcanzados = $creditosQuery->count();
        $montoAlcanzado     = (float) $creditosQuery->sum('monto_credito');

        $tierActivo  = $meta?->tierActivo($creditosAlcanzados);
        $proximoTier = $meta?->proximoTier($creditosAlcanzados);

        $comisionesQuery = Comision::where('user_id', $userId)
            ->whereYear('fecha_operacion', $anio)
            ->whereMonth('fecha_operacion', $mes);

        $rewardUser = RewardUser::where('user_id', $userId)->first();

        // Posición en leaderboard (conteo de vendedores con más créditos que este)
        $ranking = MetaVenta::where('anio', $anio)
            ->where('mes', $mes)
            ->where('activo', true)
            ->where('user_id', '!=', $userId)
            ->get()
            ->filter(function (MetaVenta $m) use ($anio, $mes, $creditosAlcanzados) {
                $count = Credit::where('assigned_to', $m->user_id)
                    ->whereNotNull('formalized_at')
                    ->whereYear('formalized_at', $anio)
                    ->whereMonth('formalized_at', $mes)
                    ->count();
                return $count > $creditosAlcanzados;
            })
            ->count() + 1;

        $data = [
            'vendedor' => [
                'id'   => $userId,
                'name' => User::find($userId)?->name,
            ],
            'meta_mes' => $meta ? [
                'creditos_objetivo'  => (int) $meta->meta_creditos_cantidad,
                'creditos_alcanzados' => $creditosAlcanzados,
                'monto_objetivo'     => (float) $meta->meta_creditos_monto,
                'monto_alcanzado'    => $montoAlcanzado,
                'alcance_pct'        => $meta->meta_creditos_cantidad > 0
                    ? round(($creditosAlcanzados / $meta->meta_creditos_cantidad) * 100, 1)
                    : 0,
                'tiers'              => $meta->bonusTiers->values(),
            ] : null,
            'tier_activo' => $tierActivo ? [
                'id'               => $tierActivo->id,
                'creditos_minimos' => $tierActivo->creditos_minimos,
                'porcentaje'       => (float) $tierActivo->porcentaje,
                'puntos_reward'    => $tierActivo->puntos_reward,
                'descripcion'      => $tierActivo->descripcion,
            ] : null,
            'proximo_tier' => $proximoTier ? [
                'id'               => $proximoTier->id,
                'creditos_minimos' => $proximoTier->creditos_minimos,
                'porcentaje'       => (float) $proximoTier->porcentaje,
                'puntos_reward'    => $proximoTier->puntos_reward,
                'descripcion'      => $proximoTier->descripcion,
                'faltan_creditos'  => $proximoTier->creditos_minimos - $creditosAlcanzados,
            ] : null,
            'comisiones_mes' => [
                'pendientes_monto' => (float) (clone $comisionesQuery)->where('estado', 'Pendiente')->sum('monto_comision'),
                'aprobadas_monto'  => (float) (clone $comisionesQuery)->where('estado', 'Aprobada')->sum('monto_comision'),
                'pagadas_monto'    => (float) (clone $comisionesQuery)->where('estado', 'Pagada')->sum('monto_comision'),
            ],
            'reward_points' => $rewardUser?->total_points ?? 0,
            'reward_level'  => $rewardUser?->level ?? 1,
            'ranking'       => $ranking,
        ];

        return $data;
    }
}
