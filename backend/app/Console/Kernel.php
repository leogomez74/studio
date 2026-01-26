// app/Console/Kernel.php

protected function schedule(Schedule $schedule)
{
    // Ejecutar todos los días a la medianoche (00:00)
    $schedule->command('credit:calcular-mora')->daily();

    // O si prefieres a una hora específica de la madrugada para no afectar usuarios
    // $schedule->command('credit:calcular-mora')->dailyAt('01:00');
}
