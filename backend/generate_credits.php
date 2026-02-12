<?php
/**
 * Script para generar créditos de prueba con 2 créditos por persona.
 *
 * USO: php generate_credits.php
 *
 * - Borra todos los pagos, planes de pago y créditos existentes
 * - Cada lead recibe 2 micro créditos:
 *   - Crédito 1: Formalizado en Diciembre 2025 (viejo)
 *   - Crédito 2: Formalizado hoy (nuevo)
 * - Mezcla deductoras (COOPENACIONAL, COOPESERVICIOS, Coope San Gabriel)
 * - Genera archivos Excel de planilla:
 *   - Meses 1-2: Solo cuota del crédito 1
 *   - Mes 3: Cuota de ambos créditos combinada
 *   - Mes 4: Ambos créditos + ₡50,000 sobrante
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
use App\Models\LoanConfiguration;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

echo "========================================\n";
echo "  GENERADOR DE CRÉDITOS DE PRUEBA\n";
echo "  (2 créditos por persona)\n";
echo "========================================\n\n";

// ============================================================
// PASO 1: Borrar todo lo existente
// ============================================================
echo "1. Limpiando datos existentes...\n";

$saldosDeleted = SaldoPendiente::count();
SaldoPendiente::query()->delete();
echo "   ✓ Saldos pendientes eliminados: {$saldosDeleted}\n";

$paymentsDeleted = CreditPayment::count();
CreditPayment::query()->delete();
echo "   ✓ Pagos eliminados: {$paymentsDeleted}\n";

$planillasDeleted = PlanillaUpload::count();
PlanillaUpload::query()->delete();
echo "   ✓ Planillas eliminadas: {$planillasDeleted}\n";

$planesDeleted = PlanDePago::count();
PlanDePago::query()->delete();
echo "   ✓ Planes de pago eliminados: {$planesDeleted}\n";

$creditsDeleted = Credit::count();
Credit::query()->delete();
echo "   ✓ Créditos eliminados: {$creditsDeleted}\n";

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

$tasaRegular = Tasa::find(1);    // 36%
$tasaMicro = Tasa::find(2);      // 51.21%

if (!$tasaRegular || !$tasaMicro) {
    echo "ERROR: No se encontraron las tasas necesarias.\n";
    exit(1);
}

echo "   Tasa Regular: {$tasaRegular->tasa}% (ID: {$tasaRegular->id})\n";
echo "   Tasa Micro: {$tasaMicro->tasa}% (ID: {$tasaMicro->id})\n";

echo "\n";

// ============================================================
// PASO 3: Generar créditos (2 por persona)
// ============================================================
echo "3. Generando créditos (2 por persona)...\n";

// Usamos hasta 70 leads = 140 créditos
$totalLeads = min(70, $leads->count());
$shuffledLeads = $leads->shuffle()->take($totalLeads);

$creditosCreados = 0;
$creditosPorDeductora = [1 => 0, 2 => 0, 3 => 0];

$year = date('y');
$fechaDiciembre = Carbon::parse('2025-12-01');
$fechaHoy = Carbon::now();

// Rangos de montos para cada crédito
$montosCredito1 = [200000, 250000, 300000, 350000, 400000, 450000, 500000, 550000, 600000, 650000];
$montosCredito2 = [100000, 150000, 180000, 200000, 250000, 300000, 350000];
$plazosDisponibles = [12, 18, 24, 30, 36];

// Datos para planillas (cédula => [cuota1, cuota2, nombre])
$planillaData = [
    1 => [], // COOPENACIONAL
    2 => [], // COOPESERVICIOS
    3 => [], // Coope San Gabriel
];

foreach ($shuffledLeads as $index => $lead) {
    // Determinar deductora
    $rand = mt_rand(1, 100);
    if ($rand <= 70) {
        $deductoraId = 1; // COOPENACIONAL
    } elseif ($rand <= 85) {
        $deductoraId = 2; // COOPESERVICIOS
    } else {
        $deductoraId = 3; // Coope San Gabriel
    }

    // Montos y plazos aleatorios
    $monto1 = $montosCredito1[array_rand($montosCredito1)];
    $monto2 = $montosCredito2[array_rand($montosCredito2)];
    $plazo1 = $plazosDisponibles[array_rand($plazosDisponibles)];
    $plazo2 = $plazosDisponibles[array_rand($plazosDisponibles)];

    // Usar tasa micro para ambos
    $tasa = $tasaMicro;
    $tasaAnual = (float) $tasa->tasa;
    $tasaMensual = ($tasaAnual / 100) / 12;

    // Calcular cuotas (sistema francés)
    $factor1 = pow(1 + $tasaMensual, $plazo1);
    $cuota1 = round($monto1 * ($tasaMensual * $factor1) / ($factor1 - 1), 2);

    $factor2 = pow(1 + $tasaMensual, $plazo2);
    $cuota2 = round($monto2 * ($tasaMensual * $factor2) / ($factor2 - 1), 2);

    try {
        DB::transaction(function () use (
            $lead, $deductoraId, $tasa, $tasaAnual, $tasaMensual,
            $monto1, $plazo1, $cuota1, $fechaDiciembre,
            $monto2, $plazo2, $cuota2, $fechaHoy,
            $year, &$creditosCreados, &$creditosPorDeductora, &$planillaData
        ) {
            // ---- CRÉDITO 1: Formalizado Diciembre 2025 ----
            $credit1 = new Credit();
            $credit1->reference = 'TEMP-1-' . time() . '-' . mt_rand(1000, 9999);
            $credit1->title = $lead->name . ' ' . ($lead->apellido1 ?? '');
            $credit1->status = 'Formalizado';
            $credit1->category = 'Micro Crédito';
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
            $credit1->garantia = 'Pagaré';
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
                'tipo_documento' => 'Formalización',
                'concepto' => 'Desembolso Inicial',
            ]);

            // ---- CRÉDITO 2: Formalizado HOY ----
            $credit2 = new Credit();
            $credit2->reference = 'TEMP-2-' . time() . '-' . mt_rand(1000, 9999);
            $credit2->title = $lead->name . ' ' . ($lead->apellido1 ?? '');
            $credit2->status = 'Formalizado';
            $credit2->category = 'Micro Crédito';
            $credit2->lead_id = $lead->id;
            $credit2->assigned_to = null;
            $credit2->opened_at = $fechaHoy;
            $credit2->tipo_credito = 'microcredito';
            $credit2->monto_credito = $monto2;
            $credit2->cuota = $cuota2;
            $credit2->plazo = $plazo2;
            $credit2->tasa_id = $tasa->id;
            $credit2->tasa_anual = $tasaAnual;
            $credit2->tasa_maxima = $tasa->tasa_maxima;
            $credit2->deductora_id = $deductoraId;
            $credit2->saldo = $monto2;
            $credit2->poliza = false;
            $credit2->garantia = 'Pagaré';
            $credit2->formalized_at = $fechaHoy;
            $credit2->fecha_culminacion_credito = $fechaHoy->copy()->addMonths($plazo2);
            $credit2->save();

            $credit2->reference = sprintf('%s-%05d-01-CRED', $year, $credit2->id);
            $credit2->save();

            // Plan de pagos - Cuota 0 (desembolso)
            PlanDePago::create([
                'credit_id' => $credit2->id,
                'linea' => '1',
                'numero_cuota' => 0,
                'proceso' => $fechaHoy->format('Ym'),
                'fecha_inicio' => $fechaHoy,
                'fecha_corte' => null,
                'fecha_pago' => null,
                'tasa_actual' => $tasaAnual,
                'plazo_actual' => $plazo2,
                'cuota' => 0,
                'poliza' => 0,
                'interes_corriente' => 0,
                'int_corriente_vencido' => 0,
                'interes_moratorio' => 0,
                'amortizacion' => 0,
                'saldo_anterior' => 0,
                'saldo_nuevo' => $monto2,
                'dias' => 0,
                'estado' => 'Vigente',
                'dias_mora' => 0,
                'fecha_movimiento' => $fechaHoy,
                'movimiento_total' => $monto2,
                'movimiento_poliza' => 0,
                'movimiento_interes_corriente' => 0,
                'movimiento_interes_moratorio' => 0,
                'movimiento_principal' => $monto2,
                'movimiento_amortizacion' => 0,
                'movimiento_caja_usuario' => 'Sistema',
                'tipo_documento' => 'Formalización',
                'concepto' => 'Desembolso Inicial',
            ]);

            // Actualizar deductora del lead
            $lead->deductora_id = $deductoraId;
            $lead->save();

            $creditosCreados += 2;
            $creditosPorDeductora[$deductoraId] += 2;

            // Guardar datos para planillas
            $cedula = $lead->cedula;
            $nombre = $lead->name . ' ' . ($lead->apellido1 ?? '');
            $planillaData[$deductoraId][$cedula] = [
                'nombre' => $nombre,
                'cuota1' => $cuota1,
                'cuota2' => $cuota2,
                'cuota_total' => round($cuota1 + $cuota2, 2),
            ];
        });

        if (($index + 1) % 20 === 0) {
            echo "   Progreso: " . ($index + 1) . "/{$totalLeads} leads procesados\n";
        }
    } catch (\Exception $e) {
        echo "   ✗ Error con lead {$lead->id} ({$lead->name}): {$e->getMessage()}\n";
    }
}

echo "\n   ✓ Créditos creados: {$creditosCreados}\n";
echo "   Por deductora:\n";
echo "     - COOPENACIONAL: {$creditosPorDeductora[1]}\n";
echo "     - COOPESERVICIOS: {$creditosPorDeductora[2]}\n";
echo "     - Coope San Gabriel: {$creditosPorDeductora[3]}\n";

echo "\n";

// ============================================================
// PASO 4: Generar archivos Excel de planilla por deductora
// ============================================================
echo "4. Generando archivos Excel de planilla...\n";

$deductoraNombres = [
    1 => 'COOPENACIONAL',
    2 => 'COOPESERVICIOS',
    3 => 'Coope_San_Gabriel',
];

foreach ($deductoraNombres as $dedId => $dedNombre) {
    $data = $planillaData[$dedId] ?? [];
    if (empty($data)) {
        echo "   - {$dedNombre}: Sin créditos, saltando...\n";
        continue;
    }

    // ---- PLANILLA MES 1: Solo crédito 1 (viejo, Diciembre) ----
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Planilla Mes 1');
    $sheet->setCellValue('A1', 'Cédula');
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
    echo "   ✓ {$filename} (" . count($data) . " registros) - Solo cuota crédito viejo\n";

    // ---- PLANILLA MES 2: Solo crédito 1 (igual al mes 1) ----
    $filename2 = "planilla_{$dedNombre}_mes2_solo_credito1.xlsx";
    $writer->save(storage_path("app/public/{$filename2}"));
    echo "   ✓ {$filename2} (" . count($data) . " registros) - Solo cuota crédito viejo\n";

    // ---- PLANILLA MES 3: Ambos créditos (cuota combinada) ----
    $spreadsheet3 = new Spreadsheet();
    $sheet3 = $spreadsheet3->getActiveSheet();
    $sheet3->setTitle('Planilla Mes 3');
    $sheet3->setCellValue('A1', 'Cédula');
    $sheet3->setCellValue('B1', 'Monto');
    $sheet3->setCellValue('C1', 'Nombre');
    $sheet3->getStyle('A1:C1')->getFont()->setBold(true);
    $sheet3->getStyle('A1:C1')->getFill()
        ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
        ->getStartColor()->setRGB('28A745');
    $sheet3->getStyle('A1:C1')->getFont()->getColor()->setRGB('FFFFFF');

    $row = 2;
    foreach ($data as $cedula => $info) {
        $sheet3->setCellValue('A' . $row, $cedula);
        $sheet3->setCellValue('B' . $row, $info['cuota_total']);
        $sheet3->setCellValue('C' . $row, $info['nombre']);
        $row++;
    }
    foreach (['A', 'B', 'C'] as $col) $sheet3->getColumnDimension($col)->setAutoSize(true);
    $sheet3->getStyle('B2:B' . ($row - 1))->getNumberFormat()->setFormatCode('#,##0.00');

    $filename3 = "planilla_{$dedNombre}_mes3_ambos_creditos.xlsx";
    $writer3 = new Xlsx($spreadsheet3);
    $writer3->save(storage_path("app/public/{$filename3}"));
    echo "   ✓ {$filename3} (" . count($data) . " registros) - Cuota combinada ambos créditos\n";

    // ---- PLANILLA MES 4: Ambos + sobrante ₡50,000 ----
    $spreadsheet4 = new Spreadsheet();
    $sheet4 = $spreadsheet4->getActiveSheet();
    $sheet4->setTitle('Planilla Mes 4');
    $sheet4->setCellValue('A1', 'Cédula');
    $sheet4->setCellValue('B1', 'Monto');
    $sheet4->setCellValue('C1', 'Nombre');
    $sheet4->getStyle('A1:C1')->getFont()->setBold(true);
    $sheet4->getStyle('A1:C1')->getFill()
        ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
        ->getStartColor()->setRGB('DC3545');
    $sheet4->getStyle('A1:C1')->getFont()->getColor()->setRGB('FFFFFF');

    $row = 2;
    foreach ($data as $cedula => $info) {
        $sheet4->setCellValue('A' . $row, $cedula);
        $sheet4->setCellValue('B' . $row, round($info['cuota_total'] + 50000, 2));
        $sheet4->setCellValue('C' . $row, $info['nombre']);
        $row++;
    }
    foreach (['A', 'B', 'C'] as $col) $sheet4->getColumnDimension($col)->setAutoSize(true);
    $sheet4->getStyle('B2:B' . ($row - 1))->getNumberFormat()->setFormatCode('#,##0.00');

    $filename4 = "planilla_{$dedNombre}_mes4_con_sobrante.xlsx";
    $writer4 = new Xlsx($spreadsheet4);
    $writer4->save(storage_path("app/public/{$filename4}"));
    echo "   ✓ {$filename4} (" . count($data) . " registros) - Ambos + ₡50,000 sobrante\n";

    echo "\n";
}

echo "\n========================================\n";
echo "  RESUMEN FINAL\n";
echo "========================================\n";
echo "Créditos creados: {$creditosCreados}\n";
echo "Planes de pago generados: " . PlanDePago::count() . "\n";
echo "\nPlanillas generadas por deductora:\n";
echo "  - mes1/mes2: Solo cuota crédito 1 (Dic 2025)\n";
echo "  - mes3: Cuota combinada ambos créditos\n";
echo "  - mes4: Ambos + ₡50,000 sobrante por persona\n";
echo "\nArchivos Excel en: storage/app/public/\n";
echo "========================================\n";
