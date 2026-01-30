<?php

namespace Database\Seeders;

use App\Models\Lead;
use App\Models\Opportunity;
use App\Models\Analisis;
use App\Models\Credit;
use App\Models\LoanConfiguration;
use App\Models\Deductora;
use App\Models\PlanDePago;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
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

        // Crear/obtener deductoras necesarias
        $deductorasMap = $this->prepararDeductoras();

        // Limpiar datos existentes
        $this->limpiarDatosExistentes();

        $this->command->info("✅ Configuración cargada:");
        $this->command->info("   Tasa: {$tasa->nombre} ({$tasa->tasa}%)");
        $this->command->info("   Plazo: {$microConfig->plazo_minimo}-{$microConfig->plazo_maximo} meses");
        $this->command->info("   Monto: ₡" . number_format($microConfig->monto_minimo) . " - ₡" . number_format($microConfig->monto_maximo));
        $this->command->info("   Deductoras preparadas: " . count($deductorasMap));
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
                $nombreDeductora = $primerRegistro['deductora'] ?? 'UNKNOWN';

                // Obtener ID de la deductora
                $deductoraId = $deductorasMap[$nombreDeductora] ?? null;

                // Generar plazo aleatorio dentro del rango permitido
                $plazoAleatorio = rand($microConfig->plazo_minimo, $microConfig->plazo_maximo);

                // Calcular monto del crédito usando la cuota y el plazo aleatorio
                $montoCredito = $this->calcularMontoDesdeQuota(
                    $cuotaMensual,
                    $tasa->tasa,
                    $plazoAleatorio
                );

                // Aplicar límites de configuración (mantener cuota fija de planilla)
                if ($montoCredito > $microConfig->monto_maximo) {
                    $montoCredito = $microConfig->monto_maximo;
                } elseif ($montoCredito < $microConfig->monto_minimo) {
                    $montoCredito = $microConfig->monto_minimo;
                }

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
                        'deductora_id' => $deductoraId,
                    ]
                );

                // 2. Crear Opportunity
                $opportunity = Opportunity::create([
                    'lead_cedula' => $cedula,
                    'opportunity_type' => 'Microcrédito (Hasta ₡690.000)',
                    'vertical' => 'credito',
                    'amount' => $montoCredito,
                    'status' => 'Analizada',
                    'expected_close_date' => Carbon::now(),
                ]);

                // 3. Crear Análisis
                Analisis::create([
                    'reference' => $opportunity->id,
                    'title' => "Análisis {$opportunity->id}",
                    'estado_pep' => 'aprobado',
                    'estado_cliente' => 'aprobado',
                    'category' => 'Micro Crédito',
                    'monto_credito' => $montoCredito,
                    'lead_id' => $lead->id,
                    'opportunity_id' => $opportunity->id,
                    'opened_at' => Carbon::now(),
                    'divisa' => 'CRC',
                    'plazo' => $plazoAleatorio,
                    'propuesta' => 'aprobado',
                ]);

                // 4. Crear Credit (primero con status pendiente)
                $credit = Credit::create([
                    'reference' => $opportunity->id,
                    'title' => "Crédito {$opportunity->id}",
                    'status' => 'Pendiente',
                    'category' => 'Micro Crédito',
                    'progress' => 100,
                    'lead_id' => $lead->id,
                    'opportunity_id' => $opportunity->id,
                    'opened_at' => Carbon::now(),
                    'tipo_credito' => 'microcredito',
                    'monto_credito' => $montoCredito,
                    'cuota' => $cuotaMensual,
                    'tasa_id' => $tasa->id,
                    'plazo' => $plazoAleatorio,
                    'saldo' => $montoCredito,
                    'deductora_id' => $deductoraId,
                ]);

                // Generar número de operación con formato YY-XXXXX-01-CRED
                $year = date('y');
                $credit->numero_operacion = sprintf('%s-%05d-01-CRED', $year, $credit->id);

                // Formalizar crédito y generar plan de pago
                $credit->status = 'Formalizado';
                $credit->formalized_at = Carbon::now();
                $credit->save();

                // Generar plan de pago
                $this->generarPlanDePago($credit, $tasa->tasa, $plazoAleatorio);

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
     * Limpiar datos existentes - Wipe completo de tablas
     * Elimina TODOS los registros de las tablas relacionadas antes de hacer el seed
     */
    private function limpiarDatosExistentes(): void
    {
        $this->command->info("🧹 Limpiando datos existentes (wipe completo)...");

        DB::statement('SET FOREIGN_KEY_CHECKS=0;');

        // 1. Limpiar pagos de créditos
        $deletedPayments = \App\Models\CreditPayment::count();
        \App\Models\CreditPayment::truncate();
        $this->command->info("   ✓ {$deletedPayments} pagos eliminados (tabla limpiada)");

        // 2. Limpiar plan de pago
        $deletedPlan = \App\Models\PlanDePago::count();
        \App\Models\PlanDePago::truncate();
        $this->command->info("   ✓ {$deletedPlan} entradas de plan de pago eliminadas (tabla limpiada)");

        // 3. Limpiar créditos
        $deletedCredits = \App\Models\Credit::count();
        \App\Models\Credit::truncate();
        $this->command->info("   ✓ {$deletedCredits} créditos eliminados (tabla limpiada)");

        // 4. Limpiar análisis
        $deletedAnalisis = \App\Models\Analisis::count();
        \App\Models\Analisis::truncate();
        $this->command->info("   ✓ {$deletedAnalisis} análisis eliminados (tabla limpiada)");

        // 5. Limpiar oportunidades
        $deletedOpportunities = \App\Models\Opportunity::count();
        \App\Models\Opportunity::truncate();
        $this->command->info("   ✓ {$deletedOpportunities} oportunidades eliminadas (tabla limpiada)");

        // 6. Limpiar personas (solo leads y clientes, no inversores)
        $deletedPersons = Lead::withoutGlobalScopes()->where('person_type_id', '!=', 3)->count();
        Lead::withoutGlobalScopes()->where('person_type_id', '!=', 3)->delete();
        $this->command->info("   ✓ {$deletedPersons} personas eliminadas (preservando inversores)");

        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        $this->command->newLine();
    }

    /**
     * Preparar mapa de deductoras (nombre => ID)
     * Crea las deductoras si no existen
     */
    private function prepararDeductoras(): array
    {
        $deductorasNecesarias = [
            'CREDIPEP' => 'CREDIPEP',
            'CoopeSanGabriel' => 'Cooperativa San Gabriel',
            'CoopeServicios' => 'Cooperativa de Servicios',
        ];

        $deductorasMap = [];

        foreach ($deductorasNecesarias as $nombreArchivo => $nombreCompleto) {
            $deductora = Deductora::firstOrCreate(
                ['nombre' => $nombreCompleto]
            );

            $deductorasMap[$nombreArchivo] = $deductora->id;
        }

        return $deductorasMap;
    }

    /**
     * Consolida todos los archivos JSON y agrupa por cédula
     * Limita a 50 personas únicas por deductora
     *
     * @param array $files
     * @return array ['cedula' => ['registros' => [...], 'total_meses' => N]]
     */
    private function consolidarDatosPorCedula(array $files): array
    {
        $agrupadoPorDeductora = [];

        // Primero agrupar por deductora y luego por cédula
        foreach ($files as $file) {
            $data = json_decode(file_get_contents($file), true);
            if (!$data) {
                continue;
            }

            foreach ($data as $item) {
                $cedula = $item['cedula'];
                $deductora = $item['deductora'] ?? 'UNKNOWN';

                if (!isset($agrupadoPorDeductora[$deductora])) {
                    $agrupadoPorDeductora[$deductora] = [];
                }

                if (!isset($agrupadoPorDeductora[$deductora][$cedula])) {
                    $agrupadoPorDeductora[$deductora][$cedula] = [
                        'registros' => [],
                        'total_meses' => 0,
                    ];
                }

                $agrupadoPorDeductora[$deductora][$cedula]['registros'][] = $item;
                $agrupadoPorDeductora[$deductora][$cedula]['total_meses']++;
            }
        }

        // Limitar a 50 personas por deductora y consolidar en un solo array
        $consolidado = [];
        foreach ($agrupadoPorDeductora as $deductora => $personas) {
            $personasLimitadas = array_slice($personas, 0, 50, true);
            $consolidado = $consolidado + $personasLimitadas; // Usar + para preservar keys

            $this->command->info("   {$deductora}: " . count($personasLimitadas) . " personas (de " . count($personas) . " disponibles)");
        }

        return $consolidado;
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

    /**
     * Genera el plan de pago (tabla de amortización) para un crédito
     */
    private function generarPlanDePago(Credit $credit, float $tasaAnual, int $plazo)
    {
        $monto = (float) $credit->monto_credito;
        $cuota = (float) $credit->cuota;
        $tasaMensual = ($tasaAnual / 100) / 12;
        $fechaPrimeraCuota = Carbon::now()->addMonth()->startOfMonth();

        // Cuota 0: Desembolso inicial
        PlanDePago::create([
            'credit_id' => $credit->id,
            'linea' => '1',
            'numero_cuota' => 0,
            'proceso' => $credit->opened_at->format('Ym'),
            'fecha_inicio' => $credit->opened_at,
            'tasa_actual' => $tasaAnual,
            'plazo_actual' => $plazo,
            'cuota' => 0,
            'poliza' => 0,
            'interes_corriente' => 0,
            'amortizacion' => 0,
            'saldo_anterior' => 0,
            'saldo_nuevo' => $monto,
            'dias' => 0,
            'estado' => 'Vigente',
            'movimiento_total' => $monto,
            'movimiento_principal' => $monto,
            'concepto' => 'Desembolso Inicial',
        ]);

        // Generar cuotas mensuales
        $saldoActual = $monto;
        for ($i = 1; $i <= $plazo; $i++) {
            $interesCorriente = $saldoActual * $tasaMensual;
            $amortizacion = $cuota - $interesCorriente;
            $saldoNuevo = $saldoActual - $amortizacion;
            $cuotaActual = $cuota;

            // Ajustar última cuota por diferencias de redondeo
            if ($i === $plazo) {
                $amortizacion = $saldoActual;
                $cuotaActual = $interesCorriente + $amortizacion;
                $saldoNuevo = 0;
            }

            $fechaCuota = $fechaPrimeraCuota->copy()->addMonths($i - 1);

            PlanDePago::create([
                'credit_id' => $credit->id,
                'linea' => (string) ($i + 1),
                'numero_cuota' => $i,
                'proceso' => $fechaCuota->format('Ym'),
                'fecha_inicio' => $fechaCuota,
                'fecha_corte' => $fechaCuota->copy()->endOfMonth(),
                'fecha_pago' => $fechaCuota->copy()->endOfMonth(),
                'tasa_actual' => $tasaAnual,
                'plazo_actual' => $plazo,
                'cuota' => round($cuotaActual, 2),
                'poliza' => 0,
                'interes_corriente' => round($interesCorriente, 2),
                'int_corriente_vencido' => 0,
                'amortizacion' => round($amortizacion, 2),
                'saldo_anterior' => round($saldoActual, 2),
                'saldo_nuevo' => round($saldoNuevo, 2),
                'dias' => 30,
                'estado' => 'Pendiente',
            ]);

            $saldoActual = $saldoNuevo;
        }
    }

}
