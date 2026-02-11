<?php
/**
 * Script para generar ~140 créditos de prueba con leads existentes.
 *
 * USO: php generate_credits.php
 *
 * - Borra todos los pagos, planes de pago y créditos existentes
 * - Crea ~140 créditos formalizados con plan de pagos
 * - Mezcla deductoras (COOPENACIONAL, COOPESERVICIOS, Coope San Gabriel)
 * - Genera archivos Excel de planilla por deductora
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
$configRegular = LoanConfiguration::where('tipo', 'regular')->first();
$configMicro = LoanConfiguration::where('tipo', 'microcredito')->first();

if (!$tasaRegular || !$tasaMicro) {
    echo "ERROR: No se encontraron las tasas necesarias.\n";
    exit(1);
}

echo "   Tasa Regular: {$tasaRegular->tasa}% (ID: {$tasaRegular->id})\n";
echo "   Tasa Micro: {$tasaMicro->tasa}% (ID: {$tasaMicro->id})\n";

// Distribución de deductoras: 70% COOPENACIONAL, 15% COOPESERVICIOS, 15% Coope San Gabriel
$deductoraDistribucion = [
    1 => 0.70,  // COOPENACIONAL
    2 => 0.15,  // COOPESERVICIOS
    3 => 0.15,  // Coope San Gabriel R.L
];

echo "\n";

// ============================================================
// PASO 3: Generar créditos
// ============================================================
echo "3. Generando créditos...\n";

$totalCreditos = 140;
$shuffledLeads = $leads->shuffle()->take($totalCreditos);

$creditosCreados = 0;
$creditosPorDeductora = [1 => 0, 2 => 0, 3 => 0];
$creditosPorTipo = ['regular' => 0, 'microcredito' => 0];

$year = date('y');
$fechaFormalizacion = Carbon::now();

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

    // Determinar tipo de crédito (60% regular, 40% micro)
    $esMicro = mt_rand(1, 100) <= 40;

    if ($esMicro) {
        $tipo = 'microcredito';
        $tasa = $tasaMicro;
        $montoMin = 100000;
        $montoMax = 690000;
        $plazoMin = 6;
        $plazoMax = 60;
    } else {
        $tipo = 'regular';
        $tasa = $tasaRegular;
        $montoMin = 690000;
        $montoMax = 2200000;
        $plazoMin = 12;
        $plazoMax = 60;
    }

    // Generar monto aleatorio (redondeado a miles)
    $monto = round(mt_rand($montoMin, $montoMax) / 1000) * 1000;

    // Generar plazo aleatorio (múltiplos de 6 preferidos)
    $plazosComunes = $esMicro
        ? [6, 12, 18, 24, 30, 36]
        : [12, 18, 24, 30, 36, 42, 48, 54, 60];
    $plazo = $plazosComunes[array_rand($plazosComunes)];

    // Calcular cuota (sistema francés)
    $tasaMensual = ((float) $tasa->tasa / 100) / 12;
    if ($tasaMensual > 0) {
        $factor = pow(1 + $tasaMensual, $plazo);
        $cuotaFija = round($monto * ($tasaMensual * $factor) / ($factor - 1), 2);
    } else {
        $cuotaFija = round($monto / $plazo, 2);
    }

    try {
        DB::transaction(function () use (
            $lead, $deductoraId, $tipo, $tasa, $monto, $plazo, $cuotaFija, $esMicro,
            $fechaFormalizacion, $year, &$creditosCreados, &$creditosPorDeductora, &$creditosPorTipo
        ) {
            // Crear crédito
            $credit = new Credit();
            $credit->reference = 'TEMP-' . time() . '-' . mt_rand(1000, 9999);
            $credit->title = $lead->name . ' ' . ($lead->apellido1 ?? '');
            $credit->status = 'Formalizado';
            $credit->category = $tipo === 'microcredito' ? 'Micro Crédito' : 'Crédito Regular';
            $credit->lead_id = $lead->id;
            $credit->assigned_to = null;
            $credit->opened_at = $fechaFormalizacion;
            $credit->tipo_credito = $tipo;
            $credit->monto_credito = $monto;
            $credit->cuota = $cuotaFija;
            $credit->plazo = $plazo;
            $credit->tasa_id = $tasa->id;
            $credit->tasa_anual = $tasa->tasa;
            $credit->tasa_maxima = $tasa->tasa_maxima;
            $credit->deductora_id = $deductoraId;
            $credit->saldo = $monto;
            $credit->poliza = false; // Los microcréditos NO llevan póliza
            $credit->garantia = 'Pagaré';
            $credit->formalized_at = $fechaFormalizacion;
            $credit->save();

            // Referencia real
            $credit->reference = sprintf('%s-%05d-01-CRED', $year, $credit->id);
            $credit->save();

            // Actualizar deductora del lead
            $lead->deductora_id = $deductoraId;
            $lead->save();

            // Generar plan de pagos - Cuota 0 (inicialización)
            $tasaAnual = (float) $tasa->tasa;
            $tasaMensual = ($tasaAnual / 100) / 12;

            PlanDePago::create([
                'credit_id' => $credit->id,
                'linea' => '1',
                'numero_cuota' => 0,
                'proceso' => $fechaFormalizacion->format('Ym'),
                'fecha_inicio' => $fechaFormalizacion,
                'fecha_corte' => null,
                'fecha_pago' => null,
                'tasa_actual' => $tasaAnual,
                'plazo_actual' => $plazo,
                'cuota' => 0,
                'poliza' => 0,
                'interes_corriente' => 0,
                'int_corriente_vencido' => 0,
                'interes_moratorio' => 0,
                'amortizacion' => 0,
                'saldo_anterior' => 0,
                'saldo_nuevo' => $monto,
                'dias' => 0,
                'estado' => 'Vigente',
                'dias_mora' => 0,
                'fecha_movimiento' => $fechaFormalizacion,
                'movimiento_total' => $monto,
                'movimiento_poliza' => 0,
                'movimiento_interes_corriente' => 0,
                'movimiento_interes_moratorio' => 0,
                'movimiento_principal' => $monto,
                'movimiento_amortizacion' => 0,
                'movimiento_caja_usuario' => 'Sistema',
                'tipo_documento' => 'Formalización',
                'concepto' => 'Desembolso Inicial',
            ]);

            // Las cuotas 1-N se generan automáticamente por el observer de PlanDePago::booted()

            // Calcular fecha culminación
            $credit->fecha_culminacion_credito = $fechaFormalizacion->copy()->addMonths($plazo);
            $credit->save();

            $creditosCreados++;
            $creditosPorDeductora[$deductoraId]++;
            $creditosPorTipo[$tipo]++;
        });

        if (($creditosCreados % 20) === 0) {
            echo "   Progreso: {$creditosCreados}/{$totalCreditos}\n";
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
echo "   Por tipo:\n";
echo "     - Regular: {$creditosPorTipo['regular']}\n";
echo "     - Micro-crédito: {$creditosPorTipo['microcredito']}\n";

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
    $credits = Credit::with('lead')
        ->where('status', 'Formalizado')
        ->where('deductora_id', $dedId)
        ->where('cuota', '>', 0)
        ->get();

    if ($credits->isEmpty()) {
        echo "   - {$dedNombre}: Sin créditos, saltando...\n";
        continue;
    }

    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Planilla');

    // Encabezados
    $sheet->setCellValue('A1', 'Cédula');
    $sheet->setCellValue('B1', 'Monto');
    $sheet->setCellValue('C1', 'Nombre');

    // Estilo encabezados
    $sheet->getStyle('A1:C1')->getFont()->setBold(true);
    $sheet->getStyle('A1:C1')->getFill()
        ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
        ->getStartColor()->setRGB('4472C4');
    $sheet->getStyle('A1:C1')->getFont()->getColor()->setRGB('FFFFFF');

    $row = 2;
    foreach ($credits as $c) {
        if ($c->lead && $c->lead->cedula) {
            $sheet->setCellValue('A' . $row, $c->lead->cedula);
            $sheet->setCellValue('B' . $row, (float) $c->cuota);
            $sheet->setCellValue('C' . $row, $c->lead->name . ' ' . ($c->lead->apellido1 ?? ''));
            $row++;
        }
    }

    // Autosize
    $sheet->getColumnDimension('A')->setAutoSize(true);
    $sheet->getColumnDimension('B')->setAutoSize(true);
    $sheet->getColumnDimension('C')->setAutoSize(true);

    // Formato numérico para montos
    $sheet->getStyle('B2:B' . ($row - 1))->getNumberFormat()
        ->setFormatCode('#,##0.00');

    $filename = "planilla_{$dedNombre}.xlsx";
    $filepath = storage_path("app/public/{$filename}");
    $writer = new Xlsx($spreadsheet);
    $writer->save($filepath);

    $totalRegistros = $row - 2;
    echo "   ✓ {$filename} ({$totalRegistros} registros)\n";
}

// También generar una planilla combinada con TODAS las deductoras
$allCredits = Credit::with('lead')
    ->where('status', 'Formalizado')
    ->where('cuota', '>', 0)
    ->get();

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle('Planilla Completa');

$sheet->setCellValue('A1', 'Cédula');
$sheet->setCellValue('B1', 'Monto');
$sheet->setCellValue('C1', 'Nombre');
$sheet->setCellValue('D1', 'Deductora');

$sheet->getStyle('A1:D1')->getFont()->setBold(true);
$sheet->getStyle('A1:D1')->getFill()
    ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
    ->getStartColor()->setRGB('4472C4');
$sheet->getStyle('A1:D1')->getFont()->getColor()->setRGB('FFFFFF');

$row = 2;
foreach ($allCredits as $c) {
    if ($c->lead && $c->lead->cedula) {
        $sheet->setCellValue('A' . $row, $c->lead->cedula);
        $sheet->setCellValue('B' . $row, (float) $c->cuota);
        $sheet->setCellValue('C' . $row, $c->lead->name . ' ' . ($c->lead->apellido1 ?? ''));
        $sheet->setCellValue('D' . $row, $deductoraNombres[$c->deductora_id] ?? 'N/A');
        $row++;
    }
}

foreach (['A', 'B', 'C', 'D'] as $col) {
    $sheet->getColumnDimension($col)->setAutoSize(true);
}
$sheet->getStyle('B2:B' . ($row - 1))->getNumberFormat()->setFormatCode('#,##0.00');

$writer = new Xlsx($spreadsheet);
$writer->save(storage_path('app/public/planilla_TODAS.xlsx'));
echo "   ✓ planilla_TODAS.xlsx (" . ($row - 2) . " registros)\n";

echo "\n========================================\n";
echo "  RESUMEN FINAL\n";
echo "========================================\n";
echo "Créditos creados: {$creditosCreados}\n";
echo "Planes de pago generados: " . PlanDePago::count() . "\n";
echo "Archivos Excel en: storage/app/public/\n";
echo "========================================\n";
