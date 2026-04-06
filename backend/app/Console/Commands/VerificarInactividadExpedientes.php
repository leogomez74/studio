<?php

namespace App\Console\Commands;

use App\Models\ExpedienteJudicial;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Console\Command;

class VerificarInactividadExpedientes extends Command
{
    protected $signature = 'cobro-judicial:verificar-inactividad';
    protected $description = 'Verifica expedientes judiciales sin movimiento y genera alertas de impulso procesal y prescripción';

    public function handle(): int
    {
        $hoy = now();
        $alertasImpulso     = 0;
        $alertasPrescripcion = 0;

        // Usuarios con permiso cobro_judicial (rol que tiene can_view = true en ese módulo)
        $usuariosAlerta = User::whereHas('role', function ($q) {
            $q->whereHas('permissions', function ($q2) {
                $q2->where('module_key', 'cobro_judicial')->where('can_view', true);
            });
        })->pluck('id')->toArray();

        // Solo expedientes activos (ya aprobados, en proceso)
        $expedientes = ExpedienteJudicial::where('estado', 'activo')
            ->whereNotNull('fecha_ultima_actuacion')
            ->get();

        foreach ($expedientes as $expediente) {
            $diasSinMovimiento = $expediente->fecha_ultima_actuacion->diffInDays($hoy);

            // ── Alerta de impulso procesal (3 meses / ~90 días) ─────────────────
            // Ref: Carlos — "falta de impulso procesal: no darle movimiento durante 3 meses,
            // el demandado puede traerse abajo el expediente"
            if ($diasSinMovimiento >= ExpedienteJudicial::DIAS_ALERTA_IMPULSO && !$expediente->alerta_impulso) {
                $expediente->update(['alerta_impulso' => true]);

                $expediente->registrarActuacion(
                    'alerta_inactividad',
                    "Alerta: {$diasSinMovimiento} días sin actuación. Riesgo de falta de impulso procesal (límite: 90 días).",
                    null,
                    ['dias_sin_movimiento' => $diasSinMovimiento, 'tipo' => 'impulso_procesal']
                );

                $this->notificarUsuarios(
                    $usuariosAlerta,
                    'cobro_judicial_alerta_impulso',
                    '⚠️ Alerta: Falta de impulso procesal',
                    "Expediente {$expediente->numero_expediente} ({$expediente->nombre_deudor}) lleva {$diasSinMovimiento} días sin actuación. Riesgo de que el demandado lo dé por abandonado.",
                    [
                        'expediente_id'       => $expediente->id,
                        'numero_expediente'   => $expediente->numero_expediente,
                        'nombre_deudor'       => $expediente->nombre_deudor,
                        'dias_sin_movimiento' => $diasSinMovimiento,
                        'tipo_alerta'         => 'impulso_procesal',
                    ]
                );

                $alertasImpulso++;
            }

            // ── Alerta de prescripción (4 años) ─────────────────────────────────
            // Ref: Carlos — "prescripción: 4 años sin darle movimiento o sin lograr notificar,
            // el cliente sana potestad de traerse abajo el expediente sin autorización nuestra"
            $añosSinMovimiento = $expediente->fecha_ultima_actuacion->diffInYears($hoy);

            if ($añosSinMovimiento >= ExpedienteJudicial::AÑOS_PRESCRIPCION && !$expediente->alerta_prescripcion) {
                $expediente->update(['alerta_prescripcion' => true]);

                $expediente->registrarActuacion(
                    'alerta_inactividad',
                    "ALERTA CRÍTICA: {$añosSinMovimiento} años sin actuación. Riesgo de prescripción de la deuda.",
                    null,
                    ['años_sin_movimiento' => $añosSinMovimiento, 'tipo' => 'prescripcion']
                );

                $this->notificarUsuarios(
                    $usuariosAlerta,
                    'cobro_judicial_alerta_prescripcion',
                    '🚨 CRÍTICO: Riesgo de prescripción',
                    "Expediente {$expediente->numero_expediente} ({$expediente->nombre_deudor}) lleva {$añosSinMovimiento} años sin actuación. La deuda puede prescribir.",
                    [
                        'expediente_id'       => $expediente->id,
                        'numero_expediente'   => $expediente->numero_expediente,
                        'nombre_deudor'       => $expediente->nombre_deudor,
                        'años_sin_movimiento' => $añosSinMovimiento,
                        'tipo_alerta'         => 'prescripcion',
                    ]
                );

                $alertasPrescripcion++;
            }

            // ── Resetear alertas si hubo actuación reciente ──────────────────────
            // Si la última actuación es reciente, limpiar las alertas para que
            // puedan dispararse de nuevo si vuelve a quedar inactivo.
            if ($diasSinMovimiento < ExpedienteJudicial::DIAS_ALERTA_IMPULSO && $expediente->alerta_impulso) {
                $expediente->update(['alerta_impulso' => false]);
            }
            if ($añosSinMovimiento < ExpedienteJudicial::AÑOS_PRESCRIPCION && $expediente->alerta_prescripcion) {
                $expediente->update(['alerta_prescripcion' => false]);
            }
        }

        $this->info("Verificación completada: {$alertasImpulso} alertas de impulso procesal, {$alertasPrescripcion} alertas de prescripción.");

        return 0;
    }

    /**
     * Crea una notificación interna para cada usuario del área legal/finanzas.
     * Evita duplicados: no genera la misma alerta dos veces en menos de 7 días.
     */
    private function notificarUsuarios(array $userIds, string $tipo, string $titulo, string $body, array $data): void
    {
        foreach ($userIds as $userId) {
            $yaNotoificado = Notification::where('user_id', $userId)
                ->where('type', $tipo)
                ->where('data->expediente_id', $data['expediente_id'])
                ->where('created_at', '>=', now()->subDays(7))
                ->exists();

            if ($yaNotoificado) continue;

            Notification::create([
                'user_id' => $userId,
                'type'    => $tipo,
                'title'   => $titulo,
                'body'    => $body,
                'data'    => $data,
            ]);
        }
    }
}
