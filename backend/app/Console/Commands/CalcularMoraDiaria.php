<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\PlanDePago;
use App\Models\Credit;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class CalcularMoraDiaria extends Command
{
    /**
     * El nombre y firma del comando de consola.
     * Ejemplo de uso: php artisan credit:calcular-mora
     */
    protected $signature = 'credit:calcular-mora';

    /**
     * Descripción del comando.
     */
    protected $description = 'Calcula y actualiza el interés moratorio de las cuotas vencidas';

    public function handle()
    {
        $this->info('Iniciando cálculo de mora diaria...');

        // 1. Configuración de la Tasa de Mora (Punitiva)
        // Por defecto, usamos la tasa del crédito + un spread, o una tasa fija legal.
        // Ejemplo: Tasa Anual * 1.5 (50% extra por castigo)
        $factorMora = 1.5;

        // 2. Buscar cuotas vencidas
        // Condiciones: Fecha corte menor a hoy, Estado no Pagado, Numero cuota > 0
        $hoy = Carbon::now()->startOfDay();

        $cuotasVencidas = PlanDePago::where('estado', '!=', 'Pagado')
            ->where('fecha_corte', '<', $hoy)
            ->where('numero_cuota', '>', 0)
            ->with('credit') // Cargar relación para leer la tasa original
            ->get();

        $count = 0;

        foreach ($cuotasVencidas as $cuota) {

            // Validar que exista el crédito padre
            if (!$cuota->credit) continue;

            // 3. Calcular Días de Atraso
            // Fecha corte: 2023-10-01, Hoy: 2023-10-05 -> 4 días de mora
            $fechaCorte = Carbon::parse($cuota->fecha_corte)->startOfDay();
            $diasMora = $fechaCorte->diffInDays($hoy);

            // 4. Determinar la Base de Cálculo (Saldo Vencido de la Cuota)
            // ¿Sobre qué aplicamos la multa? Usualmente sobre el capital + interés corriente vencido.
            // Excluimos la mora previa para no cobrar "interés sobre interés" (anatocismo), a menos que tu ley lo permita.

            // Lo que debia pagar (sin mora) = Cuota + Cargos
            $montoExigibleOriginal = $cuota->cuota + $cuota->cargos + $cuota->poliza;

            // Lo que ha pagado realmente (sin contar lo que se haya ido a mora anteriormente)
            // Esto es una aproximación segura: movimiento_total - movimiento_interes_moratorio
            $pagadoAbono = max(0, $cuota->movimiento_total - $cuota->movimiento_interes_moratorio);

            $saldoVencido = max(0, $montoExigibleOriginal - $pagadoAbono);

            if ($saldoVencido <= 0) continue; // Si ya pagó todo lo vencido (salvo la mora), no generamos más base.

            // 5. Calcular el Interés Moratorio Acumulado
            // Fórmula: SaldoVencido * (TasaAnual * Factor / 100) * (Dias / 360)

            $tasaAnualCredito = $cuota->credit->tasa_anual ?? 33.5;
            $tasaMoraAnual = $tasaAnualCredito * $factorMora; // Ej: 33.5 * 1.5 = 50.25%

            // Interés moratorio TOTAL que debería tener acumulado hasta hoy
            $moraCalculada = $saldoVencido * ($tasaMoraAnual / 100) * ($diasMora / 360);

            // Redondeo a 2 decimales
            $moraCalculada = round($moraCalculada, 2);

            // 6. Actualizar la Cuota
            // Solo actualizamos si el cálculo es mayor al que ya tenía (la mora nunca baja sola)
            if ($moraCalculada > $cuota->interes_moratorio) {
                $cuota->interes_moratorio = $moraCalculada;
                $cuota->dias_mora = $diasMora;

                // Actualizamos el estado si no estaba en 'Mora' (opcional, visual)
                if ($cuota->estado !== 'Mora' && $cuota->estado !== 'Pagado') {
                    $cuota->estado = 'Mora';
                }

                $cuota->save();
                $count++;
            }
        }

        $this->info("Proceso finalizado. Se actualizaron {$count} cuotas con mora.");
    }
}
