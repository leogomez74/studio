<?php
/**
 * Script 1: Genera SOLO el crédito 1 por persona (Formalizado Diciembre 2025)
 *
 * USO: php generate_credits_1.php
 *
 * - Borra todos los pagos, planes de pago y créditos existentes
 * - Cada lead recibe 1 micro crédito formalizado en Diciembre 2025
 * - Genera planillas mes1 y mes2 (solo cuota del crédito 1)
 *
 * FLUJO DE PRUEBA:
 *   1. Ejecutar este script
 *   2. Subir planilla mes1 con fecha Febrero 2026 → cubre cuota Enero del crédito 1
 *   3. Subir planilla mes2 con fecha Marzo 2026 → cubre cuota Febrero del crédito 1
 *   4. Ejecutar generate_credits_2.php para crear el crédito 2
 *   5. Subir planilla mes3 con fecha Abril 2026 → cubre ambos créditos
 */

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Credit;
use App\Models\CreditPayment;
use App\Models\PlanDePago;
use App\Models\PlanillaUpload;
use App\Models\SaldoPendiente;
use App\Models\Person;
use App\Models\Tasa;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

echo "========================================\n";
echo "  GENERADOR DE CREDITOS - SCRIPT 1\n";
echo "  (Solo credito 1 - Diciembre 2025)\n";
echo "========================================\n\n";

// ============================================================
// PASO 1: Borrar todo lo existente
// ============================================================
echo "1. Limpiando datos existentes...\n";

$saldosDeleted = SaldoPendiente::count();
SaldoPendiente::query()->delete();
echo "   - Saldos pendientes eliminados: {$saldosDeleted}\n";

$paymentsDeleted = CreditPayment::count();
CreditPayment::query()->delete();
echo "   - Pagos eliminados: {$paymentsDeleted}\n";

$planillasDeleted = PlanillaUpload::count();
PlanillaUpload::query()->delete();
echo "   - Planillas eliminadas: {$planillasDeleted}\n";

$planesDeleted = PlanDePago::count();
PlanDePago::query()->delete();
echo "   - Planes de pago eliminados: {$planesDeleted}\n";

$creditsDeleted = Credit::count();
Credit::query()->delete();
echo "   - Creditos eliminados: {$creditsDeleted}\n";

// Reset auto-increment
DB::statement('ALTER TABLE saldos_pendientes AUTO_INCREMENT = 1');
DB::statement('ALTER TABLE credit_payments AUTO_INCREMENT = 1');
DB::statement('ALTER TABLE planilla_uploads AUTO_INCREMENT = 1');
DB::statement('ALTER TABLE plan_de_pagos AUTO_INCREMENT = 1');
DB::statement('ALTER TABLE credits AUTO_INCREMENT = 1');

echo "\n";

// ============================================================
// PASO 2: Cargar datos base
// ============================================================
echo "2. Cargando datos base...\n";

$leads = Person::whereNotNull('cedula')->where('cedula', '!=', '')->get();
echo "   Leads disponibles: {$leads->count()}\n";

$tasaMicro = Tasa::find(2); // 51.21%

if (!$tasaMicro) {
    echo "ERROR: No se encontro la tasa micro (ID 2).\n";
    exit(1);
}

echo "   Tasa Micro: {$tasaMicro->tasa}% (ID: {$tasaMicro->id})\n\n";

// ============================================================
// PASO 3: Generar credito 1 por persona
// ============================================================
echo "3. Generando credito 1 por persona...\n";

$totalLeads = min(70, $leads->count());
$shuffledLeads = $leads->shuffle()->take($totalLeads);

$creditosCreados = 0;
$creditosPorDeductora = [1 => 0, 2 => 0, 3 => 0];
$year = date('y');
$fechaDiciembre = Carbon::parse('2025-12-01');

$montosCredito1 = [200000, 250000, 300000, 350000, 400000, 450000, 500000, 550000, 600000, 650000];
$plazosDisponibles = [12, 18, 24, 30, 36];

