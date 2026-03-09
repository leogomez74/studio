<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ExchangeRateService;
use App\Models\ExchangeRate;

class FetchExchangeRate extends Command
{
    protected $signature = 'exchange-rate:fetch {--date= : Fecha específica (Y-m-d)}';

    protected $description = 'Obtiene el tipo de cambio del BCCR y lo almacena en la base de datos';

    public function handle(ExchangeRateService $service): int
    {
        $date = $this->option('date');
        $this->info('Obteniendo tipo de cambio del BCCR...');

        $rate = $service->fetchAndStore($date);

        if ($rate) {
            $this->info("Tipo de cambio guardado para {$rate->fecha->format('d/m/Y')}:");
            $this->info("  Compra: ₡{$rate->compra}");
            $this->info("  Venta:  ₡{$rate->venta}");
            return self::SUCCESS;
        }

        // Si falla, mostrar el último disponible
        $last = ExchangeRate::latest();
        if ($last) {
            $this->warn("No se pudo obtener el tipo de cambio. Último disponible ({$last->fecha->format('d/m/Y')}):");
            $this->warn("  Compra: ₡{$last->compra} | Venta: ₡{$last->venta}");
        } else {
            $this->error('No se pudo obtener el tipo de cambio y no hay datos previos.');
        }

        return self::FAILURE;
    }
}