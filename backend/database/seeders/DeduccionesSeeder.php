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

        // PASO 2: Crear análisis y créditos (uno por persona)
        $this->command->info("💳 Creando análisis y créditos...");
        $progressBar = $this->command->getOutput()->createProgressBar($totalPersonas);
        $progressBar->start();

        $analisisCreados = 0;
        $creditosCreados = 0;
        $errors = 0;

        foreach ($personasAgrupadas as $cedula => $datosPersona) {
            try {
                // Usar el primer registro para obtener los datos de la persona
                $primerRegistro = $datosPersona['registros'][0];
                $cuotaMensual = $primerRegistro['cuota_mensual'];
                $nombreDeductora = $primerRegistro['deductora'] ?? 'UNKNOWN';

                // Obtener ID de la deductora
                $deductoraId = $deductorasMap[$nombreDeductora] ?? null;

                // Encontrar el plazo óptimo que resulte en un monto dentro de límites
                // manteniendo la cuota fija de planilla
                $plazoOptimo = null;
                $montoCredito = null;

                // Iterar desde plazo máximo hacia mínimo para maximizar el monto
                for ($plazo = $microConfig->plazo_maximo; $plazo >= $microConfig->plazo_minimo; $plazo--) {
                    $montoCalculado = $this->calcularMontoDesdeQuota(
                        $cuotaMensual,
                        $tasa->tasa,
                        $plazo
                    );

                    // Verificar si el monto calculado está dentro de los límites
                    if ($montoCalculado >= $microConfig->monto_minimo && $montoCalculado <= $microConfig->monto_maximo) {
                        $plazoOptimo = $plazo;
                        $montoCredito = $montoCalculado;
                        break; // Encontramos el plazo óptimo
                    }
                }

                // Si no se encontró plazo óptimo, usar límites y ajustar
                if ($plazoOptimo === null) {
                    $plazoOptimo = $microConfig->plazo_maximo;
                    $montoCalculado = $this->calcularMontoDesdeQuota($cuotaMensual, $tasa->tasa, $plazoOptimo);

                    if ($montoCalculado > $microConfig->monto_maximo) {
                        $montoCredito = $microConfig->monto_maximo;
                    } else {
                        $montoCredito = $microConfig->monto_minimo;
                    }
                }

                $plazoAleatorio = $plazoOptimo;

                // 1. Crear/actualizar Lead
                $lead = Lead::withoutGlobalScopes()->updateOrCreate(
                    ['cedula' => $cedula],
                    [
                        'name' => $primerRegistro['nombre'],
                        'apellido1' => $primerRegistro['apellido1'],
                        'apellido2' => $primerRegistro['apellido2'],
                        'status' => 'active',
                        'lead_status_id' => 1, // Estado "Nuevo" por defecto
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

                // 3. Crear Análisis con aleatoridad
                // estado_pep acepta: [Pendiente, Aceptado, Pendiente de cambios, Rechazado]
                // Cuando estado_pep es "Aceptado", se activa estado_cliente con "Aprobado" o "Rechazado"
                $rand = rand(1, 100);

                if ($rand <= 60) {
                    $estadoPep = 'Aceptado'; // 60% aceptado para tener datos
                } elseif ($rand <= 75) {
                    $estadoPep = 'Pendiente'; // 15% pendiente
                } elseif ($rand <= 90) {
                    $estadoPep = 'Pendiente de cambios'; // 15% pendiente de cambios
                } else {
                    $estadoPep = 'Rechazado'; // 10% rechazado
                }

                // Solo establecer estado_cliente cuando estado_pep es "Aceptado"
                $estadoCliente = null;
                if ($estadoPep === 'Aceptado') {
                    $estadoCliente = rand(1, 10) > 2 ? 'Aprobado' : 'Rechazado'; // 80% Aprobado, 20% Rechazado
                }

                $analisis = Analisis::create([
                    'reference' => $opportunity->id,
                    'title' => "Análisis {$opportunity->id}",
                    'estado_pep' => $estadoPep,
                    'estado_cliente' => $estadoCliente,
                    'category' => 'Micro Crédito',
                    'monto_credito' => $montoCredito,
                    'lead_id' => $lead->id,
                    'opportunity_id' => $opportunity->id,
                    'opened_at' => Carbon::now(),
                    'divisa' => 'CRC',
                    'plazo' => $plazoAleatorio,
                    'propuesta' => 'aprobado',
                ]);

                $analisisCreados++;

                // 4. Crear Credit solo si el análisis fue aprobado
                // Solo crear crédito cuando estado_pep = "Aceptado" y estado_cliente = "Aprobado"
                $debeCrearCredito = ($estadoPep === 'Aceptado' && $estadoCliente === 'Aprobado');

                if (!$debeCrearCredito) {
                    $progressBar->advance();
                    continue; // Saltar creación de crédito
                }

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

                // Activar crédito, establecer fecha de formalización y generar plan de pago
                $credit->status = 'Activo';
                $credit->formalized_at = Carbon::now();
                $credit->save();

                // Generar plan de pago
                $this->generarPlanDePago($credit, $tasa->tasa, $plazoAleatorio);

                // Actualizar cuota del crédito con el valor real del plan generado
                $primeraCuota = $credit->planDePagos()->where('numero_cuota', 1)->first();
                if ($primeraCuota) {
                    $credit->cuota = $primeraCuota->cuota;
                    $credit->save();
                }

                // 5. Transformar Lead → Cliente
                $lead->person_type_id = 2;
                $lead->save();

                $creditosCreados++;
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
        $this->command->info("   📋 Análisis creados: {$analisisCreados}");
        $this->command->info("   💳 Créditos creados: {$creditosCreados}");
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
            'CREDIPEP' => 'Cooperativa Nacional',
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
        // Guard: Verificar si ya existe un plan de pagos para este crédito
        $existingCount = PlanDePago::where('credit_id', $credit->id)->count();
        if ($existingCount > 0) {
            $this->command->warn("⚠️  Plan de pagos ya existe para crédito {$credit->id} ({$existingCount} registros), saltando...");
            return;
        }

        $monto = (float) $credit->monto_credito;
        $cuota = (float) $credit->cuota;
        $tasaMensual = ($tasaAnual / 100) / 12;
        $fechaPrimeraCuota = Carbon::now()->addMonth()->startOfMonth();

        // Cuota 0: Desembolso inicial
        // NOTA: El modelo PlanDePago tiene un evento 'created' que automáticamente
        // genera todo el plan de pagos cuando se crea la cuota 0. No necesitamos
        // el loop manual.
        PlanDePago::create([
            'credit_id' => $credit->id,
            'linea' => '1',
            'numero_cuota' => 0,
            'proceso' => $credit->opened_at->format('Ym'),
            'fecha_inicio' => $credit->opened_at,
            'fecha_corte' => $credit->opened_at,
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

        // El modelo PlanDePago se encarga automáticamente de generar
        // las cuotas 1 a N mediante su evento 'created' (ver PlanDePago::booted())
    }

}
