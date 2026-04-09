<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Investment;
use App\Models\Investor;
use App\Services\InvestmentService;
use Barryvdh\DomPDF\Facade\Pdf;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Carbon\Carbon;

class InvestmentExportController extends Controller
{
    public function __construct(private InvestmentService $service) {}

    // --- TABLA GENERAL ---

    public function tablaGeneralPdf()
    {
        $data = $this->service->getTablaGeneral();
        $pdf = Pdf::loadView('pdf.tabla_general_inversiones', $data)
            ->setPaper('legal', 'landscape');
        return $pdf->stream('tabla_general_inversiones.pdf');
    }

    public function tablaGeneralExcel()
    {
        $data = $this->service->getTablaGeneral();
        $spreadsheet = new Spreadsheet();

        foreach (['dolares' => 'USD', 'colones' => 'CRC'] as $key => $currency) {
            $sheet = $key === 'dolares' ? $spreadsheet->getActiveSheet() : $spreadsheet->createSheet();
            $sheet->setTitle($currency);

            $headers = ['#', 'Inversionista', 'Monto Capital', 'Plazo', 'Fecha Inicio', 'Fecha Venc.', 'Tasa Anual', 'Interés Mensual', 'Retención', 'Interés Neto', 'Forma Pago'];
            foreach ($headers as $col => $header) {
                $sheet->setCellValue(chr(65 + $col) . '1', $header);
            }

            // Bold headers
            $sheet->getStyle('A1:K1')->getFont()->setBold(true);
            $sheet->getStyle('A1:K1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('E2E8F0');

            $row = 2;
            foreach ($data[$key]['inversiones'] as $inv) {
                $sheet->setCellValue("A{$row}", $inv->numero_desembolso);
                $sheet->setCellValue("B{$row}", $inv->investor->name ?? '');
                $sheet->setCellValue("C{$row}", (float) $inv->monto_capital);
                $sheet->setCellValue("D{$row}", $inv->plazo_meses . 'm');
                $sheet->setCellValue("E{$row}", $inv->fecha_inicio->format('d/m/Y'));
                $sheet->setCellValue("F{$row}", $inv->fecha_vencimiento->format('d/m/Y'));
                $sheet->setCellValue("G{$row}", ((float) $inv->tasa_anual * 100) . '%');
                $sheet->setCellValue("H{$row}", $inv->interes_mensual);
                $sheet->setCellValue("I{$row}", $inv->retencion_mensual);
                $sheet->setCellValue("J{$row}", $inv->interes_neto_mensual);
                $sheet->setCellValue("K{$row}", $inv->forma_pago);
                $row++;
            }

            // Totals
            $sheet->setCellValue("B{$row}", 'TOTALES');
            $sheet->setCellValue("C{$row}", $data[$key]['total_capital']);
            $sheet->setCellValue("H{$row}", $data[$key]['total_interes_mensual']);
            $sheet->setCellValue("I{$row}", $data[$key]['total_retencion']);
            $sheet->setCellValue("J{$row}", $data[$key]['total_neto']);
            $sheet->getStyle("A{$row}:K{$row}")->getFont()->setBold(true);

            // Format number columns
            $numberCols = ['C', 'H', 'I', 'J'];
            foreach ($numberCols as $col) {
                $sheet->getStyle("{$col}2:{$col}{$row}")->getNumberFormat()->setFormatCode('#,##0.00');
            }

            // Auto-size columns
            foreach (range('A', 'K') as $col) {
                $sheet->getColumnDimension($col)->setAutoSize(true);
            }
        }

        $writer = new Xlsx($spreadsheet);
        $filename = 'tabla_general_inversiones.xlsx';
        $temp = tempnam(sys_get_temp_dir(), 'inv');
        $writer->save($temp);

        return response()->download($temp, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    // --- DETALLE INVERSIÓN ---

    public function detalleInversionPdf(int $id)
    {
        $investment = Investment::with(['investor', 'coupons'])->findOrFail($id);
        $pdf = Pdf::loadView('pdf.detalle_inversion', compact('investment'));
        return $pdf->stream("detalle_inversion_{$investment->numero_desembolso}.pdf");
    }

    public function detalleInversionExcel(int $id)
    {
        $investment = Investment::with(['investor', 'coupons'])->findOrFail($id);
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Detalle');

        // Header info
        $sheet->setCellValue('A1', 'Inversión: ' . $investment->numero_desembolso);
        $sheet->setCellValue('A2', 'Inversionista: ' . ($investment->investor->name ?? ''));
        $sheet->setCellValue('A3', 'Monto: ' . number_format((float) $investment->monto_capital, 2));
        $sheet->setCellValue('C3', 'Moneda: ' . $investment->moneda);
        $sheet->setCellValue('A4', 'Tasa: ' . ((float) $investment->tasa_anual * 100) . '%');
        $sheet->setCellValue('C4', 'Forma Pago: ' . $investment->forma_pago);

        // Coupons table
        $retencionPct = number_format((float) $investment->tasa_retencion * 100, 0) . '%';
        $headers = ['#', 'Fecha Cupón', 'Interés Bruto', "Retención {$retencionPct}", 'Interés Neto', 'Estado', 'Fecha Pago'];
        $row = 6;
        foreach ($headers as $col => $h) {
            $sheet->setCellValue(chr(65 + $col) . $row, $h);
        }
        $sheet->getStyle("A{$row}:G{$row}")->getFont()->setBold(true);

        $i = 1;
        foreach ($investment->coupons->sortBy('fecha_cupon') as $coupon) {
            $row++;
            $sheet->setCellValue("A{$row}", $i++);
            $sheet->setCellValue("B{$row}", $coupon->fecha_cupon->format('d/m/Y'));
            $sheet->setCellValue("C{$row}", (float) $coupon->interes_bruto);
            $sheet->setCellValue("D{$row}", (float) $coupon->retencion);
            $sheet->setCellValue("E{$row}", (float) $coupon->interes_neto);
            $sheet->setCellValue("F{$row}", $coupon->estado);
            $sheet->setCellValue("G{$row}", $coupon->fecha_pago?->format('d/m/Y') ?? '');
        }

        foreach (range('A', 'G') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $writer = new Xlsx($spreadsheet);
        $temp = tempnam(sys_get_temp_dir(), 'inv');
        $writer->save($temp);

        return response()->download($temp, "detalle_{$investment->numero_desembolso}.xlsx", [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    // --- RESUMEN INVERSIONISTA ---

    public function inversionistaPdf(int $id)
    {
        $investor = Investor::findOrFail($id);
        $data = $this->service->getSummaryByInvestor($investor);
        $pdf = Pdf::loadView('pdf.resumen_inversionista', $data);
        return $pdf->stream("resumen_{$investor->name}.pdf");
    }

    public function inversionistaExcel(int $id)
    {
        $investor = Investor::findOrFail($id);
        $data = $this->service->getSummaryByInvestor($investor);

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Resumen');

        $sheet->setCellValue('A1', 'Resumen de Inversionista: ' . $investor->name);
        $sheet->setCellValue('A2', 'Total Capital CRC: ' . number_format($data['total_capital_crc'], 2));
        $sheet->setCellValue('A3', 'Total Capital USD: ' . number_format($data['total_capital_usd'], 2));

        $headers = ['#', 'Monto', 'Moneda', 'Tasa', 'Plazo', 'Forma Pago', 'Estado'];
        $row = 5;
        foreach ($headers as $col => $h) {
            $sheet->setCellValue(chr(65 + $col) . $row, $h);
        }
        $sheet->getStyle("A{$row}:G{$row}")->getFont()->setBold(true);

        foreach ($data['investments'] as $inv) {
            $row++;
            $sheet->setCellValue("A{$row}", $inv->numero_desembolso);
            $sheet->setCellValue("B{$row}", (float) $inv->monto_capital);
            $sheet->setCellValue("C{$row}", $inv->moneda);
            $sheet->setCellValue("D{$row}", ((float) $inv->tasa_anual * 100) . '%');
            $sheet->setCellValue("E{$row}", $inv->plazo_meses . 'm');
            $sheet->setCellValue("F{$row}", $inv->forma_pago);
            $sheet->setCellValue("G{$row}", $inv->estado);
        }

        foreach (range('A', 'G') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $writer = new Xlsx($spreadsheet);
        $temp = tempnam(sys_get_temp_dir(), 'inv');
        $writer->save($temp);

        return response()->download($temp, "resumen_{$investor->name}.xlsx", [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    // --- ESTADO DE CUENTA ---

    public function estadoCuentaPdf(Request $request, int $id)
    {
        $lang = $request->query('lang', 'es');
        $investment = Investment::with(['investor', 'payments' => function ($q) {
            $q->orderBy('fecha_pago', 'asc');
        }])->findOrFail($id);

        $payments = $investment->payments->filter(fn($p) => in_array($p->tipo, ['Interés', 'Capital', 'Adelanto', 'Liquidación']));

        // Reconstruir capital original: monto_capital actual + suma de pagos de capital realizados
        // Esto es necesario porque cancelacionTotal('sin_intereses') pone monto_capital = 0
        $capitalDevuelto = $payments
            ->filter(fn($p) => in_array($p->tipo, ['Capital', 'Liquidación']))
            ->sum(fn($p) => (float) $p->monto);
        $capitalInicial = (float) $investment->monto_capital + $capitalDevuelto;
        $tasaAnual = (float) $investment->tasa_anual;
        $balance = $capitalInicial;

        $rows = [];
        $fechaAnterior = Carbon::parse($investment->fecha_inicio);
        $interesPendienteAcum = 0; // Acumulado de intereses devengados no pagados

        // Group payments by date and sum them
        $paymentsByDate = $payments->groupBy(fn($p) => Carbon::parse($p->fecha_pago)->format('Y-m-d'));

        foreach ($paymentsByDate as $dateStr => $dayPayments) {
            $fechaPago = Carbon::parse($dateStr);
            $dias = $fechaAnterior->diffInDays($fechaPago);
            $interes = $balance * $tasaAnual * $dias / 365;
            $interes = round($interes, 2);

            $totalPago = $dayPayments->sum(fn($p) => (float) $p->monto);

            // Separate capital payments (Capital, Liquidación) from interest payments
            $explicitCapital = $dayPayments
                ->filter(fn($p) => in_array($p->tipo, ['Capital', 'Liquidación']))
                ->sum(fn($p) => (float) $p->monto);
            $explicitInterest = $dayPayments
                ->filter(fn($p) => in_array($p->tipo, ['Interés', 'Adelanto']))
                ->sum(fn($p) => (float) $p->monto);

            if ($explicitCapital > 0) {
                // When there are explicit capital payments, use actual payment types
                $interestPayment = $explicitInterest;
                $capitalPayment = $explicitCapital;
            } else {
                // Legacy behavior: interest is paid first, remainder goes to capital
                $interestPayment = min($interes, $totalPago);
                $capitalPayment = $totalPago - $interestPayment;
            }
            $balance = round($balance - $capitalPayment, 2);

            // Acumular intereses devengados y restar lo que se pagó
            $interesPendienteAcum = round($interesPendienteAcum + $interes - $interestPayment, 2);

            $rows[] = [
                'date' => $fechaPago->format($lang === 'en' ? 'F d,Y' : 'd/m/Y'),
                'days' => $dias,
                'interest' => $interes,
                'payment' => $totalPago,
                'interest_payment' => round($interestPayment, 2),
                'capital_payment' => round($capitalPayment, 2),
                'balance' => $balance,
                'pending_interest' => $interesPendienteAcum,
            ];

            $fechaAnterior = $fechaPago;
        }

        // Last row: from last payment to now (or vencimiento), showing pending interest
        $fechaCorte = Carbon::now();
        if ($investment->fecha_vencimiento && Carbon::parse($investment->fecha_vencimiento)->lt($fechaCorte)) {
            $fechaCorte = Carbon::parse($investment->fecha_vencimiento);
        }
        $diasPendientes = $fechaAnterior->diffInDays($fechaCorte);
        if ($diasPendientes > 0 && $balance > 0) {
            $interesPeriodo = $balance * $tasaAnual * $diasPendientes / 365;
            $interesPendienteAcum = round($interesPendienteAcum + $interesPeriodo, 2);
            $rows[] = [
                'date' => $fechaCorte->format($lang === 'en' ? 'F d,Y' : 'd/m/Y'),
                'days' => $diasPendientes,
                'interest' => round($interesPeriodo, 2),
                'payment' => 0,
                'interest_payment' => 0,
                'capital_payment' => 0,
                'balance' => round($balance, 2),
                'pending_interest' => $interesPendienteAcum,
            ];
        }

        $fechaDesde = Carbon::parse($investment->fecha_inicio)->format($lang === 'en' ? 'M d, Y' : 'd/m/Y');
        $fechaHasta = $fechaCorte->format($lang === 'en' ? 'M d, Y' : 'd/m/Y');
        $periodLabel = $fechaCorte->format($lang === 'en' ? 'F jS, Y' : 'd/m/Y');

        // Current monthly interest = based on current balance
        $currentMonthlyInterest = $balance * $tasaAnual / 12;

        $logoPath = public_path('logopepwebcolor.png');
        $logoBase64 = 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath));

        // Interés mensual inicial basado en capital original
        $initialMonthlyInterest = $capitalInicial * $tasaAnual / 12;

        $pdf = Pdf::loadView('pdf.estado_cuenta_inversion', compact(
            'investment', 'rows', 'lang', 'fechaDesde', 'fechaHasta',
            'periodLabel', 'currentMonthlyInterest', 'logoBase64',
            'capitalInicial', 'initialMonthlyInterest'
        ))->setPaper('letter', 'landscape');

        $filename = $lang === 'en' ? 'account_statement' : 'estado_cuenta';
        return $pdf->stream("{$filename}_{$investment->numero_desembolso}.pdf");
    }

    // --- RETENCIONES ---

    public function retencionesPdf()
    {
        $data = $this->service->getTablaGeneral();
        $bgPath = public_path('pdf_background_portrait.jpg');
        $bgBase64 = 'data:image/jpeg;base64,' . base64_encode(file_get_contents($bgPath));
        $pdf = Pdf::loadView('pdf.retenciones', array_merge($data, [
            'bgBase64' => $bgBase64,
        ]))->setPaper('letter', 'portrait');
        return $pdf->stream('reporte_retenciones.pdf');
    }

    public function retencionesExcel()
    {
        $investments = Investment::with('investor:id,name')->where('estado', 'Activa')->get();

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Retenciones');

        $headers = ['# Desembolso', 'Inversionista', 'Monto', 'Moneda', 'Tasa', 'Interés Mensual', 'Retención', 'Neto'];
        foreach ($headers as $col => $h) {
            $sheet->setCellValue(chr(65 + $col) . '1', $h);
        }
        $sheet->getStyle('A1:H1')->getFont()->setBold(true);

        $row = 2;
        foreach ($investments as $inv) {
            $sheet->setCellValue("A{$row}", $inv->numero_desembolso);
            $sheet->setCellValue("B{$row}", $inv->investor->name ?? '');
            $sheet->setCellValue("C{$row}", (float) $inv->monto_capital);
            $sheet->setCellValue("D{$row}", $inv->moneda);
            $sheet->setCellValue("E{$row}", ((float) $inv->tasa_anual * 100) . '%');
            $sheet->setCellValue("F{$row}", $inv->interes_mensual);
            $sheet->setCellValue("G{$row}", $inv->retencion_mensual);
            $sheet->setCellValue("H{$row}", $inv->interes_neto_mensual);
            $row++;
        }

        foreach (range('A', 'H') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $writer = new Xlsx($spreadsheet);
        $temp = tempnam(sys_get_temp_dir(), 'inv');
        $writer->save($temp);

        return response()->download($temp, 'reporte_retenciones.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    /**
     * Generar contrato de préstamo de dinero (ES o EN)
     */
    public function contratoInversionPdf(int $id, string $lang = 'es')
    {
        $investment = Investment::with('investor')->findOrFail($id);
        $investor   = $investment->investor;

        $ntw     = \App\Helpers\NumberToWords::class;
        $monto   = (float) $investment->monto_capital;
        $tasa    = (float) $investment->tasa_anual;  // ya en decimal: 0.06 = 6%
        $tasaPct = $tasa * 100;

        // ID en palabras (dígito por dígito)
        $idInversor = $investor->cedula ?? '';
        $idEnPalabrasES = $idInversor ? $ntw::idToWordsES($idInversor) : '';
        $idEnPalabrasEN = $idInversor ? $ntw::idToWordsEN($idInversor) : '';

        if ($lang === 'en') {
            $currency         = $investment->moneda === 'USD' ? 'dollars' : 'colones';
            $montoFormateado  = $investment->moneda === 'USD'
                ? '$' . number_format($monto, 2)
                : '₡' . number_format($monto, 2);
            $montoEnPalabras            = $ntw::convertEN($monto, $currency);
            $tasaFormateada             = number_format($tasaPct, 2);
            $tasaEnPalabras             = $ntw::belowThousandEN((int)$tasaPct) . ' percent';
            $formaPago                  = $ntw::formaPagoEN($investment->forma_pago);
            $plazoEnPalabras            = $ntw::plazoToWordsEN($investment->plazo_meses);
            $fechaInicioEnPalabras      = $ntw::dateToWordsEN(substr($investment->fecha_inicio, 0, 10));
            $fechaVencimientoEnPalabras = $ntw::dateToWordsEN(substr($investment->fecha_vencimiento, 0, 10));
            $fechaFirmaEnPalabras       = $ntw::dateToWordsEN(substr($investment->fecha_inicio, 0, 10));
            $idEnPalabras               = $idEnPalabrasEN;
            $view     = 'pdf.contrato_inversion_en';
            $filename = "loan_agreement_{$investment->numero_desembolso}.pdf";
        } else {
            $moneda           = $investment->moneda === 'USD' ? 'dólares' : 'colones';
            $montoFormateado  = $investment->moneda === 'USD'
                ? 'US$' . number_format($monto, 2)
                : '₡' . number_format($monto, 2);
            $montoEnPalabras            = $ntw::convert($monto, strtoupper($moneda));
            $tasaFormateada             = number_format($tasaPct, 2);
            $tasaEnPalabras             = $ntw::convert($tasaPct, 'POR CIENTO');
            $formaPago                  = $ntw::formaPagoES($investment->forma_pago);
            $plazoEnPalabras            = $ntw::plazoToWordsES($investment->plazo_meses);
            $fechaInicioEnPalabras      = $ntw::dateToWordsES(substr($investment->fecha_inicio, 0, 10));
            $fechaVencimientoEnPalabras = $ntw::dateToWordsES(substr($investment->fecha_vencimiento, 0, 10));
            $fechaFirmaEnPalabras       = $ntw::dateToWordsES(substr($investment->fecha_inicio, 0, 10));
            $idEnPalabras               = $idEnPalabrasES;
            $view     = 'pdf.contrato_inversion_es';
            $filename = "contrato_{$investment->numero_desembolso}.pdf";
        }

        $pdf = Pdf::loadView($view, compact(
            'investment', 'investor',
            'montoFormateado', 'montoEnPalabras',
            'tasaFormateada', 'tasaEnPalabras',
            'formaPago', 'plazoEnPalabras',
            'fechaInicioEnPalabras', 'fechaVencimientoEnPalabras', 'fechaFirmaEnPalabras',
            'idEnPalabras'
        ))->setPaper('letter', 'portrait');

        return $pdf->stream($filename);
    }
}
