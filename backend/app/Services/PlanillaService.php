<?php

namespace App\Services;

use App\Models\Credit;
use App\Models\CreditPayment;
use App\Models\LoanConfiguration;
use App\Models\PlanillaUpload;
use App\Models\SaldoPendiente;
use App\Traits\AccountingTrigger;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\Csv;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class PlanillaService
{
    use AccountingTrigger;

    protected PaymentProcessingService $paymentProcessing;
    protected MoraService $mora;

    public function __construct(PaymentProcessingService $paymentProcessing, MoraService $mora)
    {
        $this->paymentProcessing = $paymentProcessing;
        $this->mora = $mora;
    }

    /**
     * Preliminar de planilla - Analiza sin aplicar cambios
     */
    public function previewPlanilla(array $validated, $file)
    {
        $deductoraId = $validated['deductora_id'];
        $fechaProceso = $validated['fecha_proceso'] ?? now()->format('Y-m-d');

        // VALIDACIÓN: Solo 1 planilla por deductora por mes (excluir anuladas)
        $fechaProcesoCarbon = Carbon::parse($fechaProceso);
        $mesInicio = $fechaProcesoCarbon->copy()->startOfMonth();
        $mesFin = $fechaProcesoCarbon->copy()->endOfMonth();
        $yaExiste = CreditPayment::where('source', 'Planilla')
            ->where(function ($q) {
                $q->whereNull('estado_reverso')
                  ->orWhere('estado_reverso', '!=', 'Anulado');
            })
            ->whereBetween('fecha_pago', [$mesInicio, $mesFin])
            ->whereHas('credit', function ($q) use ($deductoraId) {
                $q->where('deductora_id', $deductoraId);
            })
            ->exists();

        if ($yaExiste) {
            $deductoraNombre = \App\Models\Deductora::find($deductoraId)->nombre ?? 'Desconocida';
            $mesNombre = $fechaProcesoCarbon->translatedFormat('F Y');
            return response()->json([
                'message' => "La planilla del mes de {$mesNombre} correspondiente a {$deductoraNombre} ya ha sido cargada.",
                'deductora' => $deductoraNombre,
                'mes' => $mesNombre,
            ], 422);
        }

        $path = $file->store('uploads/planillas_preview', 'public');
        $fullPath = storage_path('app/public/' . $path);

        $preview = [];
        $totales = [
            'total_registros' => 0,
            'completos' => 0,
            'parciales' => 0,
            'sobrepagos' => 0,
            'no_encontrados' => 0,
            'monto_total_planilla' => 0,
            'monto_total_esperado' => 0,
            'diferencia_total' => 0,
        ];

        try {
            $readerType = IOFactory::identify($fullPath);
            $reader = IOFactory::createReader($readerType);

            $delimiter = ',';
            if ($readerType === 'Csv') {
                $handle = fopen($fullPath, 'r');
                if ($handle) {
                    $sample = '';
                    $lineCount = 0;
                    while (($line = fgets($handle)) !== false && $lineCount < 5) {
                        $sample .= $line;
                        $lineCount++;
                    }
                    fclose($handle);
                    if (substr_count($sample, ';') > substr_count($sample, ',')) {
                        $delimiter = ';';
                    }
                }
                if ($reader instanceof Csv) {
                    $reader->setDelimiter($delimiter);
                }
            }

            $spreadsheet = $reader->load($fullPath);
            $rows = $spreadsheet->getActiveSheet()->toArray(null, true, true, true);
            $header = reset($rows);

            // Detectar columnas
            $montoCol = null;
            $cedulaCol = null;
            $columnasEncontradas = [];
            foreach ($header as $col => $val) {
                $v = mb_strtolower(trim((string)$val));
                if ($v !== '') $columnasEncontradas[] = trim((string)$val);
                if (str_contains($v, 'monto') || str_contains($v, 'abono')) {
                    $montoCol = $col;
                }
                if (str_contains($v, 'cedula') || str_contains($v, 'cédula')) {
                    $cedulaCol = $col;
                }
            }

            if (!$montoCol || !$cedulaCol || $montoCol === $cedulaCol) {
                $errores = [];
                if (!$cedulaCol) $errores[] = 'No se encontró la columna "Cédula"';
                if (!$montoCol) $errores[] = 'No se encontró la columna "Monto" o "Abono"';
                if ($montoCol && $cedulaCol && $montoCol === $cedulaCol) $errores[] = 'Las columnas "Cédula" y "Monto" apuntan a la misma columna';

                return response()->json([
                    'message' => 'Error en el encabezado del archivo Excel',
                    'errores' => $errores,
                    'columnas_encontradas' => $columnasEncontradas,
                    'columnas_requeridas' => ['Cédula (o cedula)', 'Monto (o abono)'],
                    'ayuda' => 'El archivo debe tener un encabezado en la primera fila con al menos las columnas: "Cédula" y "Monto". Verifique que los nombres coincidan.'
                ], 422);
            }

            // Procesar cada fila
            $rowIndex = 0;
            foreach ($rows as $row) {
                $rowIndex++;
                if ($rowIndex === 1) continue; // Skip header

                $rawCedula = trim((string)($row[$cedulaCol] ?? ''));
                $rawMonto = trim((string)($row[$montoCol] ?? ''));
                $cleanCedula = preg_replace('/[^0-9]/', '', $rawCedula);

                if ($cleanCedula === '' || $rawMonto === '') {
                    continue;
                }

                $montoPlanilla = $this->parseMonto($rawMonto);

                // Buscar TODOS los créditos formalizados para esta cédula + deductora (cascada)
                $allCredits = Credit::with(['lead', 'planDePagos' => function($q) {
                    $q->whereIn('estado', ['Mora', 'Pendiente', 'Parcial'])
                      ->where('numero_cuota', '>', 0)
                      ->orderByRaw("FIELD(estado, 'Mora', 'Parcial', 'Pendiente')")
                      ->orderBy('numero_cuota', 'asc');
                }])->where('deductora_id', $deductoraId)
                    ->whereIn('status', ['Formalizado', 'En Mora'])
                    ->whereHas('lead', function($q) use ($rawCedula, $cleanCedula) {
                        $q->where(function($query) use ($rawCedula, $cleanCedula) {
                            $query->where('cedula', $rawCedula)->orWhere('cedula', $cleanCedula);
                        });
                    })
                    ->orderBy('formalized_at', 'asc')
                    ->get();

                if ($allCredits->isNotEmpty()) {
                    $credit = $allCredits->first();
                    $nombre = $credit->lead->name ?? 'N/A';

                    // Simular cascada igual que el upload: distribuir dinero crédito por crédito
                    $dineroSimulado = $montoPlanilla;
                    $filasCredito = [];

                    foreach ($allCredits as $c) {
                        $cuota = $c->planDePagos->first();
                        if (!$cuota) continue;

                        $exigible = (float) $cuota->cuota
                                  + (float) $cuota->interes_moratorio
                                  + (float) ($cuota->int_corriente_vencido ?? 0);

                        $alcanzado = $dineroSimulado > 0.005;
                        $asignado = 0;

                        if ($alcanzado) {
                            $asignado = min($dineroSimulado, $exigible);
                            $dineroSimulado -= $asignado;
                        }

                        $filasCredito[] = [
                            'credit' => $c,
                            'cuota' => $cuota,
                            'exigible' => $exigible,
                            'asignado' => $asignado,
                            'alcanzado' => $alcanzado,
                        ];
                    }

                    $sobrante = $dineroSimulado;
                    $creditosConCuota = array_filter($filasCredito, fn($f) => $f['alcanzado']);

                    if (empty($creditosConCuota)) {
                        $preview[] = [
                            'cedula' => $rawCedula,
                            'nombre' => $nombre,
                            'credito_referencia' => $credit->reference,
                            'numero_cuota' => null,
                            'monto_planilla' => $montoPlanilla,
                            'cuota_esperada' => 0,
                            'cuota_base' => 0,
                            'interes_mora' => 0,
                            'diferencia' => 0,
                            'estado' => 'Sin cuotas pendientes',
                        ];
                    } else {
                        // Cada crédito alcanzado = una fila separada en el preview
                        $esPrimero = true;
                        foreach ($filasCredito as $fila) {
                            if (!$fila['alcanzado']) continue;

                            $exigible = $fila['exigible'];
                            $asignado = $fila['asignado'];
                            $diferencia = $asignado - $exigible;

                            if (abs($diferencia) < 1) {
                                $estado = 'Completo';
                            } elseif ($diferencia < 0) {
                                $estado = 'Parcial';
                            } else {
                                $estado = 'Completo';
                            }

                            if ($esPrimero) {
                                $totales['total_registros']++;
                                $totales['monto_total_planilla'] += $montoPlanilla;
                            }

                            if ($estado === 'Completo') $totales['completos']++;
                            if ($estado === 'Parcial') $totales['parciales']++;

                            $totales['monto_total_esperado'] += $exigible;

                            $preview[] = [
                                'cedula' => $rawCedula,
                                'nombre' => $nombre,
                                'credito_referencia' => $fila['credit']->reference,
                                'numero_cuota' => $fila['cuota']->numero_cuota,
                                'monto_planilla' => $esPrimero ? $montoPlanilla : null,
                                'cuota_esperada' => round($exigible, 2),
                                'cuota_base' => round((float) $fila['cuota']->cuota, 2),
                                'interes_mora' => round((float) $fila['cuota']->interes_moratorio, 2),
                                'diferencia' => round($diferencia, 2),
                                'estado' => $estado,
                                'es_cascada' => !$esPrimero,
                            ];

                            $esPrimero = false;
                        }

                        // Si queda sobrante después de todos los créditos
                        if ($sobrante > 0.50) {
                            $totales['sobrepagos']++;
                            $lastIdx = count($preview) - 1;
                            $preview[$lastIdx]['estado'] = 'Sobrepago';
                            $preview[$lastIdx]['diferencia'] = round($sobrante, 2);
                            $totales['completos']--;
                        }
                    }
                } else {
                    $preview[] = [
                        'cedula' => $rawCedula,
                        'nombre' => 'NO ENCONTRADO',
                        'credito_referencia' => null,
                        'numero_cuota' => null,
                        'monto_planilla' => $montoPlanilla,
                        'cuota_esperada' => 0,
                        'cuota_base' => 0,
                        'interes_mora' => 0,
                        'diferencia' => 0,
                        'estado' => 'No encontrado',
                    ];

                    $totales['no_encontrados']++;
                }
            }

            $totales['diferencia_total'] = $totales['monto_total_planilla'] - $totales['monto_total_esperado'];

            // Advertencias: créditos activos de esta deductora que NO están en el archivo
            $cedulasEnArchivo = collect($preview)->pluck('cedula')->unique()->toArray();
            $mesPago = Carbon::parse($fechaProceso)->subMonth();

            $creditosFaltantes = Credit::where('deductora_id', $deductoraId)
                ->whereIn('status', ['Formalizado', 'En Mora'])
                ->whereNotNull('formalized_at')
                ->whereHas('lead', function ($q) use ($cedulasEnArchivo) {
                    $q->whereNotIn('cedula', $cedulasEnArchivo);
                })
                ->with('lead:id,name,apellido1,cedula')
                ->get(['id', 'lead_id', 'numero_operacion', 'reference', 'cuota', 'status', 'formalized_at']);

            $advertencias = [];
            foreach ($creditosFaltantes as $c) {
                $primeraCuotaPendiente = $c->planDePagos()
                    ->where('numero_cuota', '>', 0)
                    ->where('estado', 'Pendiente')
                    ->orderBy('numero_cuota')
                    ->first();

                if (!$primeraCuotaPendiente) continue;

                $fechaVencimiento = Carbon::parse($primeraCuotaPendiente->fecha_corte);
                if ($fechaVencimiento->startOfMonth()->gt($mesPago->copy()->endOfMonth())) {
                    continue;
                }

                $advertencias[] = [
                    'credit_id' => $c->id,
                    'nombre' => trim(($c->lead->name ?? '') . ' ' . ($c->lead->apellido1 ?? '')),
                    'cedula' => $c->lead->cedula ?? '',
                    'numero_operacion' => $c->numero_operacion ?? $c->reference ?? '',
                    'cuota' => (float) $c->cuota,
                    'status' => $c->status,
                ];
            }

            // Eliminar archivo temporal
            Storage::disk('public')->delete($path);

            // Guardar preview en cache por 10 minutos para exportación
            $hash = md5(json_encode($preview) . time());
            Cache::put('planilla_preview_' . $hash, [
                'preview' => $preview,
                'totales' => $totales,
                'deductora_id' => $deductoraId,
                'fecha_proceso' => $fechaProceso,
            ], now()->addMinutes(10));

            return response()->json([
                'preview' => $preview,
                'totales' => $totales,
                'deductora_id' => $deductoraId,
                'fecha_proceso' => $fechaProceso,
                'hash' => $hash,
                'advertencias' => $advertencias,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al procesar el archivo',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Exportar preview de planilla en Excel
     */
    public function exportPreviewExcel($hash)
    {
        $data = Cache::get('planilla_preview_' . $hash);

        if (!$data) {
            return response()->json(['message' => 'Datos no encontrados o expirados'], 404);
        }

        $preview = $data['preview'];
        $totales = $data['totales'];
        $fechaProceso = $data['fecha_proceso'];

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        // Título
        $sheet->setCellValue('A1', 'RESUMEN DE CARGA DE PLANILLA');
        $sheet->mergeCells('A1:J1');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);

        // Información general
        $sheet->setCellValue('A2', 'Fecha de Proceso:');
        $sheet->setCellValue('B2', $fechaProceso);
        $sheet->setCellValue('A3', 'Total Registros:');
        $sheet->setCellValue('B3', $totales['total_registros']);
        $sheet->setCellValue('D3', 'Completos:');
        $sheet->setCellValue('E3', $totales['completos']);
        $sheet->setCellValue('F3', 'Parciales:');
        $sheet->setCellValue('G3', $totales['parciales']);

        // Encabezados
        $row = 5;
        $headers = ['Cédula', 'Nombre', 'Crédito', 'Cuota #', 'Monto Planilla', 'Cuota Esperada', 'Cuota Base', 'Int. Mora', 'Diferencia', 'Estado'];
        $col = 'A';
        foreach ($headers as $header) {
            $sheet->setCellValue($col . $row, $header);
            $col++;
        }
        $sheet->getStyle('A' . $row . ':J' . $row)->getFont()->setBold(true);
        $sheet->getStyle('A' . $row . ':J' . $row)->getFill()
            ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
            ->getStartColor()->setRGB('4472C4');
        $sheet->getStyle('A' . $row . ':J' . $row)->getFont()->getColor()->setRGB('FFFFFF');

        // Datos
        $row++;
        foreach ($preview as $item) {
            $sheet->setCellValue('A' . $row, $item['cedula']);
            $sheet->setCellValue('B' . $row, $item['nombre']);
            $sheet->setCellValue('C' . $row, $item['credito_referencia'] ?? '');
            $sheet->setCellValue('D' . $row, $item['numero_cuota'] ?? '');
            $sheet->setCellValue('E' . $row, $item['monto_planilla']);
            $sheet->setCellValue('F' . $row, $item['cuota_esperada']);
            $sheet->setCellValue('G' . $row, $item['cuota_base']);
            $sheet->setCellValue('H' . $row, $item['interes_mora']);
            $sheet->setCellValue('I' . $row, $item['diferencia']);
            $sheet->setCellValue('J' . $row, $item['estado']);

            // Colorear según estado
            if ($item['estado'] === 'Parcial') {
                $sheet->getStyle('J' . $row)->getFill()
                    ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                    ->getStartColor()->setRGB('FFF3CD');
            } elseif ($item['estado'] === 'No encontrado') {
                $sheet->getStyle('J' . $row)->getFill()
                    ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                    ->getStartColor()->setRGB('F8D7DA');
            }

            $row++;
        }

        // Totales
        $row++;
        $sheet->setCellValue('D' . $row, 'TOTALES:');
        $sheet->setCellValue('E' . $row, $totales['monto_total_planilla']);
        $sheet->setCellValue('F' . $row, $totales['monto_total_esperado']);
        $sheet->setCellValue('I' . $row, $totales['diferencia_total']);
        $sheet->getStyle('D' . $row . ':I' . $row)->getFont()->setBold(true);

        // Autosize columnas
        foreach (range('A', 'J') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        // Guardar
        $writer = new Xlsx($spreadsheet);
        $filename = 'resumen_planilla_' . $fechaProceso . '.xlsx';
        $tempFile = storage_path('app/public/' . $filename);
        $writer->save($tempFile);

        return response()->download($tempFile, $filename)->deleteFileAfterSend(true);
    }

    /**
     * Exportar preview de planilla en PDF
     */
    public function exportPreviewPdf($hash)
    {
        $data = Cache::get('planilla_preview_' . $hash);

        if (!$data) {
            return response()->json(['message' => 'Datos no encontrados o expirados'], 404);
        }

        $preview = $data['preview'];
        $totales = $data['totales'];
        $fechaProceso = $data['fecha_proceso'];

        // Generar HTML para PDF
        $html = '
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Resumen de Planilla</title>
            <style>
                body { font-family: 'DejaVu Sans', sans-serif; font-size: 10px; }
                h1 { text-align: center; color: #333; font-size: 16px; margin-bottom: 10px; }
                .info { text-align: center; margin-bottom: 15px; font-size: 9px; }
                .totales { margin-bottom: 15px; padding: 10px; background: #f5f5f5; }
                .totales-grid { display: table; width: 100%; margin-bottom: 10px; }
                .totales-item { display: table-cell; text-align: center; padding: 5px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                th { background-color: #4472C4; color: white; padding: 6px 4px; text-align: left; font-size: 9px; }
                td { padding: 5px 4px; border-bottom: 1px solid #ddd; font-size: 8px; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .badge { padding: 2px 6px; border-radius: 3px; font-size: 7px; }
                .badge-green { background: #d4edda; color: #155724; }
                .badge-yellow { background: #fff3cd; color: #856404; }
                .badge-red { background: #f8d7da; color: #721c24; }
                .total-row { font-weight: bold; background: #e3f2fd; }
            </style>
        </head>
        <body>
            <h1>RESUMEN DE CARGA DE PLANILLA</h1>
            <div class="info">
                Fecha de Proceso: ' . $fechaProceso . '<br>
                Total: ' . $totales['total_registros'] . ' | Completos: ' . $totales['completos'] . ' | Parciales: ' . $totales['parciales'] . ' | No Encontrados: ' . $totales['no_encontrados'] . '
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Cédula</th>
                        <th>Nombre</th>
                        <th>Crédito</th>
                        <th class="text-center">Cuota #</th>
                        <th class="text-right">Monto Planilla</th>
                        <th class="text-right">Cuota Esperada</th>
                        <th class="text-right">Diferencia</th>
                        <th class="text-center">Estado</th>
                    </tr>
                </thead>
                <tbody>';

        foreach ($preview as $item) {
            $badgeClass = 'badge ';
            if ($item['estado'] === 'Completo') $badgeClass .= 'badge-green';
            elseif ($item['estado'] === 'Parcial') $badgeClass .= 'badge-yellow';
            else $badgeClass .= 'badge-red';

            $html .= '<tr>
                <td>' . htmlspecialchars($item['cedula']) . '</td>
                <td>' . htmlspecialchars($item['nombre']) . '</td>
                <td>' . htmlspecialchars($item['credito_referencia'] ?? '-') . '</td>
                <td class="text-center">' . ($item['numero_cuota'] ?? '-') . '</td>
                <td class="text-right">' . number_format($item['monto_planilla'], 2) . '</td>
                <td class="text-right">' . number_format($item['cuota_esperada'], 2) . '</td>
                <td class="text-right">' . number_format($item['diferencia'], 2) . '</td>
                <td class="text-center"><span class="' . $badgeClass . '">' . htmlspecialchars($item['estado']) . '</span></td>
            </tr>';
        }

        $html .= '
                    <tr class="total-row">
                        <td colspan="4" class="text-right">TOTALES:</td>
                        <td class="text-right">' . number_format($totales['monto_total_planilla'], 2) . '</td>
                        <td class="text-right">' . number_format($totales['monto_total_esperado'], 2) . '</td>
                        <td class="text-right">' . number_format($totales['diferencia_total'], 2) . '</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>';

        $pdf = Pdf::loadHTML($html);
        $pdf->setPaper('letter', 'landscape');

        $filename = 'resumen_planilla_' . $fechaProceso . '.pdf';

        return $pdf->download($filename);
    }

    /**
     * Carga masiva de planilla con cálculo de mora
     */
    public function upload(array $validated, $file, $request)
    {
        $deductoraId = $validated['deductora_id'];

        // Usar fecha de prueba si se proporciona (solo para desarrollo/testing)
        $fechaTest = $validated['fecha_test'] ?? null;
        $fechaPago = $fechaTest ? Carbon::parse($fechaTest) : now();

        // VALIDACIÓN: Solo 1 planilla por deductora por mes (excluir anuladas)
        $mesInicio = $fechaPago->copy()->startOfMonth();
        $mesFin = $fechaPago->copy()->endOfMonth();
        $yaExiste = CreditPayment::where('source', 'Planilla')
            ->where(function ($q) {
                $q->whereNull('estado_reverso')
                  ->orWhere('estado_reverso', '!=', 'Anulado');
            })
            ->whereBetween('fecha_pago', [$mesInicio, $mesFin])
            ->whereHas('credit', function ($q) use ($deductoraId) {
                $q->where('deductora_id', $deductoraId);
            })
            ->exists();

        if ($yaExiste) {
            $deductoraNombre = \App\Models\Deductora::find($deductoraId)->nombre ?? 'Desconocida';
            $mesNombre = $fechaPago->translatedFormat('F Y');
            return response()->json([
                'message' => "La planilla del mes de {$mesNombre} correspondiente a {$deductoraNombre} ya ha sido cargada.",
                'deductora' => $deductoraNombre,
                'mes' => $mesNombre,
            ], 422);
        }

        // Mes que se está pagando (planillas llegan 1 mes después)
        $mesPago = $fechaPago->copy()->subMonth();
        $diasDelMes = $mesPago->daysInMonth;

        // Tasa de mora desde configuración (loan_configurations.tasa_anual)
        $config = LoanConfiguration::where('activo', true)->first();
        $tasaMora = $config ? (float) $config->tasa_anual : 33.5;

        $path = $file->store('uploads/planillas', 'public');
        $fullPath = storage_path('app/public/' . $path);
        $results = [];
        $delimiter = ',';

        // IDs de créditos que SÍ pagaron (para excluir del cálculo de mora)
        $creditosQuePagaron = [];

        // Crear registro de planilla ANTES de procesar
        $planillaUpload = PlanillaUpload::create([
            'deductora_id' => $deductoraId,
            'user_id' => $request->user()->id,
            'fecha_planilla' => $mesPago->format('Y-m-d'),
            'uploaded_at' => now(),
            'nombre_archivo' => $file->getClientOriginalName(),
            'ruta_archivo' => $path,
            'cantidad_pagos' => 0,
            'monto_total' => 0,
            'estado' => 'procesada',
        ]);

        try {
            $readerType = IOFactory::identify($fullPath);
            $reader = IOFactory::createReader($readerType);
            if ($readerType === 'Csv') {
                $handle = fopen($fullPath, 'r');
                if ($handle) {
                    $sample = ''; $lineCount = 0;
                    while (($line = fgets($handle)) !== false && $lineCount < 5) { $sample .= $line; $lineCount++; }
                    fclose($handle);
                    if (substr_count($sample, ';') > substr_count($sample, ',')) $delimiter = ';';
                }
                if ($reader instanceof Csv) $reader->setDelimiter($delimiter);
            }
            $spreadsheet = $reader->load($fullPath);
            $rows = $spreadsheet->getActiveSheet()->toArray(null, true, true, true);
            $header = reset($rows);
            $montoCol = null; $cedulaCol = null;
            $columnasEncontradas = [];
            foreach ($header as $col => $val) {
                $v = mb_strtolower(trim((string)$val));
                if ($v !== '') $columnasEncontradas[] = trim((string)$val);
                if (str_contains($v, 'monto') || str_contains($v, 'abono')) $montoCol = $col;
                if (str_contains($v, 'cedula') || str_contains($v, 'cédula')) $cedulaCol = $col;
            }
            if (!$montoCol || !$cedulaCol || $montoCol === $cedulaCol) {
                $errores = [];
                if (!$cedulaCol) $errores[] = 'No se encontró la columna "Cédula"';
                if (!$montoCol) $errores[] = 'No se encontró la columna "Monto" o "Abono"';
                if ($montoCol && $cedulaCol && $montoCol === $cedulaCol) $errores[] = 'Las columnas "Cédula" y "Monto" apuntan a la misma columna';

                return response()->json([
                    'message' => 'Error en el encabezado del archivo Excel',
                    'errores' => $errores,
                    'columnas_encontradas' => $columnasEncontradas,
                    'columnas_requeridas' => ['Cédula (o cedula)', 'Monto (o abono)'],
                    'ayuda' => 'El archivo debe tener un encabezado en la primera fila con al menos las columnas: "Cédula" y "Monto". Verifique que los nombres coincidan.'
                ], 422);
            }

            // PASO 1: Procesar pagos de personas EN la lista
            $rowIndex = 0;
            foreach ($rows as $row) {
                $rowIndex++;
                if ($rowIndex === 1) continue;
                $rawCedula = trim((string)($row[$cedulaCol] ?? ''));
                $rawMonto  = trim((string)($row[$montoCol] ?? ''));
                $cleanCedula = preg_replace('/[^0-9]/', '', $rawCedula);
                if ($cleanCedula === '' || $rawMonto === '') {
                    $results[] = ['cedula' => $rawCedula, 'status' => 'skipped']; continue;
                }

                $montoPagado = $this->parseMonto($rawMonto);

                if ($montoPagado <= 0) {
                    $results[] = ['cedula' => $rawCedula, 'status' => 'zero_amount'];
                    continue;
                }

                // Buscar TODOS los créditos por cédula + deductora, ordenados por antigüedad
                $credits = Credit::where('deductora_id', $deductoraId)
                    ->whereIn('status', ['Formalizado', 'En Mora'])
                    ->whereHas('lead', function($q) use ($rawCedula, $cleanCedula) {
                        $q->where(function($query) use ($rawCedula, $cleanCedula) {
                            $query->where('cedula', $rawCedula)->orWhere('cedula', $cleanCedula);
                        });
                    })
                    ->orderBy('formalized_at', 'asc')
                    ->get();

                if ($credits->isEmpty()) {
                    $results[] = ['cedula' => $rawCedula, 'status' => 'not_found'];
                    continue;
                }

                // CASCADA: Pagar cuota de cada crédito (más viejo primero)
                $dineroDisponible = $montoPagado;
                $payments = [];
                $planillaId = $planillaUpload->id;

                foreach ($credits as $cascadeCredit) {
                    if ($dineroDisponible <= 0.005) break;

                    $creditosQuePagaron[] = $cascadeCredit->id;
                    $cascadeCreditId = $cascadeCredit->id;
                    $montoParaCredito = $dineroDisponible;

                    $esCascadeMultiple = $credits->count() > 1;
                    $payment = DB::transaction(function () use ($cascadeCreditId, $montoParaCredito, $fechaPago, $rawCedula, $planillaId, $esCascadeMultiple) {
                        $c = Credit::lockForUpdate()->findOrFail($cascadeCreditId);
                        return $this->paymentProcessing->processPaymentTransaction($c, $montoParaCredito, $fechaPago, 'Planilla', $rawCedula, null, true, $planillaId, $esCascadeMultiple ? 0.0 : -1);
                    });

                    if ($payment) {
                        $payments[] = $payment;
                        $dineroDisponible = (float) $payment->movimiento_total;

                        // Limpiar movimiento_total de pagos intermedios (sobrante pasa al siguiente crédito)
                        if ($dineroDisponible > 0.005 && $credits->count() > 1) {
                            $payment->update(['movimiento_total' => 0]);
                        }
                    }
                }

                $resultItem = [
                    'cedula' => $rawCedula,
                    'monto' => $montoPagado,
                    'status' => 'applied',
                    'lead' => $credits->first()->lead->name ?? 'N/A',
                    'credits_procesados' => count($payments),
                ];

                // Sobrante final (después de pagar todos los créditos en cascada)
                if ($dineroDisponible > 0.50 && count($payments) > 0) {
                    $lastPayment = end($payments);
                    $lastCredit  = Credit::find($lastPayment->credit_id);

                    // Buscar próxima cuota pendiente del último crédito procesado
                    $proximaCuota = $lastCredit ? $lastCredit->planDePagos()
                        ->where('numero_cuota', '>', 0)
                        ->where('estado', 'Pendiente')
                        ->orderBy('numero_cuota')
                        ->first() : null;

                    $ultimaCuotaTeniaMora = $this->paymentProcessing->getMoraFlag($lastPayment->id);

                    if ($proximaCuota && $ultimaCuotaTeniaMora) {
                        // Sobrante de pago de mora → aplicar como parcial a siguiente cuota
                        DB::transaction(function () use ($lastCredit, $dineroDisponible, $fechaPago, $rawCedula, $planillaId) {
                            $c = Credit::lockForUpdate()->findOrFail($lastCredit->id);
                            $this->paymentProcessing->processPaymentTransaction($c, $dineroDisponible, $fechaPago, 'Planilla', $rawCedula, null, true, $planillaId);
                        });
                        $resultItem['parcial_aplicado'] = $dineroDisponible;
                    } else {
                        // Sin próxima cuota pendiente → SaldoPendiente
                        $lastPayment->update(['movimiento_total' => $dineroDisponible]);

                        $saldo = SaldoPendiente::create([
                            'credit_id'         => $lastPayment->credit_id,
                            'credit_payment_id' => $lastPayment->id,
                            'monto'             => $dineroDisponible,
                            'origen'            => 'Planilla',
                            'fecha_origen'      => $fechaPago,
                            'estado'            => 'pendiente',
                            'cedula'            => $rawCedula,
                        ]);
                        $resultItem['sobrante']          = $dineroDisponible;
                        $resultItem['saldo_pendiente_id'] = $saldo->id;

                        // ACCOUNTING_API_TRIGGER: Retención de Sobrante de Planilla
                        $this->triggerAccountingEntry(
                            'SALDO_SOBRANTE',
                            $dineroDisponible,
                            "SOB-{$saldo->id}-{$credits->first()->reference}",
                            [
                                'credit_id'        => $credits->first()->reference,
                                'cedula'           => $rawCedula,
                                'clienteNombre'    => $credits->first()->lead->name ?? null,
                                'deductora_id'     => $deductoraId,
                                'deductora_nombre' => $planillaUpload->deductora->nombre ?? 'Sin deductora',
                                'saldo_pendiente_id' => $saldo->id,
                                'amount_breakdown' => [
                                    'total'                  => $dineroDisponible,
                                    'sobrante'               => $dineroDisponible,
                                    'interes_corriente'      => 0,
                                    'interes_moratorio'      => 0,
                                    'poliza'                 => 0,
                                    'capital'                => 0,
                                    'cargos_adicionales_total' => 0,
                                    'cargos_adicionales'     => [],
                                ],
                            ]
                        );
                    }
                }

                if (count($payments) === 0) {
                    $resultItem['status'] = 'paid_or_error';
                }

                $results[] = $resultItem;
            }

            // Actualizar totales de la planilla
            $planillaUpload->update([
                'cantidad_pagos' => count($results),
                'monto_total' => CreditPayment::where('planilla_upload_id', $planillaUpload->id)->sum('monto'),
            ]);

            // PASO 2: Calcular mora para créditos de ESTA deductora que NO pagaron
            $moraResults = [];
            try {
                $moraResults = $this->mora->calcularMoraAusentes($deductoraId, $creditosQuePagaron, $mesPago, $diasDelMes, $tasaMora);
            } catch (\Exception $e) {
                \Log::error('Error calculando mora ausentes', ['deductora_id' => $deductoraId, 'mes_pago' => $mesPago, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            }

            // Recopilar saldos pendientes creados en esta carga
            $saldosPendientes = collect($results)
                ->filter(fn($r) => isset($r['sobrante']))
                ->map(fn($r) => [
                    'cedula' => $r['cedula'],
                    'lead' => $r['lead'] ?? 'N/A',
                    'monto_pagado' => $r['monto'],
                    'sobrante' => $r['sobrante'],
                    'saldo_pendiente_id' => $r['saldo_pendiente_id'],
                ])
                ->values()
                ->all();

            // Construir advertencias de créditos ausentes que entraron en mora
            $advertencias = [];
            $moraAplicadaIds = collect($moraResults)
                ->where('status', 'mora_aplicada')
                ->pluck('credit_id')
                ->toArray();

            if (!empty($moraAplicadaIds)) {
                $creditosEnMora = Credit::whereIn('id', $moraAplicadaIds)
                    ->with('lead:id,name,apellido1,cedula')
                    ->get(['id', 'lead_id', 'numero_operacion', 'reference', 'cuota', 'status']);

                foreach ($creditosEnMora as $c) {
                    $advertencias[] = [
                        'credit_id' => $c->id,
                        'nombre' => trim(($c->lead->name ?? '') . ' ' . ($c->lead->apellido1 ?? '')),
                        'cedula' => $c->lead->cedula ?? '',
                        'numero_operacion' => $c->numero_operacion ?? $c->reference ?? '',
                        'cuota' => $c->cuota,
                    ];
                }
            }

            return [
                'planillaUpload' => $planillaUpload,
                'results' => $results,
                'moraResults' => $moraResults,
                'saldosPendientes' => $saldosPendientes,
                'advertencias' => $advertencias,
            ];
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Detectar formato de monto: europeo (8.167,97) vs americano (8,167.97)
     */
    private function parseMonto(string $rawMonto): float
    {
        $lastComma = strrpos($rawMonto, ',');
        $lastDot = strrpos($rawMonto, '.');
        if ($lastComma !== false && $lastDot !== false) {
            if ($lastComma > $lastDot) {
                $cleanMonto = str_replace('.', '', $rawMonto);
                $cleanMonto = str_replace(',', '.', $cleanMonto);
            } else {
                $cleanMonto = str_replace(',', '', $rawMonto);
            }
        } elseif ($lastComma !== false && $lastDot === false) {
            $cleanMonto = str_replace(',', '.', $rawMonto);
        } else {
            $cleanMonto = $rawMonto;
        }
        return (float) preg_replace('/[^0-9\.]/', '', $cleanMonto);
    }
}
