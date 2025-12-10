<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Sistema de Gamificación
    |--------------------------------------------------------------------------
    |
    | Configuración general del sistema de gamificación. Puedes habilitar
    | o deshabilitar todo el sistema con la variable GAMIFICATION_ENABLED.
    |
    */

    'enabled' => env('GAMIFICATION_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Configuración de Puntos
    |--------------------------------------------------------------------------
    |
    | expiration_days: Días hasta que expiran los puntos (null = nunca)
    | max_daily_earn: Máximo de puntos que un usuario puede ganar por día
    |
    */

    'points' => [
        'expiration_days' => null,
        'max_daily_earn' => 1000,
    ],

    /*
    |--------------------------------------------------------------------------
    | Configuración de Niveles
    |--------------------------------------------------------------------------
    |
    | max_level: Nivel máximo alcanzable
    | base_xp: XP base requerido para el primer nivel
    | multiplier: Multiplicador para calcular XP del siguiente nivel
    |
    | Fórmula: xp_requerido = base_xp * (multiplier ^ (nivel - 1))
    |
    */

    'levels' => [
        'max_level' => 100,
        'base_xp' => 100,
        'multiplier' => 1.5,
    ],

    /*
    |--------------------------------------------------------------------------
    | Configuración de Rachas (Streaks)
    |--------------------------------------------------------------------------
    |
    | enabled: Habilitar sistema de rachas
    | reset_hour: Hora de reinicio del día (formato HH:MM)
    | timezone: Zona horaria para calcular el día
    | bonuses: Bonificaciones por días de racha consecutivos
    |
    */

    'streaks' => [
        'enabled' => true,
        'reset_hour' => '00:00',
        'timezone' => 'America/Costa_Rica',
        'bonuses' => [
            7 => 0.10,   // 10% bonus después de 7 días
            14 => 0.15,  // 15% bonus después de 14 días
            30 => 0.25,  // 25% bonus después de 30 días
            60 => 0.40,  // 40% bonus después de 60 días
            100 => 0.50, // 50% bonus después de 100 días
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Configuración de Caché
    |--------------------------------------------------------------------------
    |
    | prefix: Prefijo para todas las claves de caché del sistema
    | ttl_rankings: TTL para rankings/leaderboards (segundos)
    | ttl_user_data: TTL para datos de usuario (segundos)
    | ttl_badges: TTL para lista de badges (segundos)
    |
    */

    'cache' => [
        'prefix' => 'rewards:',
        'ttl_rankings' => 300,    // 5 minutos
        'ttl_user_data' => 60,    // 1 minuto
        'ttl_badges' => 900,      // 15 minutos
    ],

    /*
    |--------------------------------------------------------------------------
    | Configuración de Leaderboards
    |--------------------------------------------------------------------------
    |
    | default_limit: Cantidad de entradas por defecto en rankings
    | available_metrics: Métricas disponibles para ordenar
    | available_periods: Períodos disponibles para filtrar
    |
    */

    'leaderboards' => [
        'default_limit' => 50,
        'available_metrics' => ['points', 'experience', 'streak', 'level'],
        'available_periods' => ['daily', 'weekly', 'monthly', 'all_time'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Configuración de Challenges
    |--------------------------------------------------------------------------
    |
    | max_active_per_user: Máximo de challenges activos por usuario
    | auto_complete: Completar automáticamente cuando se alcanza el objetivo
    |
    */

    'challenges' => [
        'max_active_per_user' => 5,
        'auto_complete' => true,
    ],

    /*
    |--------------------------------------------------------------------------
    | Configuración de Catálogo
    |--------------------------------------------------------------------------
    |
    | min_redemption_points: Mínimo de puntos para canjear
    | require_approval: Requiere aprobación de admin para redenciones
    |
    */

    'catalog' => [
        'min_redemption_points' => 100,
        'require_approval' => true,
    ],

    /*
    |--------------------------------------------------------------------------
    | Notificaciones
    |--------------------------------------------------------------------------
    |
    | Configuración de notificaciones para eventos de gamificación
    |
    */

    'notifications' => [
        'badge_earned' => true,
        'level_up' => true,
        'challenge_completed' => true,
        'streak_milestone' => true,
        'redemption_approved' => true,
    ],
];
