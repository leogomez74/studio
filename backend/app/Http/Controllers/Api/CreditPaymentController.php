<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CreditPayment;
use App\Models\PlanDePago;
use App\Traits\AccountingTrigger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Cache;
use App\Models\Credit;
use App\Models\LoanConfiguration;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\Csv;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use App\Models\SaldoPendiente;
use App\Models\Task;
use App\Models\PlanillaUpload;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class CreditPaymentController extends Controller
{
    use AccountingTrigger;
    /**
     * Listar todos los pagos
     */
    public function index()
    {
        $payments = CreditPayment::with('credit.lead')
            ->orderBy('created_at', 'desc')
            ->get();
        return response()->json($payments);
    }

    /**
     * Mostrar un pago individual con sus relaciones
     */
    public function show(string $id)
    {
        $payment = CreditPayment::with([
            'credit.lead',
            'planillaUpload.deductora',
        ])->findOrFail($id);

        return response()->json($payment);
    }

    /**
     * Preliminar de planilla - Analiza sin aplicar cambios
     */
    public function previewPlanilla(Request $request)
    {
        $validated = $request->validate([
            'deductora_id' => 'required|exists:deductoras,id',
            'fecha_proceso' => 'nullable|date',
            'file' => 'required|file|mimes:xlsx,xls,csv,txt|mimetypes:text/csv,text/plain,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ]);

        $deductoraId = $validated['deductora_id'];
        $fechaProceso = $validated['fecha_proceso'] ?? now()->format('Y-m-d');

        // VALIDACIÓN: Solo 1 planilla por deductora por mes
        $fechaProcesoCarbon = Carbon::parse($fechaProceso);
        $mesInicio = $fechaProcesoCarbon->copy()->startOfMonth();
        $mesFin = $fechaProcesoCarbon->copy()->endOfMonth();
        $yaExiste = CreditPayment::where('source', 'Planilla')
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

        $file = $request->file('file');
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

                // Detectar formato del monto
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
                $montoPlanilla = (float) preg_replace('/[^0-9\.]/', '', $cleanMonto);

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

                            // Sobrepago solo en el último crédito si queda excedente
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
                            // Marcar el último crédito como sobrepago
                            $lastIdx = count($preview) - 1;
                            $preview[$lastIdx]['estado'] = 'Sobrepago';
                            $preview[$lastIdx]['diferencia'] = round($sobrante, 2);
                            // Descontar del completo que se contó
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
                body { font-family: Arial, sans-serif; font-size: 10px; }
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

        // Generar PDF con Dompdf
        $pdf = Pdf::loadHTML($html);
        $pdf->setPaper('letter', 'landscape');

        $filename = 'resumen_planilla_' . $fechaProceso . '.pdf';

        return $pdf->download($filename);
    }

    /**
     * Registrar pago normal (Ventanilla)
     * Usa la lógica de cascada estándar (Mora -> Interés -> Capital)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'credit_id' => 'required|exists:credits,id',
            'monto'     => 'required|numeric|min:0.01',
            'fecha'     => 'required|date',
            'origen'    => 'nullable|string',
        ]);

        $payment = DB::transaction(function () use ($validated) {
            // 🔒 LOCK: Obtener crédito con bloqueo pesimista para prevenir race conditions
            $credit = Credit::lockForUpdate()->findOrFail($validated['credit_id']);

            return $this->processPaymentTransaction(
                $credit,
                $validated['monto'],
                $validated['fecha'],
                $validated['origen'] ?? 'Ventanilla',
                $credit->lead->cedula ?? null
            );
        });

        // Recargar el crédito actualizado
        $credit = Credit::find($validated['credit_id']);

        return response()->json([
            'message' => 'Pago aplicado correctamente',
            'payment' => $payment,
            'credit_summary' => ['saldo_credito' => $credit->saldo]
        ], 201);
    }

    /**
     * Adelanto / Abono Extraordinario
     * Lógica optimizada: Aplicación directa a capital y regeneración de tabla.
     */
    public function adelanto(Request $request)
    {
        $validated = $request->validate([
            'credit_id' => 'required|exists:credits,id',
            'tipo'      => 'nullable|string',
            'monto'     => 'required|numeric|min:0.01',
            'fecha'     => 'required|date',
            'extraordinary_strategy' => 'nullable|required_if:tipo,extraordinario|in:reduce_amount,reduce_term',
            'cuotas'    => 'nullable|array', // IDs de cuotas seleccionadas para adelanto
        ]);

        // CASO 1: PAGO NORMAL / ADELANTO SIMPLE (Sin Recálculo)
        if (($validated['tipo'] ?? '') !== 'extraordinario') {
            $result = DB::transaction(function () use ($validated) {
                // 🔒 LOCK: Obtener crédito con bloqueo pesimista
                $credit = Credit::lockForUpdate()->findOrFail($validated['credit_id']);

                // Si es adelanto y hay cuotas seleccionadas, pasar IDs
                $cuotasSeleccionadas = $validated['cuotas'] ?? null;
                return $this->processPaymentTransaction(
                    $credit,
                    $validated['monto'],
                    $validated['fecha'],
                    ($validated['tipo'] ?? '') === 'adelanto' ? 'Adelanto de Cuotas' : 'Adelanto Simple',
                    $credit->lead->cedula ?? null,
                    $cuotasSeleccionadas
                );
            });

            $credit = Credit::find($validated['credit_id']);
            return response()->json([
                'message' => 'Pago aplicado correctamente.',
                'payment' => $result,
                'nuevo_saldo' => $credit->saldo
            ]);
        }

        // CASO 2: ABONO EXTRAORDINARIO (Recálculo de Tabla)
        $result = DB::transaction(function () use ($validated) {
            // 🔒 LOCK: Obtener crédito con bloqueo pesimista
            $credit = Credit::lockForUpdate()->findOrFail($validated['credit_id']);
            $montoAbono = $validated['monto'];
            $fechaPago = $validated['fecha'];
            $strategy = $validated['extraordinary_strategy'];

            // 1. Identificar punto de partida (Primera cuota no pagada)
            $siguienteCuota = $credit->planDePagos()
                ->where('estado', '!=', 'Pagado')
                ->where('cuota', '>', 0)
                ->orderBy('numero_cuota', 'asc')
                ->first();

            if (!$siguienteCuota) {
                throw new \Exception("No hay cuotas pendientes amortizables (mayores a 0).");
            }

            $numeroCuotaInicio = $siguienteCuota->numero_cuota;

            // Determinar la última cuota pagada para calcular penalización
            $ultimaCuotaPagada = $credit->planDePagos()
                ->where('numero_cuota', '>', 0)
                ->whereIn('estado', ['Pagado', 'Pagada'])
                ->orderBy('numero_cuota', 'desc')
                ->first();

            $numeroCuotaActual = $ultimaCuotaPagada ? $ultimaCuotaPagada->numero_cuota : 0;

            // Calcular penalización si está antes de la cuota 12
            $penalizacion = 0;
            $interesesPenalizacion = [];
            if ($numeroCuotaActual < 12) {
                // Obtener las próximas 3 cuotas pendientes
                $proximasCuotas = $credit->planDePagos()
                    ->where('numero_cuota', '>', $numeroCuotaActual)
                    ->where('estado', '!=', 'Pagado')
                    ->orderBy('numero_cuota')
                    ->take(3)
                    ->get();

                // Sumar solo los intereses corrientes como penalización
                foreach ($proximasCuotas as $cuota) {
                    $interesCorriente = (float) $cuota->interes_corriente;
                    $interesesPenalizacion[] = [
                        'numero_cuota' => $cuota->numero_cuota,
                        'interes_corriente' => $interesCorriente
                    ];
                    $penalizacion += $interesCorriente;
                }

                $penalizacion = round($penalizacion, 2);
            }

            // La penalización se RESTA del monto que se abona, no se suma
            // El cliente paga $montoAbono, pero solo ($montoAbono - $penalizacion) se aplica al saldo
            $montoAplicarAlSaldo = max(0, $montoAbono - $penalizacion);

            // Snapshot para reverso: capturar estado ANTES de modificar
            $planSnapshot = $credit->planDePagos()
                ->where('numero_cuota', '>=', $numeroCuotaInicio)
                ->get()->map(fn($c) => $c->toArray())->toArray();

            $reversalSnapshot = [
                'type' => 'extraordinario',
                'strategy' => $strategy,
                'original_saldo' => (float) $credit->saldo,
                'original_plazo' => (int) $credit->plazo,
                'original_cuota' => (float) $credit->cuota,
                'original_status' => $credit->status,
                'start_cuota_num' => $numeroCuotaInicio,
                'plan_rows' => $planSnapshot,
                'monto_abono' => $montoAbono,
                'penalizacion' => $penalizacion,
                'intereses_penalizacion' => $interesesPenalizacion,
                'monto_aplicado_al_saldo' => $montoAplicarAlSaldo,
            ];

            // 2. Aplicar directo al Saldo (Capital Vivo)
            $saldoActual = (float) $credit->saldo;

            if ($montoAplicarAlSaldo >= $saldoActual) {
                $montoAplicarAlSaldo = $saldoActual;
                $nuevoCapitalBase = 0;
            } else {
                $nuevoCapitalBase = round($saldoActual - $montoAplicarAlSaldo, 2);
            }

            $credit->saldo = $nuevoCapitalBase;
            $credit->save();

            // Recibo de abono a capital (incluye penalización si aplica)
            $estadoTexto = $penalizacion > 0
                ? 'Abono Extraordinario (Penalización: ₡' . number_format($penalizacion, 2) . ' - Aplicado: ₡' . number_format($montoAplicarAlSaldo, 2) . ')'
                : 'Abono Extraordinario';

            $paymentRecord = CreditPayment::create([
                'credit_id'      => $credit->id,
                'numero_cuota'   => 0,
                'fecha_pago'     => $fechaPago,
                'monto'          => $montoAbono, // Monto que pagó el cliente
                'saldo_anterior' => $saldoActual,
                'nuevo_saldo'    => $nuevoCapitalBase,
                'estado'         => $estadoTexto,
                'amortizacion'   => $montoAplicarAlSaldo, // Lo que realmente se aplicó al saldo
                'source'         => 'Extraordinario',
                'movimiento_total' => $montoAbono,
                'interes_corriente' => $penalizacion, // Registrar la penalización como "interés"
                'cedula'         => $credit->lead->cedula ?? null,
                'reversal_snapshot' => $reversalSnapshot,
                'estado_reverso' => 'Vigente'
            ]);

            // ============================================================
            // ACCOUNTING_API_TRIGGER: Abono Extraordinario (Específico)
            // ============================================================
            // Dispara asiento contable al registrar un abono extraordinario:
            // DÉBITO: Banco CREDIPEP (monto del pago)
            // CRÉDITO: Cuentas por Cobrar (monto del pago - penalización)
            // CRÉDITO: Ingreso por Penalización (penalización) - si aplica
            $this->triggerAccountingEntry(
                'ABONO_EXTRAORDINARIO',
                $montoAbono,
                "EXTRA-{$paymentRecord->id}-{$credit->reference}",
                [
                    'reference' => "EXTRA-{$paymentRecord->id}-{$credit->reference}",
                    'credit_id' => $credit->reference,
                    'cedula' => $credit->lead->cedula ?? null,
                    'clienteNombre' => $credit->lead->name ?? null,
                    'amount_breakdown' => [
                        'total' => $montoAbono,
                        'interes_corriente' => 0,
                        'interes_moratorio' => 0,
                        'poliza' => 0,
                        'capital' => $montoAplicarAlSaldo,
                        'cargos_adicionales_total' => $penalizacion,
                        'cargos_adicionales' => [
                            'penalizacion' => $penalizacion,
                        ],
                    ],
                ]
            );

            // 3. Regenerar Proyección
            if ($nuevoCapitalBase > 0) {
                $this->regenerarProyeccion(
                    $credit,
                    $strategy,
                    $nuevoCapitalBase,
                    $numeroCuotaInicio,
                    $siguienteCuota->fecha_corte
                );
            } else {
                // Crédito finalizado
                PlanDePago::where('credit_id', $credit->id)
                    ->where('numero_cuota', '>=', $numeroCuotaInicio)
                    ->delete();
                $credit->status = 'Finalizado';
                $credit->save();
            }

            return $paymentRecord;
        });

        return response()->json([
            'message' => 'Abono extraordinario aplicado y plan regenerado.',
            'payment' => $result,
            'nuevo_saldo' => Credit::find($validated['credit_id'])->saldo
        ]);
    }

    /**
     * Lógica de Regeneración (Paso 3)
     * Borra y recrea las cuotas futuras basándose en el nuevo saldo.
     */
    private function regenerarProyeccion(Credit $credit, $strategy, $nuevoCapital, $startCuotaNum, $fechaPrimerVencimiento)
    {
        if($startCuotaNum < 1){
            $startCuotaNum = 1;
        }

        // Capturar el valor de póliza ANTES de borrar las cuotas (se definió al formalizar)
        $polizaOriginal = PlanDePago::where('credit_id', $credit->id)
            ->where('numero_cuota', '>=', $startCuotaNum)
            ->value('poliza') ?? 0;

        // 1. LIMPIEZA: Borramos el plan desde la cuota actual en adelante.
        PlanDePago::where('credit_id', $credit->id)
            ->where('numero_cuota', '>=', $startCuotaNum)
            ->delete();

        $tasaAnual = (float) $credit->tasa_anual;
        $tasaMensual = ($tasaAnual / 100) / 12;

        // Arrancamos un mes antes de la fecha de corte actual para sumar 1 mes en el bucle
        $fechaIteracion = Carbon::parse($fechaPrimerVencimiento)->subMonth();

        // --- ESTRATEGIA: REDUCIR CUOTA (Mantener Plazo) ---
        if ($strategy === 'reduce_amount') {

            // Cuántas cuotas faltaban originalmente
            $cuotasRestantes = $credit->plazo - $startCuotaNum + 1;
            if ($cuotasRestantes < 1) $cuotasRestantes = 1; // Protección mínima

            // Calculamos nueva cuota fija
            if ($tasaMensual > 0) {
                $potencia = pow(1 + $tasaMensual, $cuotasRestantes);
                $nuevaCuotaMonto = $nuevoCapital * ($tasaMensual * $potencia) / ($potencia - 1);
            } else {
                $nuevaCuotaMonto = $nuevoCapital / $cuotasRestantes;
            }
            $nuevaCuotaMonto = round($nuevaCuotaMonto, 2);

            // Actualizamos la cuota fija en la cabecera
            $credit->cuota = $nuevaCuotaMonto;
            $credit->save();

            $saldo = $nuevoCapital;

            for ($i = 0; $i < $cuotasRestantes; $i++) {
                $numeroReal = $startCuotaNum + $i;
                $fechaIteracion->addMonth();

                $interes = round($saldo * $tasaMensual, 2);

                if ($i == $cuotasRestantes - 1) {
                    $amortizacion = $saldo;
                    $cuotaFinal = $saldo + $interes;
                } else {
                    $amortizacion = $nuevaCuotaMonto - $interes;
                    $cuotaFinal = $nuevaCuotaMonto;
                }

                $nuevoSaldo = round($saldo - $amortizacion, 2);

                $this->crearCuota($credit->id, $numeroReal, $fechaIteracion, $tasaAnual, $cuotaFinal, $interes, $amortizacion, $saldo, $nuevoSaldo, $polizaOriginal);

                $saldo = $nuevoSaldo;
            }
        }

        // --- ESTRATEGIA: REDUCIR PLAZO (Mantener Cuota) ---
        elseif ($strategy === 'reduce_term') {

            $cuotaFijaActual = (float) $credit->cuota;

            // Safety check: Si la cuota vieja es inválida, calculamos una mínima
            $interesMinimo = $nuevoCapital * $tasaMensual;
            if ($cuotaFijaActual <= $interesMinimo) {
                $cuotaFijaActual = $interesMinimo + 1.00;
            }

            $saldo = $nuevoCapital;
            $contadorCuota = $startCuotaNum;
            $maxLoops = 360;
            $loops = 0;

            // Descontamos continuamente mes a mes hasta que saldo llegue a 0
            while ($saldo > 0.01 && $loops < $maxLoops) {
                $fechaIteracion->addMonth();
                $loops++;

                $interes = round($saldo * $tasaMensual, 2);
                $amortizacion = $cuotaFijaActual - $interes;

                // Validar: Si la amortización es negativa o cero, ajustar
                if ($amortizacion <= 0) {
                    // La cuota no alcanza para cubrir ni el interés - liquidar en esta cuota
                    $cuotaReal = $saldo + $interes;
                    $amortizacion = $saldo;
                    $nuevoSaldo = 0;
                } elseif ($saldo <= $amortizacion) {
                    $amortizacion = $saldo;
                    $cuotaReal = $saldo + $interes; // Última cuota ajustada
                    $nuevoSaldo = 0;
                } else {
                    $cuotaReal = $cuotaFijaActual;
                    $nuevoSaldo = round($saldo - $amortizacion, 2);
                }

                // Protección final: Si estamos cerca del límite y queda saldo residual, liquidarlo
                if ($loops >= $maxLoops - 1 && $nuevoSaldo > 0) {
                    $cuotaReal += $nuevoSaldo;
                    $amortizacion += $nuevoSaldo;
                    $nuevoSaldo = 0;
                }

                $this->crearCuota($credit->id, $contadorCuota, $fechaIteracion, $tasaAnual, $cuotaReal, $interes, $amortizacion, $saldo, $nuevoSaldo, $polizaOriginal);

                $saldo = $nuevoSaldo;
                $contadorCuota++;
            }

            // Actualizamos el plazo total del crédito
            $credit->plazo = $contadorCuota - 1;
            $credit->save();
        }
    }

    /**
     * Método público para aplicar abono a capital con estrategia de regeneración
     * Usado por SaldoPendienteController cuando se aplica un saldo a favor como capital
     */
    public function procesarAbonoCapitalConEstrategia(Credit $credit, $montoAbono, $fechaPago, $strategy, $source = 'Extraordinario', $cedula = null)
    {
        $saldoActual = (float) $credit->saldo;

        if ($montoAbono >= $saldoActual) {
            $montoAbono = $saldoActual;
            $nuevoCapitalBase = 0;
        } else {
            $nuevoCapitalBase = round($saldoActual - $montoAbono, 2);
        }

        $credit->saldo = $nuevoCapitalBase;
        $credit->save();

        // Identificar punto de partida (Primera cuota no pagada)
        $siguienteCuota = $credit->planDePagos()
            ->where('estado', '!=', 'Pagado')
            ->where('cuota', '>', 0)
            ->orderBy('numero_cuota', 'asc')
            ->first();

        $numeroCuotaInicio = $siguienteCuota ? $siguienteCuota->numero_cuota : 1;

        // Snapshot para reverso
        $planSnapshot = $credit->planDePagos()
            ->where('numero_cuota', '>=', $numeroCuotaInicio)
            ->get()->map(fn($c) => $c->toArray())->toArray();

        $reversalSnapshot = [
            'type' => 'extraordinario',
            'strategy' => $strategy,
            'original_saldo' => $saldoActual,
            'original_plazo' => (int) $credit->plazo,
            'original_cuota' => (float) $credit->cuota,
            'original_status' => $credit->status,
            'start_cuota_num' => $numeroCuotaInicio,
            'plan_rows' => $planSnapshot,
        ];

        // Registrar pago
        $paymentRecord = CreditPayment::create([
            'credit_id'      => $credit->id,
            'numero_cuota'   => 0,
            'fecha_cuota'    => $fechaPago,
            'fecha_pago'     => $fechaPago,
            'monto'          => $montoAbono,
            'saldo_anterior' => $saldoActual,
            'nuevo_saldo'    => $nuevoCapitalBase,
            'estado'         => 'Abono Extraordinario',
            'amortizacion'   => $montoAbono,
            'source'         => $source,
            'movimiento_total' => $montoAbono,
            'interes_corriente' => 0,
            'cedula'         => $cedula,
            'reversal_snapshot' => $reversalSnapshot,
            'estado_reverso' => 'Vigente'
        ]);

        // Regenerar proyección si queda saldo
        if ($nuevoCapitalBase > 0 && $siguienteCuota) {
            $this->regenerarProyeccion(
                $credit,
                $strategy,
                $nuevoCapitalBase,
                $numeroCuotaInicio,
                $siguienteCuota->fecha_corte
            );
        } elseif ($nuevoCapitalBase <= 0) {
            // Crédito finalizado
            PlanDePago::where('credit_id', $credit->id)
                ->where('numero_cuota', '>=', $numeroCuotaInicio)
                ->delete();
            $credit->status = 'Finalizado';
            $credit->save();
        }

        return $paymentRecord;
    }

    /**
     * Helper para crear el registro en la BD
     * $poliza: Monto de póliza por cuota (se mantiene desde la formalización)
     */
    private function crearCuota($creditId, $numero, $fecha, $tasa, $cuota, $interes, $amortizacion, $saldoAnt, $saldoNuevo, $poliza = 0)
    {
        PlanDePago::create([
            'credit_id'         => $creditId,
            'numero_cuota'      => $numero,
            'fecha_inicio'      => $fecha->copy()->subMonth(),
            'fecha_corte'       => $fecha->copy(),
            'tasa_actual'       => $tasa,
            'cuota'             => $cuota + $poliza,
            'poliza'            => $poliza,
            'interes_corriente' => $interes,
            'amortizacion'      => $amortizacion,
            'saldo_anterior'    => max(0, $saldoAnt),
            'saldo_nuevo'       => max(0, $saldoNuevo),
            'estado'            => 'Pendiente',
            'movimiento_total'  => 0,
            'movimiento_poliza' => 0,
            'movimiento_principal' => 0,
            'movimiento_interes_corriente' => 0,
            'movimiento_interes_moratorio' => 0
        ]);
    }

    /**
     * Lógica "Cascada" (Waterfall) para pagos regulares
     * IMPUTACIÓN: Mora -> Interés -> Cargos -> Capital
     */
    private function processPaymentTransaction(Credit $credit, $montoEntrante, $fecha, $source, $cedulaRef = null, $cuotasSeleccionadas = null, bool $singleCuotaMode = false, $planillaUploadId = null, float $sobranteContable = -1)
    {
        $dineroDisponible = $montoEntrante;

        // Obtener cuotas en orden: primero las que están en "Mora", luego "Pendiente" o "Parcial"
        // Esto asegura que el pago se aplique primero a las deudas más antiguas/atrasadas
        $query = $credit->planDePagos()
            ->whereIn('estado', ['Mora', 'Pendiente', 'Parcial'])
            ->where('numero_cuota', '>', 0);
        if (is_array($cuotasSeleccionadas) && count($cuotasSeleccionadas) > 0) {
            $query->whereIn('id', $cuotasSeleccionadas);
        }
        // Ordenar: Mora primero, luego Parcial, luego Pendiente, y dentro de cada grupo por numero_cuota
        $cuotas = $query->orderByRaw("FIELD(estado, 'Mora', 'Parcial', 'Pendiente')")
            ->orderBy('numero_cuota', 'asc')
            ->get();

        $primerCuotaAfectada = null;
        $saldoAnteriorSnapshot = 0;
        $saldoCreditoAntes = $credit->saldo;

        $carryInteres = 0.0;
        $carryAmort = 0.0;
        $cuotasArr = $cuotas->all();
        $cuotasCount = count($cuotasArr);

        // --- CORRECCIÓN: Variable para acumular solo lo amortizado HOY ---
        $capitalAmortizadoHoy = 0.0;
        $paymentDetails = [];

        foreach ($cuotasArr as $i => $cuota) {
            if ($dineroDisponible <= 0.005) break;

            if (!$primerCuotaAfectada) {
                $primerCuotaAfectada = $cuota;
                $saldoAnteriorSnapshot = ($cuota->cuota + $cuota->interes_moratorio) - $cuota->movimiento_total;
            }

            // A. Pendientes
            $pendienteMora = max(0.0, $cuota->interes_moratorio - $cuota->movimiento_interes_moratorio);

            // Separar pendientes de interés corriente y vencido
            $pendienteIntVencido = max(0.0, ($cuota->int_corriente_vencido ?? 0) - ($cuota->movimiento_int_corriente_vencido ?? 0));
            $pendienteIntCorriente = max(0.0, ($cuota->interes_corriente ?? 0) - ($cuota->movimiento_interes_corriente ?? 0));

            // Sumar carry de interés al pendiente vencido primero
            $pendienteIntVencido += $carryInteres;

            $pendientePoliza = max(0.0, $cuota->poliza - $cuota->movimiento_poliza);
            $pendientePrincipal = max(0.0, $cuota->amortizacion - $cuota->movimiento_principal) + $carryAmort;

            // B. Aplicar Pagos
            $pagoMora = min($dineroDisponible, $pendienteMora);
            $cuota->movimiento_interes_moratorio += $pagoMora;
            $dineroDisponible -= $pagoMora;

            // Pagar primero interés corriente vencido
            $pagoIntVencido = 0;
            if ($dineroDisponible > 0 && $pendienteIntVencido > 0) {
                $pagoIntVencido = min($dineroDisponible, $pendienteIntVencido);
                $cuota->movimiento_int_corriente_vencido = ($cuota->movimiento_int_corriente_vencido ?? 0) + $pagoIntVencido;
                $dineroDisponible -= $pagoIntVencido;
            }

            // Luego pagar interés corriente
            $pagoIntCorriente = 0;
            if ($dineroDisponible > 0 && $pendienteIntCorriente > 0) {
                $pagoIntCorriente = min($dineroDisponible, $pendienteIntCorriente);
                $cuota->movimiento_interes_corriente += $pagoIntCorriente;
                $dineroDisponible -= $pagoIntCorriente;
            }

            $pagoPoliza = 0;
            if ($dineroDisponible > 0) {
                $pagoPoliza = min($dineroDisponible, $pendientePoliza);
                $cuota->movimiento_poliza += $pagoPoliza;
                $dineroDisponible -= $pagoPoliza;
            }

            $pagoPrincipal = 0;
            if ($dineroDisponible > 0) {
                $pagoPrincipal = min($dineroDisponible, $pendientePrincipal);
                $cuota->movimiento_principal += $pagoPrincipal;
                $dineroDisponible -= $pagoPrincipal;

                // ACUMULAR PARA EL DESCUENTO DE SALDO
                $capitalAmortizadoHoy += $pagoPrincipal;
            }

            // Calculate carry-over for next cuota
            $leftIntVencido = $pendienteIntVencido - $pagoIntVencido;
            $leftIntCorriente = $pendienteIntCorriente - $pagoIntCorriente;
            $leftAmort = $pendientePrincipal - $pagoPrincipal;

            // Only carry to next cuota, not last
            if ($i < $cuotasCount - 1) {
                // Carry suma ambos tipos de interés pendientes
                $carryInteres = max(0.0, $leftIntVencido + $leftIntCorriente);
                $carryAmort = max(0.0, $leftAmort);
            } else {
                $carryInteres = 0.0;
                $carryAmort = 0.0;
            }

            $totalPagadoEnEstaTransaccion = $pagoMora + $pagoIntVencido + $pagoIntCorriente + $pagoPoliza + $pagoPrincipal;
            $cuota->movimiento_total += $totalPagadoEnEstaTransaccion;
            $cuota->movimiento_amortizacion += $pagoPrincipal;
            $cuota->fecha_movimiento = $fecha;
            // La fecha de pago es igual a la fecha de movimiento
            if (!$cuota->fecha_pago) {
                $cuota->fecha_pago = $fecha;
            }

            // Calcular total exigible incluyendo int_corriente_vencido
            $totalExigible = $cuota->interes_corriente
                           + $cuota->int_corriente_vencido
                           + $cuota->interes_moratorio
                           + $cuota->poliza
                           + $cuota->amortizacion;

            if ($cuota->movimiento_total >= ($totalExigible - 0.05)) {
                $teniaMora = ((float) ($cuota->int_corriente_vencido ?? 0) > 0) || ((float) ($cuota->interes_moratorio ?? 0) > 0) || ((int) ($cuota->dias_mora ?? 0) > 0);
                $cuota->estado = 'Pagado';
                $cuota->concepto = $teniaMora ? 'Pago registrado (mora)' : 'Pago registrado';
            } else {
                $cuota->estado = 'Parcial';
                $cuota->concepto = 'Pago parcial';
            }

            // Registrar detalle de lo que este pago aportó a esta cuota
            if ($totalPagadoEnEstaTransaccion > 0) {
                $paymentDetails[] = [
                    'plan_de_pago_id' => $cuota->id,
                    'numero_cuota' => $cuota->numero_cuota,
                    'estado_anterior' => $cuota->getOriginal('estado'),
                    'pago_mora' => $pagoMora,
                    'pago_int_vencido' => $pagoIntVencido,
                    'pago_int_corriente' => $pagoIntCorriente,
                    'pago_poliza' => $pagoPoliza,
                    'pago_principal' => $pagoPrincipal,
                    'pago_total' => $totalPagadoEnEstaTransaccion,
                ];
            }

            $cuota->save();

            // En modo planilla (singleCuota), solo procesar UNA cuota y parar
            if ($singleCuotaMode && $cuota->estado === 'Pagado') {
                break;
            }
        }

        // --- CORRECCIÓN: Actualizar Saldo de forma INCREMENTAL ---
        // Restamos lo que se amortizó HOY al saldo que tenía el crédito ANTES de la transacción
        $credit->saldo = max(0.0, $credit->saldo - $capitalAmortizadoHoy);
        $credit->save();

        // Verificar y actualizar estado si ya no hay mora
        $this->checkAndUpdateCreditStatus($credit);

        // Recibo: monto = lo realmente consumido por este crédito (no el monto total de entrada)
        $montoConsumido = $montoEntrante - max(0, $dineroDisponible);
        $paymentRecord = CreditPayment::create([
            'credit_id'      => $credit->id,
            'planilla_upload_id' => $planillaUploadId,
            'numero_cuota'   => $primerCuotaAfectada ? $primerCuotaAfectada->numero_cuota : 0,
            'fecha_cuota'    => $primerCuotaAfectada ? $primerCuotaAfectada->fecha_corte : null,
            'fecha_pago'     => $fecha,
            'monto'          => $montoConsumido,
            'cuota'          => $primerCuotaAfectada ? (float) $primerCuotaAfectada->cuota : 0,
            'saldo_anterior' => $saldoCreditoAntes,
            'nuevo_saldo'    => $credit->saldo,
            'estado'         => 'Aplicado',
            'interes_corriente' => $credit->planDePagos()->sum('movimiento_interes_corriente'),
            'amortizacion'      => $credit->planDePagos()->sum('movimiento_amortizacion'),
            'source'            => $source,
            'movimiento_total'  => $dineroDisponible > 0 ? $dineroDisponible : 0,
            'cedula'            => $cedulaRef
        ]);

        // Flag: ¿la última cuota procesada tenía mora? (para decidir sobrante en cascada)
        $ultimaCuotaTeniaMora = false;
        if (!empty($paymentDetails)) {
            $lastDetail = end($paymentDetails);
            $ultimaCuotaTeniaMora = in_array($lastDetail['estado_anterior'], ['Mora', 'Parcial'])
                && ($lastDetail['pago_mora'] > 0 || $lastDetail['pago_int_vencido'] > 0);
        }
        $paymentRecord->ultima_cuota_tenia_mora = $ultimaCuotaTeniaMora;

        // Guardar detalles por cuota para posible reverso
        foreach ($paymentDetails as $detail) {
            $paymentRecord->details()->create($detail);
        }

        // ============================================================
        // ACCOUNTING_API_TRIGGER: Pago de Crédito (Específico por tipo)
        // ============================================================
        // Dispara asiento contable al registrar un pago:
        // DÉBITO: Banco CREDIPEP (monto del pago)
        // CRÉDITO: Cuentas por Cobrar (monto del pago)

        // Calcular componentes del monto para contabilidad — solo lo pagado EN ESTA TRANSACCIÓN
        // (no acumulado histórico del crédito)
        $interesMoratorio = array_sum(array_column($paymentDetails, 'pago_mora'));
        $interesVencido   = array_sum(array_column($paymentDetails, 'pago_int_vencido'));
        $interesCorriente = array_sum(array_column($paymentDetails, 'pago_int_corriente'));
        $poliza           = array_sum(array_column($paymentDetails, 'pago_poliza'));

        // sobrante contable: si se pasó explícitamente (-1 = no override), usar dineroDisponible
        $sobranteEnAsiento = $sobranteContable >= 0 ? $sobranteContable : max(0.0, $dineroDisponible);

        $context = [
            'reference' => "PAY-{$paymentRecord->id}-{$credit->reference}",
            'cedula' => $cedulaRef,
            'credit_id' => $credit->reference,
            'clienteNombre' => $credit->lead->name ?? null,
            'amount_breakdown' => [
                'total' => $montoEntrante,
                'interes_corriente' => $interesCorriente,
                'interes_moratorio' => $interesMoratorio,
                'poliza' => $poliza,
                'capital' => $capitalAmortizadoHoy,
                'sobrante' => $sobranteEnAsiento,
                'cargos_adicionales_total' => 0,
                'cargos_adicionales' => [],
            ],
        ];

        // Seleccionar trigger específico según el tipo de pago
        if ($source === 'Planilla') {
            // Obtener deductora del crédito para incluir en el asiento
            $context['deductora_id'] = $credit->deductora_id;
            $context['deductora_nombre'] = $credit->deductora->nombre ?? 'Sin deductora';

            $this->triggerAccountingEntry(
                'PAGO_PLANILLA',
                $montoEntrante,
                $context['reference'],
                $context
            );
        } elseif ($source === 'Ventanilla') {
            $this->triggerAccountingEntry(
                'PAGO_VENTANILLA',
                $montoEntrante,
                $context['reference'],
                $context
            );
        } else {
            // Para otros tipos (Adelanto, Saldo Pendiente, etc.) usar el método genérico
            $this->triggerAccountingEntry(
                'PAGO_GENERICO',
                $montoEntrante,
                $context['reference'],
                $context
            );
        }

        return $paymentRecord;
    }

    /**
     * Wrapper público para que otros controllers puedan usar processPaymentTransaction
     */
    public function processPaymentTransactionPublic(Credit $credit, float $montoEntrante, $fecha, string $source, ?string $cedulaRef = null, $planillaUploadId = null): CreditPayment
    {
        return $this->processPaymentTransaction($credit, $montoEntrante, $fecha, $source, $cedulaRef, null, false, $planillaUploadId);
    }

    /**
     * Carga masiva de planilla con cálculo de mora
     *
     * Flujo:
     * 1. Procesa pagos para personas EN la lista (de la deductora seleccionada)
     * 2. Calcula mora para créditos de ESA deductora que NO están en la lista
     */
    public function upload(Request $request)
    {
        $validated = $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv,txt|mimetypes:text/csv,text/plain,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'deductora_id' => 'required|exists:deductoras,id',
            'fecha_test' => 'nullable|date', // Solo para pruebas en localhost
        ]);

        $deductoraId = $request->input('deductora_id');

        // Usar fecha de prueba si se proporciona (solo para desarrollo/testing)
        $fechaTest = $request->input('fecha_test');
        $fechaPago = $fechaTest ? Carbon::parse($fechaTest) : now();

        // VALIDACIÓN: Solo 1 planilla por deductora por mes
        $mesInicio = $fechaPago->copy()->startOfMonth();
        $mesFin = $fechaPago->copy()->endOfMonth();
        $yaExiste = CreditPayment::where('source', 'Planilla')
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

        $file = $request->file('file');
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
            'cantidad_pagos' => 0, // Se actualizará después
            'monto_total' => 0, // Se actualizará después
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

                // Detectar formato de monto: europeo (8.167,97) vs americano (8,167.97)
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
                $montoPagado = (float) preg_replace('/[^0-9\.]/', '', $cleanMonto);

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

                    // Para clientes con múltiples créditos, el sobrante de créditos intermedios
                    // pasa al siguiente crédito (no va a retenciones), así que se fuerza sobrante=0
                    // en el asiento contable de esos créditos intermedios.
                    $esCascadeMultiple = $credits->count() > 1;
                    $payment = DB::transaction(function () use ($cascadeCreditId, $montoParaCredito, $fechaPago, $rawCedula, $planillaId, $esCascadeMultiple) {
                        $c = Credit::lockForUpdate()->findOrFail($cascadeCreditId);
                        return $this->processPaymentTransaction($c, $montoParaCredito, $fechaPago, 'Planilla', $rawCedula, null, true, $planillaId, $esCascadeMultiple ? 0.0 : -1);
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

                    // Solo auto-aplicar sobrante si la ÚLTIMA cuota procesada tenía mora.
                    // Si era un pago normal con excedente → SaldoPendiente.
                    $ultimaCuotaTeniaMora = $lastPayment->ultima_cuota_tenia_mora ?? false;

                    if ($proximaCuota && $ultimaCuotaTeniaMora) {
                        // Sobrante de pago de mora → aplicar como parcial a siguiente cuota
                        DB::transaction(function () use ($lastCredit, $dineroDisponible, $fechaPago, $rawCedula, $planillaId) {
                            $c = Credit::lockForUpdate()->findOrFail($lastCredit->id);
                            $this->processPaymentTransaction($c, $dineroDisponible, $fechaPago, 'Planilla', $rawCedula, null, true, $planillaId);
                        });
                        $resultItem['parcial_aplicado'] = $dineroDisponible;
                    } else {
                        // Sin próxima cuota pendiente (crédito al día o cerrado) → SaldoPendiente
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

                        // ============================================================
                        // ACCOUNTING_API_TRIGGER: Retención de Sobrante de Planilla
                        // ============================================================
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

            // PASO 2: Calcular mora para créditos de ESTA deductora que NO pagaron
            $moraResults = $this->calcularMoraAusentes($deductoraId, $creditosQuePagaron, $mesPago, $diasDelMes, $tasaMora);

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

            // Actualizar totales de la planilla
            $planillaUpload->update([
                'cantidad_pagos' => count($results),
                'monto_total' => CreditPayment::where('planilla_upload_id', $planillaUpload->id)->sum('monto'),
            ]);

            return response()->json([
                'message' => 'Proceso completado',
                'planilla_id' => $planillaUpload->id,
                'results' => $results,
                'mora_aplicada' => $moraResults,
                'saldos_pendientes' => $saldosPendientes,
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Calcula mora para créditos formalizados de una deductora que NO están en la planilla
     * Calcula el monto total para cancelación anticipada de un crédito.
     * Si la última cuota pagada es menor a 12, se penaliza con 3 cuotas adicionales.
     */
    public function calcularCancelacionAnticipada(Request $request)
    {
        $validated = $request->validate([
            'credit_id' => 'required|exists:credits,id',
        ]);

        $credit = Credit::findOrFail($validated['credit_id']);

        // Buscar la última cuota pagada
        $ultimaCuotaPagada = $credit->planDePagos()
            ->where('numero_cuota', '>', 0)
            ->whereIn('estado', ['Pagado', 'Pagada'])
            ->orderBy('numero_cuota', 'desc')
            ->first();

        $numeroCuotaActual = $ultimaCuotaPagada ? $ultimaCuotaPagada->numero_cuota : 0;

        // Saldo de capital pendiente
        $saldoCapital = (float) $credit->saldo;

        // Sumar intereses vencidos de cuotas en mora
        $interesesVencidos = (float) $credit->planDePagos()
            ->where('numero_cuota', '>', 0)
            ->where('estado', 'Mora')
            ->sum('int_corriente_vencido');

        $saldoPendiente = round($saldoCapital + $interesesVencidos, 2);

        // Valor de la cuota mensual
        $cuotaMensual = (float) $credit->cuota;

        // Penalización: suma de los 3 intereses corrientes de las próximas cuotas por vencer (si está antes de la cuota 12)
        $penalizacion = 0;
        $cuotasPenalizacion = 0;
        $interesesPenalizacion = [];
        if ($numeroCuotaActual < 12) {
            // Obtener las próximas 3 cuotas pendientes
            $proximasCuotas = $credit->planDePagos()
                ->where('numero_cuota', '>', $numeroCuotaActual)
                ->where('estado', '!=', 'Pagado')
                ->orderBy('numero_cuota')
                ->take(3)
                ->get();

            // Sumar solo los intereses corrientes de esas cuotas
            foreach ($proximasCuotas as $cuota) {
                $interesCorriente = (float) $cuota->interes_corriente;
                $interesesPenalizacion[] = [
                    'numero_cuota' => $cuota->numero_cuota,
                    'interes_corriente' => $interesCorriente
                ];
                $penalizacion += $interesCorriente;
            }

            $cuotasPenalizacion = count($proximasCuotas);
            $penalizacion = round($penalizacion, 2);
        }

        $montoTotalCancelar = round($saldoPendiente + $penalizacion, 2);

        return response()->json([
            'credit_id' => $credit->id,
            'cuota_actual' => $numeroCuotaActual,
            'saldo_capital' => $saldoCapital,
            'intereses_vencidos' => $interesesVencidos,
            'saldo_pendiente' => $saldoPendiente,
            'cuota_mensual' => $cuotaMensual,
            'aplica_penalizacion' => $numeroCuotaActual < 12,
            'cuotas_penalizacion' => $cuotasPenalizacion,
            'intereses_penalizacion' => $interesesPenalizacion,
            'monto_penalizacion' => $penalizacion,
            'monto_total_cancelar' => $montoTotalCancelar,
        ]);
    }

    /**
     * Preview del abono extraordinario con penalización y cálculo de nueva cuota/plazo
     */
    public function previewAbonoExtraordinario(Request $request)
    {
        $validated = $request->validate([
            'credit_id' => 'required|exists:credits,id',
            'monto' => 'required|numeric|min:0.01',
            'strategy' => 'required|in:reduce_amount,reduce_term',
        ]);

        $credit = Credit::findOrFail($validated['credit_id']);
        $montoAbono = (float) $validated['monto'];
        $strategy = $validated['strategy'];

        // Buscar la última cuota pagada para determinar penalización
        $ultimaCuotaPagada = $credit->planDePagos()
            ->where('numero_cuota', '>', 0)
            ->whereIn('estado', ['Pagado', 'Pagada'])
            ->orderBy('numero_cuota', 'desc')
            ->first();

        $numeroCuotaActual = $ultimaCuotaPagada ? $ultimaCuotaPagada->numero_cuota : 0;
        $saldoActual = (float) $credit->saldo;
        $cuotaActual = (float) $credit->cuota;
        $plazoActual = (int) $credit->plazo;

        // Calcular penalización si está antes de la cuota 12
        $penalizacion = 0;
        $cuotasPenalizacion = 0;
        $interesesPenalizacion = [];
        $aplicaPenalizacion = $numeroCuotaActual < 12;

        if ($aplicaPenalizacion) {
            // Obtener las próximas 3 cuotas pendientes
            $proximasCuotas = $credit->planDePagos()
                ->where('numero_cuota', '>', $numeroCuotaActual)
                ->where('estado', '!=', 'Pagado')
                ->orderBy('numero_cuota')
                ->take(3)
                ->get();

            // Sumar solo los intereses corrientes
            foreach ($proximasCuotas as $cuota) {
                $interesCorriente = (float) $cuota->interes_corriente;
                $interesesPenalizacion[] = [
                    'numero_cuota' => $cuota->numero_cuota,
                    'interes_corriente' => $interesCorriente
                ];
                $penalizacion += $interesCorriente;
            }

            $cuotasPenalizacion = count($proximasCuotas);
            $penalizacion = round($penalizacion, 2);
        }

        // La penalización se RESTA del monto que se abona, no se suma
        $montoAplicarAlSaldo = max(0, $montoAbono - $penalizacion);

        // Calcular nuevo saldo después de aplicar el abono
        $nuevoSaldo = max(0, $saldoActual - $montoAplicarAlSaldo);

        // Buscar la primera cuota pendiente para calcular cuántas faltan
        $siguienteCuota = $credit->planDePagos()
            ->where('estado', '!=', 'Pagado')
            ->where('numero_cuota', '>', 0)
            ->orderBy('numero_cuota', 'asc')
            ->first();

        if (!$siguienteCuota) {
            return response()->json(['message' => 'No hay cuotas pendientes'], 400);
        }

        $numeroCuotaInicio = $siguienteCuota->numero_cuota;
        $cuotasRestantes = $plazoActual - $numeroCuotaInicio + 1;

        $tasaAnual = (float) $credit->tasa_anual;
        $tasaMensual = ($tasaAnual / 100) / 12;

        $nuevaCuota = $cuotaActual;
        $nuevoPlazo = $plazoActual;

        if ($nuevoSaldo > 0 && $cuotasRestantes > 0) {
            if ($strategy === 'reduce_amount') {
                // Reducir cuota, mantener plazo
                if ($tasaMensual > 0) {
                    $potencia = pow(1 + $tasaMensual, $cuotasRestantes);

                    // Validar que la potencia sea válida y el denominador no sea cero
                    if (is_finite($potencia) && $potencia > 1) {
                        $nuevaCuota = $nuevoSaldo * ($tasaMensual * $potencia) / ($potencia - 1);
                    } else {
                        // Fallback a cálculo simple
                        $nuevaCuota = $nuevoSaldo / $cuotasRestantes;
                    }
                } else {
                    $nuevaCuota = $nuevoSaldo / $cuotasRestantes;
                }
                $nuevaCuota = round($nuevaCuota, 2);
            } else {
                // Reducir plazo, mantener cuota
                if ($tasaMensual > 0 && $cuotaActual > 0) {
                    // Usar fórmula de amortización francesa para calcular el número de cuotas
                    $valor_dentro_log = ($cuotaActual * $tasaMensual) / ($cuotaActual - ($nuevoSaldo * $tasaMensual));

                    // Validar que el valor dentro del log sea positivo
                    if ($valor_dentro_log > 0) {
                        $cuotasNecesarias = log($valor_dentro_log) / log(1 + $tasaMensual);
                        $nuevoPlazo = $numeroCuotaInicio - 1 + ceil($cuotasNecesarias);
                    } else {
                        // Si el cálculo falla, usar cálculo simple
                        $nuevoPlazo = $numeroCuotaInicio - 1 + ceil($nuevoSaldo / $cuotaActual);
                    }

                    // Asegurar que el nuevo plazo sea razonable
                    $nuevoPlazo = max($numeroCuotaInicio, min($nuevoPlazo, $plazoActual));
                } else {
                    $nuevoPlazo = $numeroCuotaInicio - 1 + ceil($nuevoSaldo / $cuotaActual);
                }
            }
        }

        // Calcular las próximas 3 cuotas futuras con los nuevos valores
        $cuotasFuturas = [];
        if ($nuevoSaldo > 0) {
            $saldoIteracion = $nuevoSaldo;
            $cuotasAProyectar = min(3, $cuotasRestantes);

            for ($i = 0; $i < $cuotasAProyectar; $i++) {
                $numeroRealCuota = $numeroCuotaInicio + $i;
                $interesFuturo = round($saldoIteracion * $tasaMensual, 2);

                if ($strategy === 'reduce_amount') {
                    // Cuota reducida
                    $amortizacionFutura = round($nuevaCuota - $interesFuturo, 2);
                    $cuotaFutura = $nuevaCuota;
                } else {
                    // Plazo reducido, cuota se mantiene
                    $amortizacionFutura = round($cuotaActual - $interesFuturo, 2);
                    $cuotaFutura = $cuotaActual;
                }

                $nuevoSaldoIteracion = max(0, round($saldoIteracion - $amortizacionFutura, 2));

                $cuotasFuturas[] = [
                    'numero_cuota' => $numeroRealCuota,
                    'cuota' => $cuotaFutura,
                    'interes_corriente' => $interesFuturo,
                    'amortizacion' => $amortizacionFutura,
                    'saldo' => $nuevoSaldoIteracion,
                ];

                $saldoIteracion = $nuevoSaldoIteracion;
            }
        }

        // Asegurar que todos los valores sean finitos antes de devolver
        $nuevaCuota = is_finite($nuevaCuota) ? $nuevaCuota : $cuotaActual;
        $nuevoPlazo = is_finite($nuevoPlazo) && $nuevoPlazo > 0 ? $nuevoPlazo : $plazoActual;

        return response()->json([
            'credit_id' => $credit->id,
            'cuota_actual' => $numeroCuotaActual,
            'strategy' => $strategy,
            'monto_abono' => $montoAbono,
            'aplica_penalizacion' => $aplicaPenalizacion,
            'cuotas_penalizacion' => $cuotasPenalizacion,
            'intereses_penalizacion' => $interesesPenalizacion,
            'monto_penalizacion' => $penalizacion,
            'monto_aplicar_al_saldo' => $montoAplicarAlSaldo,
            'saldo_actual' => $saldoActual,
            'nuevo_saldo' => $nuevoSaldo,
            'cuota_actual_valor' => $cuotaActual,
            'nueva_cuota' => $nuevaCuota,
            'plazo_actual' => $plazoActual,
            'nuevo_plazo' => $nuevoPlazo,
            'cuotas_restantes' => $cuotasRestantes,
            'ahorro_cuota' => $strategy === 'reduce_amount' ? round($cuotaActual - $nuevaCuota, 2) : 0,
            'ahorro_plazo' => $strategy === 'reduce_term' ? max(0, $plazoActual - $nuevoPlazo) : 0,
            'cuotas_futuras' => $cuotasFuturas,
        ]);
    }

    /**
     * Procesa la cancelación anticipada de un crédito.
     * Aplica penalización si corresponde y cierra el crédito.
     */
    public function cancelacionAnticipada(Request $request)
    {
        $validated = $request->validate([
            'credit_id' => 'required|exists:credits,id',
            'fecha'     => 'required|date',
        ]);

        return DB::transaction(function () use ($validated) {
            $credit = Credit::lockForUpdate()->findOrFail($validated['credit_id']);

            // Calcular montos
            $ultimaCuotaPagada = $credit->planDePagos()
                ->where('numero_cuota', '>', 0)
                ->whereIn('estado', ['Pagado', 'Pagada'])
                ->orderBy('numero_cuota', 'desc')
                ->first();

            $numeroCuotaActual = $ultimaCuotaPagada ? $ultimaCuotaPagada->numero_cuota : 0;
            $saldoCapital = (float) $credit->saldo;
            $cuotaMensual = (float) $credit->cuota;

            // Sumar intereses vencidos de cuotas en mora
            $interesesVencidos = (float) $credit->planDePagos()
                ->where('numero_cuota', '>', 0)
                ->where('estado', 'Mora')
                ->sum('int_corriente_vencido');

            $saldoPendiente = round($saldoCapital + $interesesVencidos, 2);

            $penalizacion = 0;
            if ($numeroCuotaActual < 12) {
                $penalizacion = round($cuotaMensual * 3, 2);
            }

            $montoTotalCancelar = round($saldoPendiente + $penalizacion, 2);

            // Snapshot para reverso: capturar cuotas que serán marcadas como Pagado
            $cuotasAfectadas = $credit->planDePagos()
                ->where('numero_cuota', '>', 0)
                ->whereIn('estado', ['Pendiente', 'Mora'])
                ->get();

            $reversalSnapshot = [
                'type' => 'cancelacion_anticipada',
                'original_credit_saldo' => (float) $credit->saldo,
                'original_status' => $credit->status,
                'cuotas_afectadas' => $cuotasAfectadas->map(fn($c) => [
                    'plan_de_pago_id' => $c->id,
                    'numero_cuota' => $c->numero_cuota,
                    'estado_anterior' => $c->estado,
                    'fecha_pago_anterior' => $c->fecha_pago,
                ])->toArray(),
            ];

            // Registrar pago de cancelación anticipada
            $payment = CreditPayment::create([
                'credit_id'      => $credit->id,
                'numero_cuota'   => 0,
                'fecha_cuota'    => $validated['fecha'],
                'fecha_pago'     => $validated['fecha'],
                'monto'          => $montoTotalCancelar,
                'cuota'          => 0,
                'cargos'         => 0,
                'poliza'         => 0,
                'interes_corriente' => $interesesVencidos,
                'interes_moratorio' => 0,
                'amortizacion'   => $saldoCapital,
                'saldo_anterior' => $saldoPendiente,
                'nuevo_saldo'    => 0,
                'estado'         => 'Aplicado',
                'source'         => 'Cancelación Anticipada',
                'cedula'         => $credit->lead->cedula ?? null,
                'reversal_snapshot' => $reversalSnapshot,
                'estado_reverso' => 'Vigente',
            ]);

            // Marcar todas las cuotas pendientes como pagadas
            $credit->planDePagos()
                ->where('numero_cuota', '>', 0)
                ->whereIn('estado', ['Pendiente', 'Mora'])
                ->update([
                    'estado' => 'Pagado',
                    'fecha_pago' => $validated['fecha'],
                ]);

            // Cerrar el crédito
            $credit->saldo = 0;
            $credit->status = 'Cerrado';
            $credit->save();

            // Crear tarea para adjuntar pagaré firmado
            if ($credit->assigned_to) {
                $existingTask = Task::where('project_code', $credit->reference)
                    ->where('title', 'Adjuntar pagaré firmado')
                    ->whereNotIn('status', ['deleted'])
                    ->first();

                if (!$existingTask) {
                    Task::create([
                        'project_code' => $credit->reference,
                        'project_name' => (string) $credit->id,
                        'title' => 'Adjuntar pagaré firmado',
                        'details' => 'El crédito ha sido pagado completamente. Se requiere adjuntar el pagaré firmado por el cliente.',
                        'status' => 'pendiente',
                        'priority' => 'alta',
                        'assigned_to' => $credit->assigned_to,
                        'start_date' => now(),
                        'due_date' => now()->addDays(3),
                    ]);
                }
            }

            // ============================================================
            // ACCOUNTING_API_TRIGGER: Cancelación Anticipada (Pago Total)
            // ============================================================
            // Dispara asiento contable al cancelar anticipadamente:
            // DÉBITO: Banco CREDIPEP (monto_total_cancelar)
            // CRÉDITO: Cuentas por Cobrar (capital + intereses)
            // CRÉDITO: Ingreso Penalización (penalización) - si aplica
            $this->triggerAccountingEntry(
                'CANCELACION_ANTICIPADA',
                $montoTotalCancelar,
                "CANCEL-{$payment->id}-{$credit->reference}",
                [
                    'reference' => "CANCEL-{$payment->id}-{$credit->reference}",
                    'credit_id' => $credit->reference,
                    'cedula' => $credit->lead->cedula ?? null,
                    'clienteNombre' => $credit->lead->name ?? null,
                    'amount_breakdown' => [
                        'total' => $montoTotalCancelar,
                        'interes_corriente' => $interesesVencidos,
                        'interes_moratorio' => 0,
                        'poliza' => 0,
                        'capital' => $saldoCapital,
                        'cargos_adicionales_total' => $penalizacion,
                        'cargos_adicionales' => [
                            'penalizacion' => $penalizacion,
                        ],
                    ],
                ]
            );

            return response()->json([
                'message' => 'Crédito cancelado anticipadamente',
                'payment' => $payment,
                'monto_total' => $montoTotalCancelar,
                'penalizacion' => $penalizacion,
                'cuota_actual' => $numeroCuotaActual,
                'aplico_penalizacion' => $numeroCuotaActual < 12,
            ]);
        });
    }

    /**
     * Lógica:
     * 1. Marca la cuota pendiente más antigua como "Mora" SIN modificar montos originales
     * 2. Mueve interes_corriente → int_corriente_vencido
     * 3. Si tasa_anual = tasa_maxima → interes_moratorio = 0
     * 4. Agrega cuota desplazada al final del plan para que el saldo llegue a 0
     * 5. NO recalcula cuotas siguientes
     */
    private function calcularMoraAusentes($deductoraId, $creditosQuePagaron, $mesPago, $diasDelMes, $tasaMora)
    {
        $moraResults = [];

        $creditosSinPago = Credit::whereIn('status', ['Formalizado', 'En Mora'])
            ->whereNotNull('formalized_at')
            ->whereNotIn('id', $creditosQuePagaron)
            ->where('deductora_id', $deductoraId)
            ->get();

        foreach ($creditosSinPago as $credit) {
            $moraResults[] = $this->aplicarMoraACuota($credit, $mesPago);
        }

        return $moraResults;
    }

    /**
     * Aplica mora e interés corriente vencido a la cuota pendiente más antigua de un crédito.
     * Lógica reutilizable desde planilla (calcularMoraAusentes) y desde carga manual (sin deductora).
     */
    private function aplicarMoraACuota(Credit $credit, Carbon $mesPago): array
    {
        $inicioMora = Carbon::parse($credit->formalized_at)
            ->startOfMonth()
            ->addMonth();

        if ($mesPago->lt($inicioMora)) {
            return [
                'credit_id' => $credit->id,
                'lead' => $credit->lead->name ?? 'N/A',
                'status' => 'muy_nuevo',
                'mensaje' => 'Crédito muy nuevo, aún no genera mora'
            ];
        }

        // Buscar cuota pendiente más antigua
        $cuota = $credit->planDePagos()
            ->where('numero_cuota', '>', 0)
            ->where('estado', 'Pendiente')
            ->orderBy('numero_cuota')
            ->first();

        if (!$cuota) {
            return [
                'credit_id' => $credit->id,
                'lead' => $credit->lead->name ?? 'N/A',
                'status' => 'sin_cuotas_pendientes'
            ];
        }

        // Tasa congelada del crédito
        $tasaBase = (float) ($credit->tasa_anual ?? 0);
        $tasaMaxima = (float) ($credit->tasa_maxima ?? 0);
        $diferenciaTasa = $tasaMaxima - $tasaBase;

        // Guardar amortización original para la cuota desplazada
        $amortizacionOriginal = (float) $cuota->amortizacion;

        // Capital REAL del crédito (no el planificado)
        $capitalReal = (float) $credit->saldo;
        $tasaMensual = $tasaBase / 100 / 12;

        // 1. Interés vencido = calculado sobre el capital REAL (no el planificado)
        $interesVencido = round($capitalReal * $tasaMensual, 2);
        $cuota->int_corriente_vencido = $interesVencido;
        $cuota->interes_corriente = 0;

        // 2. Interés moratorio: solo si hay diferencia entre tasas
        if ($diferenciaTasa > 0) {
            $interesMoratorio = round($capitalReal * $diferenciaTasa / 100 / 12, 2);
            $cuota->interes_moratorio = ($cuota->interes_moratorio ?? 0) + $interesMoratorio;
        } else {
            $cuota->interes_moratorio = 0;
        }

        // 3. No se pagó: amortización = 0, capital no baja
        $cuota->amortizacion = 0;

        // 4. Capital (saldo_anterior) = capital REAL, no baja
        $cuota->saldo_anterior = $capitalReal;

        // 5. Saldo por pagar = saldo_nuevo de la cuota anterior + intereses de este mes
        $intMora = (float) $cuota->interes_moratorio;
        $poliza = (float) ($cuota->poliza ?? 0);

        $cuotaAnterior = $credit->planDePagos()
            ->where('numero_cuota', '<', $cuota->numero_cuota)
            ->where('numero_cuota', '>', 0)
            ->orderBy('numero_cuota', 'desc')
            ->first();

        $saldoPrevio = $cuotaAnterior ? (float) $cuotaAnterior->saldo_nuevo : $capitalReal;
        $cuota->saldo_nuevo = round($saldoPrevio + $interesVencido + $intMora + $poliza, 2);

        // 6. Marcar como Mora
        $cuota->estado = 'Mora';
        $cuota->dias_mora = 30;
        $cuota->save();

        // 7. Recalcular la SIGUIENTE cuota pendiente para que refleje el capital real
        $siguienteCuota = $credit->planDePagos()
            ->where('numero_cuota', '>', $cuota->numero_cuota)
            ->where('estado', 'Pendiente')
            ->orderBy('numero_cuota')
            ->first();

        if ($siguienteCuota) {
            $siguienteCuota->saldo_anterior = $capitalReal;
            $siguienteCuota->interes_corriente = $interesVencido;
            $siguienteCuota->amortizacion = round($siguienteCuota->cuota - $interesVencido - ($siguienteCuota->poliza ?? 0), 2);
            $siguienteCuota->saldo_nuevo = round($capitalReal - $siguienteCuota->amortizacion, 2);
            $siguienteCuota->save();
        }

        // 8. Agregar cuota desplazada al final del plan (con la amortización original)
        $this->agregarCuotaDesplazada($credit, $amortizacionOriginal);

        // 9. Cambiar estado del crédito
        Credit::where('id', $credit->id)->update(['status' => 'En Mora']);

        return [
            'credit_id' => $credit->id,
            'lead' => $credit->lead->name ?? 'N/A',
            'cuota_numero' => $cuota->numero_cuota,
            'int_corriente_vencido' => $interesVencido,
            'tasa_base' => $tasaBase,
            'tasa_maxima' => $tasaMaxima,
            'diferencia_tasa' => $diferenciaTasa,
            'interes_moratorio' => (float) $cuota->interes_moratorio,
            'status' => 'mora_aplicada'
        ];
    }

    /**
     * Agrega una cuota al final del plan cuando una cuota entra en mora (desplazamiento)
     *
     * La cuota en mora no se pagó, así que su amortización no se aplicó al saldo.
     * Esta nueva cuota al final del plan cubre ese capital pendiente para que
     * el saldo llegue a 0 al terminar el plan extendido.
     *
     * @param Credit $credit El crédito
     * @param float $amortizacionOriginal La amortización que no se pagó en la cuota mora
     */
    private function agregarCuotaDesplazada(Credit $credit, float $amortizacionOriginal)
    {
        if ($amortizacionOriginal <= 0) return;

        $plazo = (int) $credit->plazo;
        $tasaAnual = (float) ($credit->tasa_anual ?? 0);
        $tasaMensual = $tasaAnual / 100 / 12;

        // 1. Incrementar saldo_nuevo de la última cuota del plazo original
        $credit->planDePagos()
            ->where('numero_cuota', $plazo)
            ->increment('saldo_nuevo', $amortizacionOriginal);

        // 2. Eliminar cuotas desplazadas anteriores (se van a regenerar)
        $credit->planDePagos()
            ->where('numero_cuota', '>', $plazo)
            ->delete();

        // 3. Obtener el total de capital desplazado
        $cuotaPlazo = $credit->planDePagos()
            ->where('numero_cuota', $plazo)
            ->first();

        $totalDesplazado = (float) $cuotaPlazo->saldo_nuevo;
        if ($totalDesplazado <= 0) return;

        // 4. Obtener cuota fija del crédito (de cualquier cuota normal)
        $cuotaNormal = $credit->planDePagos()
            ->where('numero_cuota', 1)
            ->first();
        $cuotaFija = (float) $cuotaNormal->cuota;

        // 5. Generar cuotas desplazadas con sistema francés
        $saldo = $totalDesplazado;
        $numero = $plazo + 1;
        $fechaBase = Carbon::parse($cuotaPlazo->fecha_corte);

        while ($saldo > 0.01) {
            $interes = round($saldo * $tasaMensual, 2);

            if ($saldo + $interes <= $cuotaFija) {
                // Última cuota: el saldo restante cabe en una sola cuota
                $amort = round($saldo, 2);
                $cuotaMonto = round($amort + $interes, 2);
            } else {
                // Cuota normal del mismo monto que las originales
                $cuotaMonto = $cuotaFija;
                $amort = round($cuotaFija - $interes, 2);
            }

            $saldoNuevo = round($saldo - $amort, 2);
            $saldoNuevo = max(0, $saldoNuevo);

            $fechaInicio = $fechaBase->copy();
            $fechaCorte = $fechaBase->copy()->addMonth();

            PlanDePago::create([
                'credit_id'         => $credit->id,
                'numero_cuota'      => $numero,
                'fecha_inicio'      => $fechaInicio,
                'fecha_corte'       => $fechaCorte,
                'tasa_actual'       => $tasaAnual,
                'cuota'             => $cuotaMonto,
                'poliza'            => 0,
                'interes_corriente' => $interes,
                'amortizacion'      => $amort,
                'saldo_anterior'    => $saldo,
                'saldo_nuevo'       => $saldoNuevo,
                'estado'            => 'Pendiente',
                'movimiento_total'  => 0,
                'movimiento_poliza' => 0,
                'movimiento_principal' => 0,
                'movimiento_interes_corriente' => 0,
                'movimiento_interes_moratorio' => 0,
            ]);

            $saldo = $saldoNuevo;
            $numero++;
            $fechaBase = $fechaCorte->copy();
        }
    }

    /**
     * Revertir un pago (solo el último pago vigente del crédito).
     * Soporta todos los tipos: Ventanilla, Adelanto, Planilla, Extraordinario, Cancelación Anticipada.
     */
    public function reversePayment(Request $request, int $paymentId)
    {
        $validated = $request->validate([
            'motivo' => 'required|string|max:255',
        ]);

        return DB::transaction(function () use ($paymentId, $validated) {
            $payment = CreditPayment::with('details')->findOrFail($paymentId);

            // 1. Validar que no esté ya anulado
            if ($payment->estado_reverso === 'Anulado') {
                return response()->json([
                    'message' => 'Este pago ya fue anulado anteriormente.'
                ], 422);
            }

            // 2. Validar que sea el último pago vigente del crédito (LIFO)
            $lastPayment = CreditPayment::where('credit_id', $payment->credit_id)
                ->where('estado_reverso', 'Vigente')
                ->orderBy('id', 'desc')
                ->first();

            if (!$lastPayment || $lastPayment->id !== $payment->id) {
                return response()->json([
                    'message' => 'Solo se puede revertir el último pago vigente del crédito. Revierta primero el pago #' . ($lastPayment->id ?? 'N/A') . '.'
                ], 422);
            }

            // 3. Bloquear crédito
            $credit = Credit::lockForUpdate()->findOrFail($payment->credit_id);

            // 4. Routing por tipo de pago
            if ($payment->source === 'Extraordinario') {
                return $this->reverseExtraordinario($payment, $credit, $validated['motivo']);
            }

            if ($payment->source === 'Cancelación Anticipada') {
                return $this->reverseCancelacionAnticipada($payment, $credit, $validated['motivo']);
            }

            // 5. Reversal basado en credit_payment_details (Ventanilla, Adelanto, Planilla)
            if ($payment->details->isEmpty()) {
                return response()->json([
                    'message' => 'Este pago no tiene detalles de cuotas registrados. Los pagos anteriores al sistema de reverso no pueden revertirse.'
                ], 422);
            }

            $capitalRevertido = 0.0;
            $cuotasRevertidas = 0;

            foreach ($payment->details as $detail) {
                $cuota = PlanDePago::lockForUpdate()->find($detail->plan_de_pago_id);
                if (!$cuota) continue;

                // Restar los deltas exactos
                $cuota->movimiento_interes_moratorio = max(0, $cuota->movimiento_interes_moratorio - $detail->pago_mora);
                $cuota->movimiento_int_corriente_vencido = max(0, ($cuota->movimiento_int_corriente_vencido ?? 0) - $detail->pago_int_vencido);
                $cuota->movimiento_interes_corriente = max(0, $cuota->movimiento_interes_corriente - $detail->pago_int_corriente);
                $cuota->movimiento_poliza = max(0, $cuota->movimiento_poliza - $detail->pago_poliza);
                $cuota->movimiento_principal = max(0, $cuota->movimiento_principal - $detail->pago_principal);
                $cuota->movimiento_amortizacion = max(0, $cuota->movimiento_amortizacion - $detail->pago_principal);
                $cuota->movimiento_total = max(0, $cuota->movimiento_total - $detail->pago_total);

                // Restaurar estado anterior o recalcular
                if ($cuota->movimiento_total <= 0.005) {
                    $cuota->estado = $detail->estado_anterior;
                    $cuota->concepto = null;
                    $cuota->fecha_pago = null;
                    $cuota->fecha_movimiento = null;
                } else {
                    $totalExigible = $cuota->interes_corriente
                        + ($cuota->int_corriente_vencido ?? 0)
                        + $cuota->interes_moratorio
                        + $cuota->poliza
                        + $cuota->amortizacion;

                    if ($cuota->movimiento_total >= ($totalExigible - 0.05)) {
                        $cuota->estado = 'Pagado';
                    } else {
                        $cuota->estado = 'Parcial';
                        $cuota->concepto = 'Pago parcial';
                    }
                }

                $cuota->save();
                $capitalRevertido += (float) $detail->pago_principal;
                $cuotasRevertidas++;
            }

            // Planilla: limpiar SaldoPendiente asociado
            if ($payment->source === 'Planilla') {
                SaldoPendiente::where('credit_payment_id', $payment->id)->delete();
            }

            // Restaurar saldo del crédito
            $credit->saldo = round((float) $credit->saldo + $capitalRevertido, 2);

            if ($credit->status === 'Cerrado') {
                $credit->status = 'Formalizado';
            }
            $credit->save();

            // Marcar pago como anulado
            $this->markPaymentAsAnulado($payment, $validated['motivo']);

            // ============================================================
            // ACCOUNTING_API_TRIGGER: Reverso de Pago
            // ============================================================
            // Dispara asiento contable al revertir un pago:
            // DÉBITO: Cuentas por Cobrar (monto del pago revertido)
            // CRÉDITO: Banco CREDIPEP (monto del pago revertido)
            $this->triggerAccountingEntry(
                'REVERSO_PAGO',
                (float) $payment->monto,
                "REVERSO-{$payment->id}-{$credit->reference}",
                [
                    'reference' => "REVERSO-{$payment->id}-{$credit->reference}",
                    'credit_id' => $credit->reference,
                    'cedula' => $credit->lead->cedula ?? null,
                    'clienteNombre' => $credit->lead->name ?? null,
                    'motivo' => $validated['motivo'],
                    'amount_breakdown' => [
                        'total' => (float) $payment->monto,
                        'interes_corriente' => 0,
                        'interes_moratorio' => 0,
                        'poliza' => 0,
                        'capital' => $capitalRevertido,
                        'cargos_adicionales_total' => 0,
                        'cargos_adicionales' => [],
                    ],
                ]
            );

            return response()->json([
                'message' => 'Pago revertido exitosamente.',
                'saldo_restaurado' => $credit->saldo,
                'cuotas_revertidas' => $cuotasRevertidas,
                'capital_revertido' => $capitalRevertido,
            ]);
        });
    }

    /**
     * Revertir un abono extraordinario usando el snapshot del plan.
     */
    private function reverseExtraordinario(CreditPayment $payment, Credit $credit, string $motivo)
    {
        $snapshot = $payment->reversal_snapshot;
        if (!$snapshot || empty($snapshot['plan_rows'])) {
            return response()->json([
                'message' => 'Este pago extraordinario no tiene snapshot de reverso. Los pagos anteriores al sistema de reverso no pueden revertirse.'
            ], 422);
        }

        $startCuotaNum = $snapshot['start_cuota_num'];

        // 1. Eliminar cuotas regeneradas
        PlanDePago::where('credit_id', $credit->id)
            ->where('numero_cuota', '>=', $startCuotaNum)
            ->delete();

        // 2. Restaurar cuotas originales desde snapshot
        foreach ($snapshot['plan_rows'] as $row) {
            unset($row['id'], $row['created_at'], $row['updated_at']);
            PlanDePago::create($row);
        }

        // 3. Restaurar valores del crédito
        $credit->saldo = $snapshot['original_saldo'];
        $credit->plazo = $snapshot['original_plazo'];
        $credit->cuota = $snapshot['original_cuota'];
        if (isset($snapshot['original_status']) && in_array($credit->status, ['Finalizado', 'Cerrado'])) {
            $credit->status = $snapshot['original_status'];
        }
        $credit->save();

        // 4. Marcar pago como anulado
        $this->markPaymentAsAnulado($payment, $motivo);

        // ============================================================
        // ACCOUNTING_API_TRIGGER: Reverso de Abono Extraordinario
        // ============================================================
        $this->triggerAccountingEntry(
            'REVERSO_EXTRAORDINARIO',
            (float) $payment->monto,
            "REVERSO-EXTRA-{$payment->id}-{$credit->reference}",
            [
                'reference' => "REVERSO-EXTRA-{$payment->id}-{$credit->reference}",
                'credit_id' => $credit->reference,
                'cedula' => $credit->lead->cedula ?? null,
                'clienteNombre' => $credit->lead->name ?? null,
                'motivo' => $motivo,
                'amount_breakdown' => [
                    'total' => (float) $payment->monto,
                    'interes_corriente' => 0,
                    'interes_moratorio' => 0,
                    'poliza' => 0,
                    'capital' => (float) $payment->monto,
                    'cargos_adicionales_total' => 0,
                    'cargos_adicionales' => [],
                ],
            ]
        );

        return response()->json([
            'message' => 'Abono extraordinario revertido. Plan de pagos restaurado.',
            'saldo_restaurado' => $credit->saldo,
            'cuotas_restauradas' => count($snapshot['plan_rows']),
            'capital_revertido' => (float) $payment->monto,
        ]);
    }

    /**
     * Revertir una cancelación anticipada usando el snapshot de cuotas.
     */
    private function reverseCancelacionAnticipada(CreditPayment $payment, Credit $credit, string $motivo)
    {
        $snapshot = $payment->reversal_snapshot;
        if (!$snapshot || empty($snapshot['cuotas_afectadas'])) {
            return response()->json([
                'message' => 'Este pago de cancelación anticipada no tiene snapshot de reverso. Los pagos anteriores al sistema de reverso no pueden revertirse.'
            ], 422);
        }

        $cuotasRevertidas = 0;

        // 1. Restaurar cada cuota a su estado original
        foreach ($snapshot['cuotas_afectadas'] as $cuotaInfo) {
            $cuota = PlanDePago::lockForUpdate()->find($cuotaInfo['plan_de_pago_id']);
            if (!$cuota) continue;

            $cuota->estado = $cuotaInfo['estado_anterior'];
            $cuota->fecha_pago = $cuotaInfo['fecha_pago_anterior'];
            $cuota->save();
            $cuotasRevertidas++;
        }

        // 2. Restaurar valores del crédito
        $credit->saldo = $snapshot['original_credit_saldo'];
        $credit->status = $snapshot['original_status'];
        $credit->save();

        // 3. Marcar pago como anulado
        $this->markPaymentAsAnulado($payment, $motivo);

        // ============================================================
        // ACCOUNTING_API_TRIGGER: Reverso de Cancelación Anticipada
        // ============================================================
        $this->triggerAccountingEntry(
            'REVERSO_CANCELACION',
            (float) $payment->monto,
            "REVERSO-CANCEL-{$payment->id}-{$credit->reference}",
            [
                'reference' => "REVERSO-CANCEL-{$payment->id}-{$credit->reference}",
                'credit_id' => $credit->reference,
                'cedula' => $credit->lead->cedula ?? null,
                'clienteNombre' => $credit->lead->name ?? null,
                'motivo' => $motivo,
                'amount_breakdown' => [
                    'total' => (float) $payment->monto,
                    'interes_corriente' => 0,
                    'interes_moratorio' => 0,
                    'poliza' => 0,
                    'capital' => (float) $payment->monto,
                    'cargos_adicionales_total' => 0,
                    'cargos_adicionales' => [],
                ],
            ]
        );

        return response()->json([
            'message' => 'Cancelación anticipada revertida. Crédito reabierto.',
            'saldo_restaurado' => $credit->saldo,
            'cuotas_revertidas' => $cuotasRevertidas,
            'capital_revertido' => $snapshot['original_credit_saldo'],
        ]);
    }

    /**
     * Marcar un CreditPayment como anulado.
     */
    private function markPaymentAsAnulado(CreditPayment $payment, string $motivo): void
    {
        $payment->estado_reverso = 'Anulado';
        $payment->motivo_anulacion = $motivo;
        $payment->anulado_por = Auth::id();
        $payment->fecha_anulacion = now();
        $payment->save();
    }

    /**
     * Verificar y actualizar el estado del crédito si ya no tiene cuotas en mora.
     * Helper para llamar después de cualquier operación que pueda resolver mora.
     */
    private function checkAndUpdateCreditStatus(Credit $credit): void
    {
        if ($credit->status === 'En Mora') {
            $tieneMora = $credit->planDePagos()
                ->where('numero_cuota', '>', 0)
                ->where('estado', 'Mora')
                ->exists();

            if (!$tieneMora) {
                $credit->status = 'Formalizado';
                $credit->save();
            }
        }
    }

    /**
     * Carga de intereses / mora para créditos SIN deductora.
     * Aplica la misma lógica que calcularMoraAusentes() pero de forma manual por lotes.
     */
    public function cargarInteresesSinDeductora(Request $request)
    {
        $validated = $request->validate([
            'credit_ids'   => 'required|array|min:1',
            'credit_ids.*' => 'integer|exists:credits,id',
        ]);

        $creditIds = $validated['credit_ids'];
        $mesPago = Carbon::now()->subMonth()->startOfMonth();

        // Validar que TODOS los créditos sean sin deductora y estén en status válido
        $creditos = Credit::whereIn('id', $creditIds)->get();

        $errores = [];
        foreach ($creditos as $credit) {
            if ($credit->deductora_id !== null) {
                $errores[] = "Crédito #{$credit->id} tiene deductora asignada. Use planilla para estos créditos.";
            }
            if (!in_array($credit->status, ['Formalizado', 'En Mora'])) {
                $errores[] = "Crédito #{$credit->id} tiene status '{$credit->status}'. Solo se procesan Formalizado o En Mora.";
            }
        }

        if (!empty($errores)) {
            return response()->json([
                'message' => 'Validación fallida',
                'errors'  => $errores,
            ], 422);
        }

        $results = [];

        DB::beginTransaction();
        try {
            foreach ($creditos as $credit) {
                $results[] = $this->aplicarMoraACuota($credit, $mesPago);
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error al procesar mora: ' . $e->getMessage(),
            ], 500);
        }

        // Contadores para el resumen
        $aplicadas    = collect($results)->where('status', 'mora_aplicada')->count();
        $muyNuevos    = collect($results)->where('status', 'muy_nuevo')->count();
        $sinPendiente = collect($results)->where('status', 'sin_cuotas_pendientes')->count();

        return response()->json([
            'message'  => "Mora calculada: {$aplicadas} créditos procesados, {$muyNuevos} muy nuevos, {$sinPendiente} sin cuotas pendientes.",
            'resumen'  => [
                'procesados'          => $aplicadas,
                'muy_nuevos'          => $muyNuevos,
                'sin_cuotas_pendientes' => $sinPendiente,
                'total'               => count($results),
            ],
            'detalle'  => $results,
        ]);
    }

    public function update(Request $request, string $id) { return response()->json([], 200); }
    public function destroy(string $id) { return response()->json([], 200); }
}
