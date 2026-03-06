<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Scheduled Tasks - Gamification System
|--------------------------------------------------------------------------
|
| Las siguientes tareas programadas mantienen el sistema de gamificación
| actualizado y funcionando correctamente.
|
*/

// Procesar rachas diarias a las 00:05
Schedule::command('rewards:process-streaks')
    ->dailyAt('00:05')
    ->withoutOverlapping()
    ->onOneServer();

// Actualizar leaderboards cada hora
Schedule::command('rewards:update-leaderboards')
    ->hourly()
    ->withoutOverlapping()
    ->onOneServer();

// Evaluar badges cada 15 minutos
Schedule::command('rewards:evaluate-badges')
    ->everyFifteenMinutes()
    ->withoutOverlapping()
    ->onOneServer();

// Health check cada 5 minutos con notificación
Schedule::command('rewards:health-check --notify')
    ->everyFiveMinutes()
    ->withoutOverlapping();

// Warmup completo de caché a las 05:00
Schedule::command('rewards:cache-warmup --full')
    ->dailyAt('05:00')
    ->withoutOverlapping()
    ->onOneServer();

// Generar métricas diarias a las 01:00
Schedule::command('rewards:generate-metrics --period=daily --store')
    ->dailyAt('01:00')
    ->withoutOverlapping()
    ->onOneServer();

// Generar métricas semanales los lunes a las 02:00
Schedule::command('rewards:generate-metrics --period=weekly --store')
    ->weeklyOn(1, '02:00')
    ->withoutOverlapping()
    ->onOneServer();

// Generar métricas mensuales el día 1 a las 03:00
Schedule::command('rewards:generate-metrics --period=monthly --store')
    ->monthlyOn(1, '03:00')
    ->withoutOverlapping()
    ->onOneServer();

/*
|--------------------------------------------------------------------------
| Scheduled Tasks - Embargo / Salario Mínimo
|--------------------------------------------------------------------------
|
| Verifica el PDF de salarios mínimos del MTSS dos veces al año
| (enero y julio) para actualizar el salario mínimo inembargable.
|
*/

// Verificar salario mínimo el 5 de enero y el 5 de julio a las 06:00
Schedule::command('embargo:actualizar-smi')
    ->cron('0 6 5 1,7 *')
    ->withoutOverlapping()
    ->onOneServer();
