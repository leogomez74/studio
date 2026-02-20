// app/Console/Kernel.php

protected function schedule(Schedule $schedule)
{
    // Ejecutar todos los días a la medianoche (00:00)
    $schedule->command('credit:calcular-mora')->daily();
    $schedule->command('leads:check-inactivity')->daily();

    // Reintentar asientos contables fallidos cada 5 minutos
    $schedule->command('accounting:retry-failed --limit=10')->everyFiveMinutes();
}