// Datos para planillas (cédula => [cuota1, nombre])
$planillaData = [
    1 => [], // COOPENACIONAL
    2 => [], // COOPESERVICIOS
    3 => [], // Coope San Gabriel
];

foreach ($shuffledLeads as $index => $lead) {
    // Determinar deductora
    $rand = mt_rand(1, 100);
    if ($rand <= 70) {
        $deductoraId = 1;
    } elseif ($rand <= 85) {
        $deductoraId = 2;
    } else {
        $deductoraId = 3;
    }

    $monto1 = $montosCredito1[array_rand($montosCredito1)];
    $plazo1 = $plazosDisponibles[array_rand($plazosDisponibles)];

    $tasa = $tasaMicro;
    $tasaAnual = (float) $tasa->tasa;
    $tasaMensual = ($tasaAnual / 100) / 12;

    // Calcular cuota (sistema frances)
    $factor1 = pow(1 + $tasaMensual, $plazo1);
    $cuota1 = round($monto1 * ($tasaMensual * $factor1) / ($factor1 - 1), 2);

    try {
        DB::transaction(function () use (
            $lead, $deductoraId, $tasa, $tasaAnual,
            $monto1, $plazo1, $cuota1, $fechaDiciembre,
            $year, &$creditosCreados, &$creditosPorDeductora, &$planillaData
        ) {
            $credit1 = new Credit();
            $credit1->reference = 'TEMP-1-' . time() . '-' . mt_rand(1000, 9999);
            $credit1->title = $lead->name . ' ' . ($lead->apellido1 ?? '');
            $credit1->status = 'Formalizado';
            $credit1->category = 'Micro Credito';
            $credit1->lead_id = $lead->id;
            $credit1->assigned_to = null;
            $credit1->opened_at = $fechaDiciembre;
            $credit1->tipo_credito = 'microcredito';
            $credit1->monto_credito = $monto1;
            $credit1->cuota = $cuota1;
            $credit1->plazo = $plazo1;
            $credit1->tasa_id = $tasa->id;
            $credit1->tasa_anual = $tasaAnual;
            $credit1->tasa_maxima = $tasa->tasa_maxima;
            $credit1->deductora_id = $deductoraId;
            $credit1->saldo = $monto1;
            $credit1->poliza = false;
            $credit1->garantia = 'Pagare';
            $credit1->formalized_at = $fechaDiciembre;
            $credit1->fecha_culminacion_credito = $fechaDiciembre->copy()->addMonths($plazo1);
            $credit1->save();

            $credit1->reference = sprintf('%s-%05d-01-CRED', $year, $credit1->id);
            $credit1->save();

            // Plan de pagos - Cuota 0 (desembolso)
            PlanDePago::create([
                'credit_id' => $credit1->id,
                'linea' => '1',
                'numero_cuota' => 0,
                'proceso' => $fechaDiciembre->format('Ym'),
                'fecha_inicio' => $fechaDiciembre,
                'fecha_corte' => null,
                'fecha_pago' => null,
                'tasa_actual' => $tasaAnual,
                'plazo_actual' => $plazo1,
                'cuota' => 0,
                'poliza' => 0,
                'interes_corriente' => 0,
                'int_corriente_vencido' => 0,
                'interes_moratorio' => 0,
                'amortizacion' => 0,
                'saldo_anterior' => 0,
                'saldo_nuevo' => $monto1,
                'dias' => 0,
                'estado' => 'Vigente',
                'dias_mora' => 0,
                'fecha_movimiento' => $fechaDiciembre,
                'movimiento_total' => $monto1,
                'movimiento_poliza' => 0,
                'movimiento_interes_corriente' => 0,
                'movimiento_interes_moratorio' => 0,
                'movimiento_principal' => $monto1,
                'movimiento_amortizacion' => 0,
                'movimiento_caja_usuario' => 'Sistema',
                'tipo_documento' => 'Formalizacion',
                'concepto' => 'Desembolso Inicial',
            ]);

            // Actualizar deductora del lead
            $lead->deductora_id = $deductoraId;
            $lead->save();

            $creditosCreados++;
            $creditosPorDeductora[$deductoraId]++;

            // Guardar datos para planillas
            $planillaData[$deductoraId][$lead->cedula] = [
                'nombre' => $lead->name . ' ' . ($lead->apellido1 ?? ''),
                'cuota1' => $cuota1,
            ];
        });

        if (($index + 1) % 20 === 0) {
            echo "   Progreso: " . ($index + 1) . "/{$totalLeads} leads procesados\n";
        }
    } catch (\Exception $e) {
        echo "   ERROR con lead {$lead->id} ({$lead->name}): {$e->getMessage()}\n";
    }
}

