// app/Console/Kernel.php

protected function schedule(Schedule $schedule)
{
    // Ejecutar todos los días a la medianoche (00:00)
    $schedule->command('credit:calcular-mora')->daily();
    $schedule->command('leads:check-inactivity')->daily();

    // Obtener tipo de cambio del BCCR a las 6:00 AM (cuando BCCR publica)
    $schedule->command('exchange-rate:fetch')->dailyAt('06:00');

    // Reintentar asientos contables fallidos cada 5 minutos
    $schedule->command('accounting:retry-failed --limit=10')->everyFiveMinutes();
}
