<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Analisis;
use App\Models\Propuesta;

class CreateMissingPropuestas extends Command
{
    protected $signature = 'propuestas:create-missing';
    protected $description = 'Crea propuestas para análisis que no tienen ninguna propuesta';

    public function handle()
    {
        $this->info('Buscando análisis sin propuestas...');

        // Obtener análisis que tienen monto_sugerido y plazo pero no tienen propuestas
        $analisisSinPropuestas = Analisis::whereHas('propuestas', function ($query) {
            // Esta consulta busca análisis que NO tienen propuestas
        }, '=', 0)
            ->whereNotNull('monto_sugerido')
            ->whereNotNull('plazo')
            ->where('monto_sugerido', '>', 0)
            ->get();

        if ($analisisSinPropuestas->isEmpty()) {
            $this->info('No se encontraron análisis sin propuestas.');
            return 0;
        }

        $this->info("Se encontraron {$analisisSinPropuestas->count()} análisis sin propuestas.");

        $created = 0;
        foreach ($analisisSinPropuestas as $analisis) {
            Propuesta::create([
                'analisis_reference' => $analisis->reference,
                'monto' => $analisis->monto_sugerido,
                'plazo' => $analisis->plazo,
                'cuota' => $analisis->cuota,
                'estado' => 'Pendiente',
            ]);

            $created++;
            $this->info("✓ Propuesta creada para análisis {$analisis->reference}");
        }

        $this->info("\n{$created} propuestas creadas exitosamente.");
        return 0;
    }
}
