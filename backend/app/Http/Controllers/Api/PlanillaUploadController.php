<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlanillaUpload;
use App\Models\CreditPayment;
use App\Models\PlanDePago;
use App\Models\Credit;
use App\Models\SaldoPendiente;
use App\Traits\AccountingTrigger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;

class PlanillaUploadController extends Controller
{
    use AccountingTrigger;
    /**
     * Listar historial de planillas con paginación y filtros
     */
    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 15); // Por defecto 15 por página

        $query = PlanillaUpload::with(['deductora', 'user', 'anuladaPor'])
            ->orderBy('id', 'desc');

        // Filtro por deductora
        if ($request->has('deductora_id') && $request->deductora_id) {
            $query->where('deductora_id', $request->deductora_id);
        }

        // Filtro por estado
        if ($request->has('estado') && $request->estado) {
            $query->where('estado', $request->estado);
        }

        // Filtro por rango de fechas
        if ($request->has('fecha_desde')) {
            $query->whereDate('fecha_planilla', '>=', $request->fecha_desde);
        }
        if ($request->has('fecha_hasta')) {
            $query->whereDate('fecha_planilla', '<=', $request->fecha_hasta);
        }

        // Filtro por usuario que cargó
        if ($request->has('user_id') && $request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        // Búsqueda global: ID, nombre de archivo, o usuario
        if ($request->has('search') && $request->search) {
            $searchTerm = $request->search;
            $query->where(function($q) use ($searchTerm) {
                $q->where('id', 'like', '%' . $searchTerm . '%')
                  ->orWhere('nombre_archivo', 'like', '%' . $searchTerm . '%')
                  ->orWhereHas('user', function($userQuery) use ($searchTerm) {
                      $userQuery->where('name', 'like', '%' . $searchTerm . '%');
                  });
            });
        }

        return response()->json($query->paginate($perPage));
    }

    /**
     * Detalle de una planilla
     */
    public function show($id)
    {
        $planilla = PlanillaUpload::with(['deductora', 'user', 'anuladaPor', 'creditPayments.credit.lead'])
            ->findOrFail($id);

        return response()->json($planilla);
    }

    /**
     * Anular planilla (reversar todos los movimientos)
     */
    public function anular(Request $request, $id)
    {
        // Solo administradores pueden anular
        $user = $request->user();
        if (!$user->role || (!$user->role->full_access && $user->role->name !== 'Administrador')) {
            return response()->json(['message' => 'Solo administradores pueden anular planillas'], 403);
        }

        $validated = $request->validate([
            'motivo' => 'required|string|max:500',
        ]);

        $planilla = PlanillaUpload::findOrFail($id);

        if ($planilla->estado === 'anulada') {
            return response()->json(['message' => 'La planilla ya está anulada'], 400);
        }

        DB::beginTransaction();
        try {
            // 1. Obtener todos los pagos de esta planilla
            $pagos = CreditPayment::where('planilla_upload_id', $planilla->id)->get();

            foreach ($pagos as $pago) {
                $credit = Credit::lockForUpdate()->find($pago->credit_id);

                // 2. Restaurar saldo del crédito
                if ($pago->amortizacion > 0) {
                    $credit->saldo = ((float) $credit->saldo) + ((float) $pago->amortizacion);
                }

                // 3. Restaurar status si entró en mora por esta planilla
                if ($credit->status === 'En Mora' && $pago->fecha_pago == $planilla->fecha_planilla) {
                    $credit->status = 'Formalizado';
                }
                $credit->save();

                // 4. Revertir movimientos en plan_de_pagos
                if ($pago->numero_cuota > 0) {
                    $cuota = PlanDePago::where('credit_id', $pago->credit_id)
                        ->where('numero_cuota', $pago->numero_cuota)
                        ->first();

                    if ($cuota) {
                        $cuota->movimiento_interes_moratorio = max(0, ((float) $cuota->movimiento_interes_moratorio) - ((float) $pago->interes_moratorio));
                        $cuota->movimiento_interes_corriente = max(0, ((float) $cuota->movimiento_interes_corriente) - ((float) $pago->interes_corriente));
                        $cuota->movimiento_amortizacion = max(0, ((float) $cuota->movimiento_amortizacion) - ((float) $pago->amortizacion));
                        $cuota->movimiento_principal = max(0, ((float) $cuota->movimiento_principal) - ((float) $pago->amortizacion));
                        $cuota->movimiento_poliza = max(0, ((float) $cuota->movimiento_poliza) - ((float) $pago->poliza));
                        $cuota->movimiento_total = max(0, ((float) $cuota->movimiento_total) - ((float) $pago->monto));

                        // Si todos los movimientos son 0, restaurar estado a Pendiente
                        if ($cuota->movimiento_total <= 0.01) {
                            $cuota->estado = 'Pendiente';
                            $cuota->fecha_movimiento = null;
                            $cuota->fecha_pago = null;
                        }

                        $cuota->save();
                    }
                }

                // 5. Capturar sobrante ANTES de eliminar SaldoPendiente
                $sobranteAnulado = (float) SaldoPendiente::where('credit_payment_id', $pago->id)->sum('monto');

                // 5. Eliminar saldos pendientes creados por esta planilla
                SaldoPendiente::where('credit_payment_id', $pago->id)->delete();

                // 6. Marcar pago como anulado (visible en historial de abonos)
                $pago->estado = 'Reversado';
                $pago->estado_reverso = 'Anulado';
                $pago->motivo_anulacion = $validated['motivo'];
                $pago->anulado_por = $user->id;
                $pago->fecha_anulacion = now();
                $pago->save();

                // ============================================================
                // ACCOUNTING_API_TRIGGER: Devolución/Anulación de Pago
                // ============================================================
                // Dispara asiento contable al revertir un pago:
                // DÉBITO: Cuentas por Cobrar (monto del pago revertido)
                // CRÉDITO: Banco CREDIPEP (monto del pago revertido)
                // $sobranteAnulado ya fue calculado arriba desde SaldoPendiente

                // El total debe incluir el sobrante para que el asiento cuadre
                // (es el espejo exacto del PAGO_PLANILLA original)
                $montoTotalOriginal = (float) $pago->monto + $sobranteAnulado;

                $this->triggerAccountingEntry(
                    'ANULACION_PLANILLA',
                    $montoTotalOriginal,
                    "ANULA-PLAN-{$pago->id}-{$credit->reference}",
                    [
                        'reference' => "ANULA-PLAN-{$pago->id}-{$credit->reference}",
                        'credit_id' => $credit->reference,
                        'cedula' => $pago->cedula,
                        'clienteNombre' => $credit->lead->name ?? null,
                        'motivo' => $validated['motivo'],
                        'deductora_id' => $planilla->deductora_id,
                        'fecha_planilla' => $planilla->fecha_planilla,
                        'amount_breakdown' => [
                            'total' => $montoTotalOriginal,
                            'interes_corriente' => (float) $pago->interes_corriente,
                            'interes_moratorio' => (float) $pago->interes_moratorio,
                            'poliza' => 0,
                            'capital' => (float) $pago->amortizacion,
                            'sobrante' => $sobranteAnulado,
                            'cargos_adicionales_total' => 0,
                            'cargos_adicionales' => [],
                        ],
                    ]
                );

                // ============================================================
                // ACCOUNTING_API_TRIGGER: Anulación de Sobrante de Planilla
                // ============================================================
                // Si el pago tenía un sobrante retenido, se dispara un segundo asiento
                // para revertir el SALDO_SOBRANTE original (espejo de SALDO_SOBRANTE).
                if ($sobranteAnulado > 0.50) {
                    $this->triggerAccountingEntry(
                        'ANULACION_SOBRANTE',
                        $sobranteAnulado,
                        "ANULA-SOB-{$pago->id}-{$credit->reference}",
                        [
                            'reference' => "ANULA-SOB-{$pago->id}-{$credit->reference}",
                            'credit_id' => $credit->reference,
                            'cedula' => $pago->cedula,
                            'clienteNombre' => $credit->lead->name ?? null,
                            'motivo' => $validated['motivo'],
                            'deductora_id' => $planilla->deductora_id,
                            'amount_breakdown' => [
                                'total' => $sobranteAnulado,
                                'sobrante' => $sobranteAnulado,
                                'interes_corriente' => 0,
                                'interes_moratorio' => 0,
                                'poliza' => 0,
                                'capital' => 0,
                                'cargos_adicionales_total' => 0,
                                'cargos_adicionales' => [],
                            ],
                        ]
                    );
                }
            }

            // 7. Marcar planilla como anulada
            $planilla->update([
                'estado' => 'anulada',
                'anulada_at' => now(),
                'anulada_por' => $user->id,
                'motivo_anulacion' => $validated['motivo'],
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Planilla anulada exitosamente',
                'planilla' => $planilla->fresh(['deductora', 'user', 'anuladaPor']),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error al anular planilla',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Descargar archivo de planilla
     */
    public function download($id)
    {
        $planilla = PlanillaUpload::findOrFail($id);

        if (!$planilla->ruta_archivo) {
            return response()->json([
                'message' => 'El archivo no está disponible'
            ], 404);
        }

        $filePath = storage_path('app/public/' . $planilla->ruta_archivo);

        if (!file_exists($filePath)) {
            return response()->json([
                'message' => 'El archivo no se encontró en el servidor'
            ], 404);
        }

        return response()->download($filePath, $planilla->nombre_archivo);
    }

    /**
     * Exportar resumen de distribución de planilla como Excel
     */
    public function exportResumen($id)
    {
        $planilla = PlanillaUpload::with(['deductora', 'user'])->findOrFail($id);

        $payments = CreditPayment::with(['credit.lead'])
            ->where('planilla_upload_id', $planilla->id)
            ->orderBy('id', 'asc')
            ->get();

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Resumen Planilla');

        // --- Encabezado general ---
        $sheet->setCellValue('A1', 'Resumen de Distribución de Planilla');
        $sheet->mergeCells('A1:H1');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet->setCellValue('A2', 'Deductora:');
        $sheet->setCellValue('B2', $planilla->deductora->nombre ?? '-');
        $sheet->setCellValue('D2', 'Fecha Planilla:');
        $sheet->setCellValue('E2', $planilla->fecha_planilla ?? '-');
        $sheet->setCellValue('A3', 'Procesada por:');
        $sheet->setCellValue('B3', $planilla->user->name ?? '-');
        $sheet->setCellValue('D3', 'Estado:');
        $sheet->setCellValue('E3', ucfirst($planilla->estado));
        $sheet->setCellValue('A4', 'Total Pagos:');
        $sheet->setCellValue('B4', $planilla->cantidad_pagos ?? $payments->count());
        $sheet->setCellValue('D4', 'Monto Total:');
        $sheet->setCellValue('E4', number_format((float) $planilla->monto_total, 2, '.', ','));

        // Estilos encabezado info
        foreach (['A2','D2','A3','D3','A4','D4'] as $cell) {
            $sheet->getStyle($cell)->getFont()->setBold(true);
        }

        // --- Fila de columnas ---
        $headerRow = 6;
        $headers = ['#', 'Operación', 'Deudor', 'Cédula', 'Cuota N°', 'Monto Pagado', 'Sobrante', 'Estado'];
        $cols = ['A','B','C','D','E','F','G','H'];

        foreach ($headers as $i => $header) {
            $cell = $cols[$i] . $headerRow;
            $sheet->setCellValue($cell, $header);
            $sheet->getStyle($cell)->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
            $sheet->getStyle($cell)->getFill()
                ->setFillType(Fill::FILL_SOLID)
                ->getStartColor()->setRGB('1E3A5F');
            $sheet->getStyle($cell)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        }

        // --- Filas de datos ---
        $row = $headerRow + 1;
        foreach ($payments as $idx => $pago) {
            $credit = $pago->credit;
            $lead   = $credit->lead ?? null;
            $nombre = $lead
                ? trim(($lead->primer_nombre ?? '') . ' ' . ($lead->primer_apellido ?? '') . ' ' . ($lead->segundo_apellido ?? ''))
                : ($pago->cedula ?? '-');

            $operacion = $credit ? ($credit->numero_operacion ?? $credit->reference ?? '-') : '-';

            $sheet->setCellValue('A' . $row, $idx + 1);
            $sheet->setCellValue('B' . $row, $operacion);
            $sheet->setCellValue('C' . $row, $nombre);
            $sheet->setCellValue('D' . $row, $pago->cedula ?? '-');
            $sheet->setCellValue('E' . $row, $pago->numero_cuota ?? '-');
            $sheet->setCellValue('F' . $row, number_format((float) $pago->monto, 2, '.', ','));
            $sheet->setCellValue('G' . $row, $pago->movimiento_total > 0 ? number_format((float) $pago->movimiento_total, 2, '.', ',') : '-');
            $sheet->setCellValue('H' . $row, $pago->estado_reverso === 'Anulado' ? 'Anulado' : ($pago->estado ?? '-'));

            // Alternar color de filas
            if ($idx % 2 === 1) {
                $sheet->getStyle('A' . $row . ':H' . $row)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F0F4FA');
            }

            $row++;
        }

        // --- Fila de total ---
        $sheet->setCellValue('E' . $row, 'TOTAL');
        $sheet->setCellValue('F' . $row, number_format((float) $payments->sum('monto'), 2, '.', ','));
        $sheet->getStyle('E' . $row . ':F' . $row)->getFont()->setBold(true);

        // --- Bordes tabla ---
        $tableRange = 'A' . $headerRow . ':H' . $row;
        $sheet->getStyle($tableRange)->getBorders()->getAllBorders()
            ->setBorderStyle(Border::BORDER_THIN);

        // --- Anchos de columna ---
        $widths = ['A' => 5, 'B' => 20, 'C' => 35, 'D' => 15, 'E' => 10, 'F' => 16, 'G' => 16, 'H' => 14];
        foreach ($widths as $col => $width) {
            $sheet->getColumnDimension($col)->setWidth($width);
        }

        $writer = new Xlsx($spreadsheet);

        $filename = 'resumen_planilla_' . ($planilla->id) . '_' . ($planilla->fecha_planilla ?? 'sin-fecha') . '.xlsx';

        $temp = tempnam(sys_get_temp_dir(), 'planilla_');
        $writer->save($temp);

        return response()->download($temp, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }
}
