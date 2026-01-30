<?php

namespace Database\Seeders;

use App\Models\Lead;
use App\Models\Opportunity;
use App\Models\Analisis;
use App\Models\Credit;
use App\Models\LoanConfiguration;
use App\Models\Deductora;
use Illuminate\Database\Seeder;
use Carbon\Carbon;

class DeduccionesSeeder extends Seeder
{
    public function run()
    {
        $dataDir = database_path('seeders/data');
        $files = glob($dataDir . '/deducciones_*.json');

        if (empty($files)) {
            $this->command->error('No se encontraron archivos JSON en ' . $dataDir);
            $this->command->info('💡 Ejecuta primero: php artisan export:deducciones');
            return;
        }

        // Obtener configuración de microcrédito
        $microConfig = LoanConfiguration::where('tipo', 'microcredito')->first();
        if (!$microConfig) {
            $this->command->error('❌ No se encontró configuración de microcrédito');
            return;
        }

        $tasa = $microConfig->tasa;
        if (!$tasa) {
            $this->command->error('❌ No hay tasa asignada a la configuración de microcrédito');
            return;
        }

        // Obtener deductora por defecto (la primera disponible)
        $deductora = Deductora::first();

        $this->command->info("✅ Configuración cargada:");
        $this->command->info("   Tasa: {$tasa->nombre} ({$tasa->tasa}%)\n");
        $this->command->info("   Plazo: {$microConfig->plazo_minimo} meses");
        if ($deductora) {
            $this->command->info("   Deductora: {$deductora->nombre}");
        }
        $this->command->newLine();

        // PASO 1: Consolidar todos los archivos JSON y agrupar por cédula
        $this->command->info("📊 Consolidando datos por persona...");
        $personasAgrupadas = $this->consolidarDatosPorCedula($files);

        $totalPersonas = count($personasAgrupadas);
        $this->command->info("   ✅ {$totalPersonas} personas únicas encontradas");
        $this->command->newLine();

        // PASO 2: Crear créditos (uno por persona)
        $this->command->info("💳 Creando créditos...");
        $progressBar = $this->command->getOutput()->createProgressBar($totalPersonas);
        $progressBar->start();

        $processed = 0;
        $errors = 0;

        foreach ($personasAgrupadas as $cedula => $datosPersona) {
            try {
                // Usar el primer registro para obtener los datos de la persona
                $primerRegistro = $datosPersona['registros'][0];
                $cuotaMensual = $primerRegistro['cuota_mensual'];

                // Generar plazo aleatorio dentro del rango permitido
                $plazoAleatorio = rand($microConfig->plazo_minimo, $microConfig->plazo_maximo);

                // Calcular monto del crédito usando la cuota y el plazo aleatorio
                $montoCredito = $this->calcularMontoDesdeQuota(
                    $cuotaMensual,
                    $tasa->tasa,
                    $plazoAleatorio
                );

                // 1. Crear/actualizar Lead
                $lead = Lead::withoutGlobalScopes()->updateOrCreate(
                    ['cedula' => $cedula],
                    [
                        'name' => $primerRegistro['nombre'],
                        'apellido1' => $primerRegistro['apellido1'],
                        'apellido2' => $primerRegistro['apellido2'],
                        'status' => 'active',
                        'tipo_credito' => 'microcredito',
                        'monto' => $montoCredito,
                        'person_type_id' => 1,
                    ]
                );

                // 2. Crear Opportunity
                $opportunity = Opportunity::create([
                    'lead_cedula' => $cedula,
                    'opportunity_type' => 'microcredito',
                    'vertical' => 'credito',
                    'amount' => $montoCredito,
                    'status' => 'won',
                    'expected_close_date' => Carbon::now(),
                ]);

                // 3. Crear Análisis
                Analisis::create([
                    'reference' => $opportunity->id,
                    'title' => "Análisis {$opportunity->id}",
                    'estado_pep' => 'aprobado',
                    'estado_cliente' => 'aprobado',
                    'category' => 'microcredito',
                    'monto_credito' => $montoCredito,
                    'lead_id' => $lead->id,
                    'opportunity_id' => $opportunity->id,
                    'opened_at' => Carbon::now(),
                    'divisa' => 'CRC',
                    'plazo' => $plazoAleatorio,
                    'propuesta' => 'aprobado',
                ]);

                // 4. Crear Credit
                Credit::create([
                    'reference' => $opportunity->id,
                    'title' => "Crédito {$opportunity->id}",
                    'status' => 'activo',
                    'category' => 'microcredito',
                    'progress' => 100,
                    'lead_id' => $lead->id,
                    'opportunity_id' => $opportunity->id,
                    'opened_at' => Carbon::now(),
                    'tipo_credito' => 'microcredito',
                    'monto_credito' => $montoCredito,
                    'cuota' => $cuotaMensual,
                    'tasa_id' => $tasa->id,
                    'plazo' => $plazoAleatorio,
                    'deductora_id' => $deductora?->id,
                    'formalized_at' => Carbon::now(),
                ]);

                // 5. Transformar Lead → Cliente
                $lead->person_type_id = 2;
                $lead->save();

                $processed++;
            } catch (\Exception $e) {
                $errors++;
                $this->command->newLine();
                $this->command->error("   ❌ Error procesando cédula {$cedula}: {$e->getMessage()}");
            }

            $progressBar->advance();
        }

        $progressBar->finish();
        $this->command->newLine(2);

        $this->command->info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        $this->command->info("📊 RESUMEN:");
        $this->command->info("   ✅ Créditos creados: {$processed}");
        $this->command->info("   ❌ Errores: {$errors}");
        $this->command->info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    /**
     * Consolida todos los archivos JSON y agrupa por cédula
     *
     * @param array $files
     * @return array ['cedula' => ['registros' => [...], 'total_meses' => N]]
     */
    private function consolidarDatosPorCedula(array $files): array
    {
        $agrupado = [];

        foreach ($files as $file) {
            $data = json_decode(file_get_contents($file), true);
            if (!$data) {
                continue;
            }

            foreach ($data as $item) {
                $cedula = $item['cedula'];

                if (!isset($agrupado[$cedula])) {
                    $agrupado[$cedula] = [
                        'registros' => [],
                        'total_meses' => 0,
                    ];
                }

                $agrupado[$cedula]['registros'][] = $item;
                $agrupado[$cedula]['total_meses']++;
            }
        }

        return $agrupado;
    }

    /**
     * Calcula el monto del crédito a partir de la cuota mensual
     * Fórmula inversa de amortización francesa
     */
    private function calcularMontoDesdeQuota(float $cuota, float $tasaAnual, int $plazoMeses): float
    {
        if ($plazoMeses <= 0 || $cuota <= 0) {
            return 0;
        }

        $tasaMensual = ($tasaAnual / 100) / 12;

        if ($tasaMensual == 0) {
            return $cuota * $plazoMeses;
        }

        // Fórmula inversa: Monto = Cuota * [(1+r)^n - 1] / [r(1+r)^n]
        $potencia = pow(1 + $tasaMensual, $plazoMeses);
        $monto = $cuota * ($potencia - 1) / ($tasaMensual * $potencia);

        return round($monto, 2);
    }

}
