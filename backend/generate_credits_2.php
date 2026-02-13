<?php
/**
 * Script 2: Agrega el credito 2 a cada persona que ya tiene credito 1
 *
 * USO: php generate_credits_2.php
 *
 * PREREQUISITO: Haber ejecutado generate_credits_1.php primero
 *
 * - NO borra datos existentes (preserva credito 1 y sus pagos)
 * - Agrega 1 micro credito nuevo (formalizado HOY) a cada lead que ya tiene credito
 * - Genera planillas mes3 (ambos creditos) y mes4 (ambos + sobrante)
 *
 * FLUJO DE PRUEBA:
 *   1. Ya ejecutaste generate_credits_1.php
 *   2. Ya subiste planillas mes1 y mes2
 *   3. Ejecutar este script
 *   4. Subir planilla mes3 con fecha Abril 2026 → cubre ambos creditos
 *   5. Subir planilla mes4 con fecha Mayo 2026 → ambos + sobrante
 */

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Credit;
use App\Models\PlanDePago;
use App\Models\Person;
use App\Models\Tasa;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

echo "========================================\n";
echo "  GENERADOR DE CREDITOS - SCRIPT 2\n";
echo "  (Agrega credito 2 - Hoy)\n";
echo "========================================\n\n";

// ============================================================
// PASO 1: Verificar que existen creditos del script 1
// ============================================================
echo "1. Verificando creditos existentes...\n";

$creditosExistentes = Credit::where('status', 'Formalizado')
    ->orWhere('status', 'En Mora')
    ->get();

if ($creditosExistentes->isEmpty()) {
    echo "   ERROR: No hay creditos existentes. Ejecuta primero: php generate_credits_1.php\n";
    exit(1);
}

echo "   Creditos existentes: {$creditosExistentes->count()}\n";

// Obtener leads unicos que ya tienen credito
$leadIds = $creditosExistentes->pluck('lead_id')->unique();
echo "   Leads con credito: {$leadIds->count()}\n\n";

// ============================================================
// PASO 2: Cargar datos base
// ============================================================
echo "2. Cargando datos base...\n";

$tasaMicro = Tasa::find(2);
if (!$tasaMicro) {
    echo "   ERROR: No se encontro la tasa micro (ID 2).\n";
    exit(1);
}
echo "   Tasa Micro: {$tasaMicro->tasa}% (ID: {$tasaMicro->id})\n\n";

// ============================================================
// PASO 3: Generar credito 2 por persona
// ============================================================
echo "3. Generando credito 2 por persona...\n";

$year = date('y');
$fechaHoy = Carbon::now();
$montosCredito2 = [100000, 150000, 180000, 200000, 250000, 300000, 350000];
$plazosDisponibles = [12, 18, 24, 30, 36];

$creditosCreados = 0;
$creditosPorDeductora = [1 => 0, 2 => 0, 3 => 0];

// Datos para planillas: deductora => [cedula => [cuota1, cuota2, nombre]]
$planillaData = [
    1 => [],
    2 => [],
    3 => [],
];

foreach ($leadIds as $leadId) {
    $lead = Person::find($leadId);
    if (!$lead || !$lead->cedula) continue;

    // Obtener el credito 1 existente para saber la deductora y cuota
    $credit1 = Credit::where('lead_id', $leadId)
        ->whereIn('status', ['Formalizado', 'En Mora'])
        ->orderBy('formalized_at', 'asc')
        ->first();

    if (!$credit1) continue;

    $deductoraId = $credit1->deductora_id;
    $cuota1 = (float) $credit1->cuota;

    $monto2 = $montosCredito2[array_rand($montosCredito2)];
    $plazo2 = $plazosDisponibles[array_rand($plazosDisponibles)];

    $tasa = $tasaMicro;
    $tasaAnual = (float) $tasa->tasa;
    $tasaMensual = ($tasaAnual / 100) / 12;

    $factor2 = pow(1 + $tasaMensual, $plazo2);
    $cuota2 = round($monto2 * ($tasaMensual * $factor2) / ($factor2 - 1), 2);

    try {
        DB::transaction(function () use (
            $lead, $deductoraId, $tasa, $tasaAnual,
            $monto2, $plazo2, $cuota2, $fechaHoy,
            $cuota1, $year, &$creditosCreados, &$creditosPorDeductora, &$planillaData
        ) {
            $credit2 = new Credit();
            $credit2->reference = 'TEMP-2-' . time() . '-' . mt_rand(1000, 9999);
            $credit2->title = $lead->name . ' ' . ($lead->apellido1 ?? '');
            $credit2->status = 'Formalizado';
            $credit2->category = 'Micro Credito';
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
            $credit2->garantia = 'Pagare';
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
                'tipo_documento' => 'Formalizacion',
                'concepto' => 'Desembolso Inicial',
            ]);

            $creditosCreados++;
            $creditosPorDeductora[$deductoraId]++;

            // Guardar datos para planillas (incluye cuota del credito 1)
            $planillaData[$deductoraId][$lead->cedula] = [
                'nombre' => $lead->name . ' ' . ($lead->apellido1 ?? ''),
                'cuota1' => $cuota1,
                'cuota2' => $cuota2,
                'cuota_total' => round($cuota1 + $cuota2, 2),
            ];
        });
    } catch (\Exception $e) {
        echo "   ERROR con lead {$lead->id} ({$lead->name}): {$e->getMessage()}\n";
    }
}

echo "\n   Creditos 2 creados: {$creditosCreados}\n";
echo "   Por deductora:\n";
echo "     - COOPENACIONAL: {$creditosPorDeductora[1]}\n";
echo "     - COOPESERVICIOS: {$creditosPorDeductora[2]}\n";
echo "     - Coope San Gabriel: {$creditosPorDeductora[3]}\n\n";

// ============================================================
// PASO 4: Generar planillas mes3 y mes4
// ============================================================
echo "4. Generando planillas mes3 y mes4...\n";

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

    // ---- PLANILLA MES 3: Ambos creditos (cuota combinada) ----
    $spreadsheet3 = new Spreadsheet();
    $sheet3 = $spreadsheet3->getActiveSheet();
    $sheet3->setTitle('Planilla Mes 3');
    $sheet3->setCellValue('A1', 'Cedula');
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
    echo "   - {$filename3} (" . count($data) . " registros)\n";

    // ---- PLANILLA MES 4: Ambos + sobrante ₡50,000 ----
    $spreadsheet4 = new Spreadsheet();
    $sheet4 = $spreadsheet4->getActiveSheet();
    $sheet4->setTitle('Planilla Mes 4');
    $sheet4->setCellValue('A1', 'Cedula');
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
    echo "   - {$filename4} (" . count($data) . " registros)\n";
}

echo "\n========================================\n";
echo "  RESUMEN SCRIPT 2\n";
echo "========================================\n";
echo "Creditos 2 agregados: {$creditosCreados}\n";
echo "Total creditos en sistema: " . Credit::count() . "\n";
echo "Planillas generadas: mes3 (ambos) y mes4 (ambos + sobrante)\n";
echo "\nPROXIMOS PASOS:\n";
echo "  1. Subir planilla mes3 con fecha Abr 2026\n";
echo "  2. Subir planilla mes4 con fecha May 2026\n";
echo "========================================\n";