echo "\n   Creditos creados: {$creditosCreados}\n";
echo "   Por deductora:\n";
echo "     - COOPENACIONAL: {$creditosPorDeductora[1]}\n";
echo "     - COOPESERVICIOS: {$creditosPorDeductora[2]}\n";
echo "     - Coope San Gabriel: {$creditosPorDeductora[3]}\n\n";

// ============================================================
// PASO 4: Generar planillas mes1 y mes2
// ============================================================
echo "4. Generando planillas mes1 y mes2...\n";

$deductoraNombres = [
    1 => 'COOPENACIONAL',
    2 => 'COOPESERVICIOS',
    3 => 'Coope_San_Gabriel',
];

foreach ($deductoraNombres as $dedId => $dedNombre) {
    $data = $planillaData[$dedId] ?? [];
    if (empty($data)) {
        echo "   - {$dedNombre}: Sin creditos, saltando...\n";
        continue;
    }

    // ---- PLANILLA MES 1 ----
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Planilla Mes 1');
    $sheet->setCellValue('A1', 'Cedula');
    $sheet->setCellValue('B1', 'Monto');
    $sheet->setCellValue('C1', 'Nombre');
    $sheet->getStyle('A1:C1')->getFont()->setBold(true);
    $sheet->getStyle('A1:C1')->getFill()
        ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
        ->getStartColor()->setRGB('4472C4');
    $sheet->getStyle('A1:C1')->getFont()->getColor()->setRGB('FFFFFF');

    $row = 2;
    foreach ($data as $cedula => $info) {
        $sheet->setCellValue('A' . $row, $cedula);
        $sheet->setCellValue('B' . $row, $info['cuota1']);
        $sheet->setCellValue('C' . $row, $info['nombre']);
        $row++;
    }
    foreach (['A', 'B', 'C'] as $col) $sheet->getColumnDimension($col)->setAutoSize(true);
    $sheet->getStyle('B2:B' . ($row - 1))->getNumberFormat()->setFormatCode('#,##0.00');

    $filename = "planilla_{$dedNombre}_mes1_solo_credito1.xlsx";
    $writer = new Xlsx($spreadsheet);
    $writer->save(storage_path("app/public/{$filename}"));
    echo "   - {$filename} (" . count($data) . " registros)\n";

    // ---- PLANILLA MES 2 (igual al mes 1) ----
    $filename2 = "planilla_{$dedNombre}_mes2_solo_credito1.xlsx";
    $writer->save(storage_path("app/public/{$filename2}"));
    echo "   - {$filename2} (" . count($data) . " registros)\n";
}

echo "\n========================================\n";
echo "  RESUMEN SCRIPT 1\n";
echo "========================================\n";
echo "Creditos creados: {$creditosCreados} (1 por persona)\n";
echo "Planes de pago: " . PlanDePago::count() . "\n";
echo "Planillas generadas: mes1 y mes2 (solo cuota credito 1)\n";
echo "\nPROXIMOS PASOS:\n";
echo "  1. Subir planilla mes1 con fecha Feb 2026\n";
echo "  2. Subir planilla mes2 con fecha Mar 2026\n";
echo "  3. Ejecutar: php generate_credits_2.php\n";
echo "  4. Subir planilla mes3 con fecha Abr 2026\n";
echo "========================================\n";
