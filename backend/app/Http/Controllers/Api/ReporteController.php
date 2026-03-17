<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Credit;
use App\Models\CreditPayment;
use App\Models\Deductora;
use App\Models\Investment;
use App\Models\InvestmentCoupon;
use App\Models\PlanDePago;
use App\Models\DeductoraChange;
use App\Models\PlanillaReport;
use App\Traits\LogsActivity;
use Barryvdh\DomPDF\Facade\Pdf;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ReporteController extends Controller
{
    use LogsActivity;
    // ─────────────────────────────────────────────────────────────
    //  1. CARTERA ACTIVA
    // ─────────────────────────────────────────────────────────────

    public function cartera(Request $request)
    {
        $deductoraId = $request->input('deductora_id');
        $estado      = $request->input('estado');

        // Por defecto: todos los créditos con cartera activa (excluir solo Cerrado)
        $allActiveStatuses = ['Activo', 'En Mora', 'Formalizado', 'Legal', 'En Progreso', 'Aprobado', 'Por firmar'];
        if ($estado && $estado !== 'all') {
            $statuses = [$estado];
        } else {
            $statuses = $allActiveStatuses;
        }

        $credits = Credit::with(['lead:id,name,cedula', 'deductora:id,nombre'])
            ->whereIn('status', $statuses)
            ->when($deductoraId, fn($q) => $q->where('deductora_id', $deductoraId))
            ->get(['id', 'reference', 'status', 'monto_credito', 'saldo', 'cuota',
                   'cuotas_atrasadas', 'lead_id', 'deductora_id', 'plazo', 'opened_at']);

        // Próxima cuota pendiente por crédito
        $creditIds = $credits->pluck('id');
        $proximasCuotas = PlanDePago::whereIn('credit_id', $creditIds)
            ->where('estado', 'Pendiente')
            ->where('numero_cuota', '>', 0)
            ->select('credit_id', DB::raw('MIN(fecha_corte) as proxima_fecha'))
            ->groupBy('credit_id')
            ->pluck('proxima_fecha', 'credit_id');

        $rows = $credits->map(function ($c) use ($proximasCuotas) {
            return [
                'id'              => $c->id,
                'referencia'      => $c->reference,
                'cliente'         => $c->lead?->name ?? '—',
                'cedula'          => $c->lead?->cedula ?? '—',
                'deductora'       => $c->deductora?->nombre ?? 'Sin deductora',
                'deductora_id'    => $c->deductora_id,
                'monto_credito'   => (float) $c->monto_credito,
                'saldo'           => (float) $c->saldo,
                'cuota'           => (float) $c->cuota,
                'cuotas_atrasadas'=> (int) $c->cuotas_atrasadas,
                'plazo'           => $c->plazo,
                'proxima_fecha'   => $proximasCuotas[$c->id] ?? null,
                'status'          => $c->status,
                'opened_at'       => $c->opened_at?->toDateString(),
            ];
        })->values();

        // Totales por estado para gráfico
        $porEstado = $credits->groupBy('status')->map(fn($g) => [
            'count'  => $g->count(),
            'saldo'  => round($g->sum('saldo'), 2),
            'monto'  => round($g->sum('monto_credito'), 2),
        ]);

        return response()->json([
            'data'      => $rows,
            'totales'   => [
                'creditos'    => $credits->count(),
                'saldo_total' => round($credits->sum('saldo'), 2),
                'monto_total' => round($credits->sum('monto_credito'), 2),
                'cuota_total' => round($credits->sum('cuota'), 2),
            ],
            'por_estado' => $porEstado,
        ]);
    }

    public function carteraExcel(Request $request)
    {
        $this->logActivity('export', 'Reportes', null, 'Cartera Activa - Excel', [], $request);
        $data = $this->cartera($request)->getData(true);
        $rows = $data['data'];
        $totales = $data['totales'];

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Cartera Activa');

        $headers = ['Referencia', 'Cliente', 'Cédula', 'Deductora', 'Monto Crédito', 'Saldo', 'Cuota', 'Cuotas Atrasadas', 'Próxima Fecha', 'Estado'];
        foreach ($headers as $col => $header) {
            $sheet->setCellValue(chr(65 + $col) . '1', $header);
        }
        $sheet->getStyle('A1:J1')->getFont()->setBold(true);
        $sheet->getStyle('A1:J1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('DBEAFE');

        $row = 2;
        foreach ($rows as $r) {
            $sheet->setCellValue("A{$row}", $r['referencia']);
            $sheet->setCellValue("B{$row}", $r['cliente']);
            $sheet->setCellValue("C{$row}", $r['cedula']);
            $sheet->setCellValue("D{$row}", $r['deductora']);
            $sheet->setCellValue("E{$row}", $r['monto_credito']);
            $sheet->setCellValue("F{$row}", $r['saldo']);
            $sheet->setCellValue("G{$row}", $r['cuota']);
            $sheet->setCellValue("H{$row}", $r['cuotas_atrasadas']);
            $sheet->setCellValue("I{$row}", $r['proxima_fecha'] ?? '');
            $sheet->setCellValue("J{$row}", $r['status']);
            $row++;
        }

        // Totales
        $sheet->setCellValue("A{$row}", 'TOTALES');
        $sheet->setCellValue("E{$row}", $totales['monto_total']);
        $sheet->setCellValue("F{$row}", $totales['saldo_total']);
        $sheet->setCellValue("G{$row}", $totales['cuota_total']);
        $sheet->getStyle("A{$row}:J{$row}")->getFont()->setBold(true);

        foreach (['E', 'F', 'G'] as $col) {
            $sheet->getStyle("{$col}2:{$col}{$row}")->getNumberFormat()->setFormatCode('#,##0.00');
        }
        foreach (range('A', 'J') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        return $this->downloadExcel($spreadsheet, 'cartera_activa.xlsx');
    }

    public function carteraPdf(Request $request)
    {
        $this->logActivity('export', 'Reportes', null, 'Cartera Activa - PDF', [], $request);
        $data = $this->cartera($request)->getData(true);
        $bgPath = public_path('pdf_background.jpg');
        $bgBase64 = 'data:image/jpeg;base64,' . base64_encode(file_get_contents($bgPath));
        $pdf = Pdf::loadHTML($this->buildCarteraPdfHtml($data['data'], $data['totales'], $bgBase64))
            ->setPaper('letter', 'landscape');
        return $pdf->stream('cartera_activa.pdf');
    }

    // ─────────────────────────────────────────────────────────────
    //  2. CARTERA EN MORA
    // ─────────────────────────────────────────────────────────────

    public function carteraMora(Request $request)
    {
        $deductoraId = $request->input('deductora_id');

        $credits = Credit::with(['lead:id,name,cedula', 'deductora:id,nombre'])
            ->whereNotIn('status', ['Cerrado'])
            ->where('cuotas_atrasadas', '>', 0)
            ->when($deductoraId, fn($q) => $q->where('deductora_id', $deductoraId))
            ->get(['id', 'reference', 'status', 'monto_credito', 'saldo', 'cuota',
                   'cuotas_atrasadas', 'lead_id', 'deductora_id', 'plazo']);

        // Días mora: cuotas_atrasadas × 30 aproximado; mejor usar PlanDePago
        $creditIds = $credits->pluck('id');
        $diasMoraMap = PlanDePago::whereIn('credit_id', $creditIds)
            ->where('estado', 'Pendiente')
            ->where('numero_cuota', '>', 0)
            ->where('dias_mora', '>', 0)
            ->select('credit_id', DB::raw('MAX(dias_mora) as max_dias'))
            ->groupBy('credit_id')
            ->pluck('max_dias', 'credit_id');

        $rows = $credits->map(function ($c) use ($diasMoraMap) {
            $dias = $diasMoraMap[$c->id] ?? ($c->cuotas_atrasadas * 30);
            $rango = match (true) {
                $dias <= 30  => '1-30 días',
                $dias <= 60  => '31-60 días',
                $dias <= 90  => '61-90 días',
                default      => 'Más de 90 días',
            };
            return [
                'id'              => $c->id,
                'referencia'      => $c->reference,
                'cliente'         => $c->lead?->name ?? '—',
                'cedula'          => $c->lead?->cedula ?? '—',
                'deductora'       => $c->deductora?->nombre ?? 'Sin deductora',
                'monto_credito'   => (float) $c->monto_credito,
                'saldo'           => (float) $c->saldo,
                'cuota'           => (float) $c->cuota,
                'cuotas_atrasadas'=> (int) $c->cuotas_atrasadas,
                'dias_mora'       => $dias,
                'rango_mora'      => $rango,
                'status'          => $c->status,
            ];
        })->values();

        // Agrupamiento por rango para gráfico
        $porRango = $rows->groupBy('rango_mora')->map(fn($g) => [
            'count' => $g->count(),
            'saldo' => round($g->sum('saldo'), 2),
        ]);

        $orden = ['1-30 días', '31-60 días', '61-90 días', 'Más de 90 días'];
        $porRangoOrdenado = collect($orden)->mapWithKeys(fn($r) => [
            $r => $porRango[$r] ?? ['count' => 0, 'saldo' => 0]
        ]);

        return response()->json([
            'data'      => $rows,
            'totales'   => [
                'creditos'    => $credits->count(),
                'saldo_mora'  => round($credits->sum('saldo'), 2),
                'cuota_mora'  => round($credits->sum('cuota'), 2),
            ],
            'por_rango' => $porRangoOrdenado,
        ]);
    }

    public function carteraMoraExcel(Request $request)
    {
        $this->logActivity('export', 'Reportes', null, 'Cartera en Mora - Excel', [], $request);
        $data = $this->carteraMora($request)->getData(true);
        $rows = $data['data'];

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Cartera en Mora');

        $headers = ['Referencia', 'Cliente', 'Cédula', 'Deductora', 'Saldo', 'Cuota', 'Cuotas Atrasadas', 'Días Mora', 'Rango', 'Estado'];
        foreach ($headers as $col => $header) {
            $sheet->setCellValue(chr(65 + $col) . '1', $header);
        }
        $sheet->getStyle('A1:J1')->getFont()->setBold(true);
        $sheet->getStyle('A1:J1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('FEE2E2');

        $row = 2;
        foreach ($rows as $r) {
            $sheet->setCellValue("A{$row}", $r['referencia']);
            $sheet->setCellValue("B{$row}", $r['cliente']);
            $sheet->setCellValue("C{$row}", $r['cedula']);
            $sheet->setCellValue("D{$row}", $r['deductora']);
            $sheet->setCellValue("E{$row}", $r['saldo']);
            $sheet->setCellValue("F{$row}", $r['cuota']);
            $sheet->setCellValue("G{$row}", $r['cuotas_atrasadas']);
            $sheet->setCellValue("H{$row}", $r['dias_mora']);
            $sheet->setCellValue("I{$row}", $r['rango_mora']);
            $sheet->setCellValue("J{$row}", $r['status']);
            $row++;
        }

        foreach (['E', 'F'] as $col) {
            $sheet->getStyle("{$col}2:{$col}{$row}")->getNumberFormat()->setFormatCode('#,##0.00');
        }
        foreach (range('A', 'J') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        return $this->downloadExcel($spreadsheet, 'cartera_mora.xlsx');
    }

    public function carteraMoraPdf(Request $request)
    {
        $this->logActivity('export', 'Reportes', null, 'Cartera en Mora - PDF', [], $request);
        $data = $this->carteraMora($request)->getData(true);
        $bgPath = public_path('pdf_background.jpg');
        $bgBase64 = file_exists($bgPath) ? 'data:image/jpeg;base64,' . base64_encode(file_get_contents($bgPath)) : '';
        $pdf = Pdf::loadHTML($this->buildMoraPdfHtml($data['data'], $data['totales'], $bgBase64))
            ->setPaper('letter', 'landscape');
        return $pdf->stream('cartera_mora.pdf');
    }

    // ─────────────────────────────────────────────────────────────
    //  3. CARTERA POR DEDUCTORA
    // ─────────────────────────────────────────────────────────────

    public function carteraDeductora(Request $request)
    {
        $estadoParam = $request->input('estado');
        if ($estadoParam && $estadoParam !== 'all') {
            $statuses = is_array($estadoParam) ? $estadoParam : [$estadoParam];
        } else {
            $statuses = ['Activo', 'En Mora', 'Formalizado', 'Legal', 'En Progreso', 'Aprobado', 'Por firmar'];
        }

        $deductoras = Deductora::withCount(['credits as total_creditos' => function ($q) use ($statuses) {
            $q->whereIn('status', $statuses);
        }])->get(['id', 'nombre']);

        $totalesPorDeductora = Credit::whereIn('status', $statuses)
            ->select(
                'deductora_id',
                DB::raw('COUNT(*) as total_creditos'),
                DB::raw('SUM(monto_credito) as monto_total'),
                DB::raw('SUM(saldo) as saldo_total'),
                DB::raw('SUM(cuota) as cuota_total')
            )
            ->groupBy('deductora_id')
            ->get()
            ->keyBy('deductora_id');

        $totalSaldoGeneral = $totalesPorDeductora->sum('saldo_total');

        $rows = $deductoras->map(function ($d) use ($totalesPorDeductora, $totalSaldoGeneral) {
            $t = $totalesPorDeductora[$d->id] ?? null;
            $saldo = $t ? (float) $t->saldo_total : 0;
            return [
                'deductora_id'  => $d->id,
                'deductora'     => $d->nombre,
                'total_creditos'=> $t ? (int) $t->total_creditos : 0,
                'monto_total'   => $t ? round((float) $t->monto_total, 2) : 0,
                'saldo_total'   => round($saldo, 2),
                'cuota_total'   => $t ? round((float) $t->cuota_total, 2) : 0,
                'porcentaje'    => $totalSaldoGeneral > 0 ? round($saldo / $totalSaldoGeneral * 100, 1) : 0,
            ];
        })->filter(fn($r) => $r['total_creditos'] > 0)->values();

        // Sin deductora
        $sinDeductora = Credit::whereIn('status', $statuses)
            ->whereNull('deductora_id')
            ->select(
                DB::raw('COUNT(*) as total_creditos'),
                DB::raw('SUM(monto_credito) as monto_total'),
                DB::raw('SUM(saldo) as saldo_total'),
                DB::raw('SUM(cuota) as cuota_total')
            )->first();

        if ($sinDeductora && $sinDeductora->total_creditos > 0) {
            $saldo = (float) $sinDeductora->saldo_total;
            $rows->push([
                'deductora_id'  => null,
                'deductora'     => 'Sin deductora',
                'total_creditos'=> (int) $sinDeductora->total_creditos,
                'monto_total'   => round((float) $sinDeductora->monto_total, 2),
                'saldo_total'   => round($saldo, 2),
                'cuota_total'   => round((float) $sinDeductora->cuota_total, 2),
                'porcentaje'    => $totalSaldoGeneral > 0 ? round($saldo / $totalSaldoGeneral * 100, 1) : 0,
            ]);
        }

        return response()->json([
            'data'    => $rows,
            'totales' => [
                'creditos'    => $rows->sum('total_creditos'),
                'monto_total' => round($rows->sum('monto_total'), 2),
                'saldo_total' => round($totalSaldoGeneral, 2),
                'cuota_total' => round($rows->sum('cuota_total'), 2),
            ],
        ]);
    }

    public function carteraDeductoraExcel(Request $request)
    {
        $this->logActivity('export', 'Reportes', null, 'Por Deductora - Excel', [], $request);
        $data = $this->carteraDeductora($request)->getData(true);
        $rows = $data['data'];

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Por Deductora');

        $headers = ['Deductora', '# Créditos', 'Monto Desembolsado', 'Saldo Total', 'Cuota Total', '% Portfolio'];
        foreach ($headers as $col => $header) {
            $sheet->setCellValue(chr(65 + $col) . '1', $header);
        }
        $sheet->getStyle('A1:F1')->getFont()->setBold(true);
        $sheet->getStyle('A1:F1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('D1FAE5');

        $row = 2;
        foreach ($rows as $r) {
            $sheet->setCellValue("A{$row}", $r['deductora']);
            $sheet->setCellValue("B{$row}", $r['total_creditos']);
            $sheet->setCellValue("C{$row}", $r['monto_total']);
            $sheet->setCellValue("D{$row}", $r['saldo_total']);
            $sheet->setCellValue("E{$row}", $r['cuota_total']);
            $sheet->setCellValue("F{$row}", $r['porcentaje'] . '%');
            $row++;
        }

        foreach (['C', 'D', 'E'] as $col) {
            $sheet->getStyle("{$col}2:{$col}{$row}")->getNumberFormat()->setFormatCode('#,##0.00');
        }
        foreach (range('A', 'F') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        return $this->downloadExcel($spreadsheet, 'cartera_por_deductora.xlsx');
    }

    // ─────────────────────────────────────────────────────────────
    //  4. NOVEDADES DE PLANILLA
    // ─────────────────────────────────────────────────────────────

    public function novedadesPlanilla(Request $request)
    {
        $deductoraId = $request->input('deductora_id');
        $desde       = $request->input('desde', Carbon::now()->startOfMonth()->toDateString());
        $hasta       = $request->input('hasta', Carbon::now()->toDateString());

        if (!$deductoraId) {
            return response()->json(['error' => 'El campo deductora_id es requerido.'], 422);
        }

        // ── Obtener cambios registrados en deductora_changes ──
        $cambios = DeductoraChange::where(function ($q) use ($deductoraId) {
                $q->where('deductora_anterior_id', $deductoraId)
                  ->orWhere('deductora_nueva_id', $deductoraId);
            })
            ->whereBetween('fecha_movimiento', [$desde, $hasta])
            ->orderBy('fecha_movimiento', 'desc')
            ->get();

        $inclusiones    = collect();
        $exclusiones    = collect();
        $traslados      = collect();
        $refundiciones  = collect();

        foreach ($cambios as $c) {
            $row = [
                'id'                 => $c->credit_id,
                'referencia'         => $c->reference,
                'cliente'            => $c->cliente ?? '—',
                'cedula'             => $c->cedula ?? '—',
                'cuota'              => (float) $c->cuota,
                'saldo'              => (float) $c->saldo,
                'tasa_anual'         => (float) $c->tasa_anual,
                'plazo'              => (int) $c->plazo,
                'fecha_formalizacion'=> $c->fecha_formalizacion?->toDateString() ?? '—',
                'motivo'             => $c->motivo,
                'fecha'              => $c->fecha_movimiento->toDateString(),
                'tipo_movimiento'    => $c->tipo_movimiento,
                'deductora_anterior' => $c->deductora_anterior_nombre,
                'deductora_nueva'    => $c->deductora_nueva_nombre,
            ];

            match ($c->tipo_movimiento) {
                'inclusion'   => $inclusiones->push($row),
                'exclusion'   => $exclusiones->push($row),
                'traslado'    => $traslados->push($row),
                'refundicion' => $refundiciones->push($row),
                default       => null,
            };
        }

        // ── Fallback: también incluir créditos formalizados/cerrados que no estén en deductora_changes ──
        $cambiosCreditIds = $cambios->pluck('credit_id')->unique()->toArray();

        // Inclusiones por formalización directa (no registrada aún en deductora_changes)
        $inclusionesFallback = Credit::with(['lead:id,name,cedula'])
            ->where('deductora_id', $deductoraId)
            ->whereIn('status', ['Activo', 'Formalizado', 'En Mora'])
            ->where(function ($q) use ($desde, $hasta) {
                $q->whereBetween('opened_at', [$desde, $hasta])
                  ->orWhereBetween('formalized_at', [$desde, $hasta]);
            })
            ->whereNotIn('id', $cambiosCreditIds)
            ->get(['id', 'reference', 'lead_id', 'cuota', 'saldo', 'tasa_anual', 'plazo',
                   'opened_at', 'formalized_at', 'status'])
            ->map(fn($c) => [
                'id'                 => $c->id,
                'referencia'         => $c->reference,
                'cliente'            => $c->lead?->name ?? '—',
                'cedula'             => $c->lead?->cedula ?? '—',
                'cuota'              => (float) $c->cuota,
                'saldo'              => (float) $c->saldo,
                'tasa_anual'         => (float) ($c->tasa_anual ?? 0),
                'plazo'              => (int) ($c->plazo ?? 0),
                'fecha_formalizacion'=> $c->formalized_at?->toDateString() ?? '—',
                'motivo'             => 'Crédito nuevo formalizado',
                'fecha'              => $c->formalized_at?->toDateString() ?? $c->opened_at?->toDateString(),
                'tipo_movimiento'    => 'inclusion',
                'deductora_anterior' => null,
                'deductora_nueva'    => null,
            ]);
        $inclusiones = $inclusiones->merge($inclusionesFallback)->values();

        // Exclusiones por cierre directo (no registradas en deductora_changes)
        $exclusionesFallback = Credit::with(['lead:id,name,cedula'])
            ->where('deductora_id', $deductoraId)
            ->whereIn('status', ['Cerrado', 'Legal'])
            ->whereBetween('updated_at', [$desde . ' 00:00:00', $hasta . ' 23:59:59'])
            ->whereNotIn('id', $cambiosCreditIds)
            ->get(['id', 'reference', 'lead_id', 'cuota', 'saldo', 'tasa_anual', 'plazo',
                   'cierre_motivo', 'updated_at', 'formalized_at', 'status'])
            ->map(fn($c) => [
                'id'                 => $c->id,
                'referencia'         => $c->reference,
                'cliente'            => $c->lead?->name ?? '—',
                'cedula'             => $c->lead?->cedula ?? '—',
                'cuota'              => (float) $c->cuota,
                'saldo'              => (float) $c->saldo,
                'tasa_anual'         => (float) ($c->tasa_anual ?? 0),
                'plazo'              => (int) ($c->plazo ?? 0),
                'fecha_formalizacion'=> $c->formalized_at?->toDateString() ?? '—',
                'motivo'             => $c->cierre_motivo ?? $c->status,
                'fecha'              => $c->updated_at->toDateString(),
                'tipo_movimiento'    => 'exclusion',
                'deductora_anterior' => null,
                'deductora_nueva'    => null,
            ]);
        $exclusiones = $exclusiones->merge($exclusionesFallback)->values();

        // ── Modificaciones de cuota (mantener lógica existente) ──
        $abonosEnPeriodo = CreditPayment::where('source', 'Extraordinario')
            ->whereBetween('fecha_pago', [$desde, $hasta])
            ->whereNotNull('reversal_snapshot')
            ->where('estado_reverso', 'Vigente')
            ->whereHas('credit', fn($q) => $q->where('deductora_id', $deductoraId)
                ->whereNotIn('status', ['Cerrado', 'Legal', 'Aprobado', 'Por firmar']))
            ->with(['credit:id,reference,lead_id,cuota,status', 'credit.lead:id,name,cedula'])
            ->get();

        $modificaciones = collect();
        if ($abonosEnPeriodo->isNotEmpty()) {
            $byCredit = $abonosEnPeriodo->sortBy('fecha_pago')->groupBy('credit_id');

            $modificaciones = $byCredit->map(function ($pagos) {
                $primerAbono = $pagos->first();
                $snapshot    = is_string($primerAbono->reversal_snapshot)
                    ? json_decode($primerAbono->reversal_snapshot, true)
                    : (array) $primerAbono->reversal_snapshot;

                $cuotaAnterior = isset($snapshot['original_cuota']) ? (float) $snapshot['original_cuota'] : null;
                $credit        = $primerAbono->credit;
                $cuotaNueva    = (float) $credit->cuota;

                if ($cuotaAnterior === null || $cuotaAnterior == $cuotaNueva) {
                    return null;
                }

                return [
                    'tipo'           => 'modificacion',
                    'id'             => $credit->id,
                    'referencia'     => $credit->reference,
                    'cliente'        => $credit->lead?->name ?? '—',
                    'cedula'         => $credit->lead?->cedula ?? '—',
                    'cuota_anterior' => $cuotaAnterior,
                    'cuota_nueva'    => $cuotaNueva,
                    'diferencia'     => round($cuotaNueva - $cuotaAnterior, 2),
                    'fecha'          => $primerAbono->fecha_pago,
                    'detalle'        => 'Modificar cuota: ₡' . number_format($cuotaAnterior, 2) . ' → ₡' . number_format($cuotaNueva, 2),
                ];
            })->filter()->values();
        }

        return response()->json([
            'inclusiones'   => $inclusiones,
            'exclusiones'   => $exclusiones,
            'traslados'     => $traslados->values(),
            'refundiciones' => $refundiciones->values(),
            'modificaciones'=> $modificaciones,
            'resumen'       => [
                'inclusiones'    => $inclusiones->count(),
                'exclusiones'    => $exclusiones->count(),
                'traslados'      => $traslados->count(),
                'refundiciones'  => $refundiciones->count(),
                'modificaciones' => $modificaciones->count(),
                'total'          => $inclusiones->count() + $exclusiones->count() + $traslados->count() + $refundiciones->count() + $modificaciones->count(),
            ],
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    //  5. HISTORIAL DE COBROS
    // ─────────────────────────────────────────────────────────────

    public function cobros(Request $request)
    {
        $desde       = $request->input('desde', Carbon::now()->startOfMonth()->toDateString());
        $hasta       = $request->input('hasta', Carbon::now()->toDateString());
        $source      = $request->input('source');
        $deductoraId = $request->input('deductora_id');

        $payments = CreditPayment::with(['credit:id,reference,lead_id,deductora_id', 'credit.lead:id,name,cedula', 'credit.deductora:id,nombre'])
            ->where(fn($q) => $q->whereNull('estado_reverso')->orWhere('estado_reverso', 'Vigente'))
            ->whereBetween('fecha_pago', [$desde, $hasta])
            ->when($source, fn($q) => $q->where('source', $source))
            ->when($deductoraId, fn($q) => $q->whereHas('credit', fn($cq) => $cq->where('deductora_id', $deductoraId)))
            ->orderBy('fecha_pago', 'asc')
            ->get();

        $rows = $payments->map(fn($p) => [
            'id'              => $p->id,
            'fecha_pago'      => $p->fecha_pago instanceof \Carbon\Carbon ? $p->fecha_pago->toDateString() : $p->fecha_pago,
            'referencia'      => $p->credit?->reference ?? '—',
            'cliente'         => $p->credit?->lead?->name ?? '—',
            'cedula'          => $p->credit?->lead?->cedula ?? '—',
            'deductora'       => $p->credit?->deductora?->nombre ?? 'Sin deductora',
            'numero_cuota'    => $p->numero_cuota,
            'monto'           => (float) $p->monto,
            'amortizacion'    => (float) $p->amortizacion,
            'interes_corriente'=> (float) $p->interes_corriente,
            'interes_moratorio'=> (float) ($p->interes_moratorio ?? 0),
            'source'          => $p->source ?? '—',
        ])->values();

        // Cobros agrupados por fecha para gráfico
        $porFecha = $payments->groupBy(fn($p) =>
            $p->fecha_pago instanceof \Carbon\Carbon ? $p->fecha_pago->toDateString() : (string) $p->fecha_pago
        )->map(fn($g) => round($g->sum('monto'), 2));

        // Distribución por fuente
        $porFuente = $payments->groupBy('source')->map(fn($g) => [
            'count' => $g->count(),
            'total' => round($g->sum('monto'), 2),
        ]);

        return response()->json([
            'data'      => $rows,
            'totales'   => [
                'pagos'           => $payments->count(),
                'monto_total'     => round($payments->sum('monto'), 2),
                'amortizacion'    => round($payments->sum('amortizacion'), 2),
                'interes_total'   => round($payments->sum('interes_corriente'), 2),
                'interes_mora'    => round($payments->sum('interes_moratorio'), 2),
            ],
            'por_fecha' => $porFecha,
            'por_fuente'=> $porFuente,
        ]);
    }

    public function cobrosExcel(Request $request)
    {
        $this->logActivity('export', 'Reportes', null, 'Cobros - Excel', [], $request);
        $data = $this->cobros($request)->getData(true);
        $rows = $data['data'];
        $totales = $data['totales'];

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Cobros');

        $headers = ['Fecha', 'Referencia', 'Cliente', 'Cédula', 'Deductora', 'Cuota #', 'Monto Pagado', 'Amortización', 'Interés', 'Mora', 'Fuente'];
        foreach ($headers as $col => $header) {
            $sheet->setCellValue(chr(65 + $col) . '1', $header);
        }
        $sheet->getStyle('A1:K1')->getFont()->setBold(true);
        $sheet->getStyle('A1:K1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('E0E7FF');

        $row = 2;
        foreach ($rows as $r) {
            $sheet->setCellValue("A{$row}", $r['fecha_pago']);
            $sheet->setCellValue("B{$row}", $r['referencia']);
            $sheet->setCellValue("C{$row}", $r['cliente']);
            $sheet->setCellValue("D{$row}", $r['cedula']);
            $sheet->setCellValue("E{$row}", $r['deductora']);
            $sheet->setCellValue("F{$row}", $r['numero_cuota']);
            $sheet->setCellValue("G{$row}", $r['monto']);
            $sheet->setCellValue("H{$row}", $r['amortizacion']);
            $sheet->setCellValue("I{$row}", $r['interes_corriente']);
            $sheet->setCellValue("J{$row}", $r['interes_moratorio']);
            $sheet->setCellValue("K{$row}", $r['source']);
            $row++;
        }

        $sheet->setCellValue("B{$row}", 'TOTALES');
        $sheet->setCellValue("G{$row}", $totales['monto_total']);
        $sheet->setCellValue("H{$row}", $totales['amortizacion']);
        $sheet->setCellValue("I{$row}", $totales['interes_total']);
        $sheet->setCellValue("J{$row}", $totales['interes_mora']);
        $sheet->getStyle("A{$row}:K{$row}")->getFont()->setBold(true);

        foreach (['G', 'H', 'I', 'J'] as $col) {
            $sheet->getStyle("{$col}2:{$col}{$row}")->getNumberFormat()->setFormatCode('#,##0.00');
        }
        foreach (range('A', 'K') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        return $this->downloadExcel($spreadsheet, 'historial_cobros.xlsx');
    }

    public function cobrosPdf(Request $request)
    {
        $this->logActivity('export', 'Reportes', null, 'Cobros - PDF', [], $request);
        $data = $this->cobros($request)->getData(true);
        $bgPath = public_path('pdf_background.jpg');
        $bgBase64 = file_exists($bgPath) ? 'data:image/jpeg;base64,' . base64_encode(file_get_contents($bgPath)) : '';
        $pdf = Pdf::loadHTML($this->buildCobrosPdfHtml($data['data'], $data['totales'], $bgBase64))
            ->setPaper('letter', 'landscape');
        return $pdf->stream('historial_cobros.pdf');
    }

    // ─────────────────────────────────────────────────────────────
    //  6. PLANILLA DE COBRO POR DEDUCTORA
    // ─────────────────────────────────────────────────────────────

    /**
     * Detalle de créditos activos de una deductora específica.
     * Es el informe "en vivo" que siempre refleja las cuotas actuales.
     */
    public function planillaCobro(int $deductoraId)
    {
        $deductora = Deductora::findOrFail($deductoraId);

        $activeStatuses = ['Activo', 'En Mora', 'Formalizado', 'En Progreso', 'Aprobado', 'Por firmar'];

        $credits = Credit::with(['lead:id,name,cedula'])
            ->where('deductora_id', $deductoraId)
            ->whereIn('status', $activeStatuses)
            ->orderBy('id')
            ->get(['id', 'reference', 'lead_id', 'monto_credito', 'saldo', 'cuota',
                   'cuotas_atrasadas', 'status', 'opened_at', 'formalized_at',
                   'tasa_anual', 'plazo']);

        $rows = $credits->map(fn($c) => [
            'id'              => $c->id,
            'referencia'      => $c->reference,
            'cliente'         => $c->lead?->name ?? '—',
            'cedula'          => $c->lead?->cedula ?? '—',
            'monto_credito'   => (float) $c->monto_credito,
            'saldo'           => (float) $c->saldo,
            'cuota'           => (float) $c->cuota,
            'cuotas_atrasadas'=> (int) $c->cuotas_atrasadas,
            'status'          => $c->status,
            'formalized_at'   => $c->formalized_at?->toDateString() ?? '—',
            'tasa_anual'      => (float) ($c->tasa_anual ?? 0),
            'plazo'           => (int) ($c->plazo ?? 0),
        ])->values();

        return response()->json([
            'deductora'   => $deductora->nombre,
            'deductora_id'=> $deductora->id,
            'fecha'       => Carbon::now()->toDateString(),
            'data'        => $rows,
            'totales'     => [
                'creditos'    => $credits->count(),
                'cuota_total' => round($credits->sum('cuota'), 2),
                'saldo_total' => round($credits->sum('saldo'), 2),
            ],
        ]);
    }

    public function planillaCobroPdf(int $deductoraId)
    {
        $periodo = Carbon::now()->format('Y-m');

        // Verificar si ya se generó este mes (informativo, permite regenerar)
        $reporteExistente = PlanillaReport::where('deductora_id', $deductoraId)
            ->where('periodo', $periodo)
            ->where('tipo', 'planilla_cobro')
            ->first();

        $this->logActivity('export', 'Reportes', null, 'Planilla Cobro - PDF (deductora: ' . $deductoraId . ', periodo: ' . $periodo . ')', [], request());
        $data = $this->planillaCobro($deductoraId)->getData(true);
        $data['periodo'] = $periodo;
        $data['generado_previamente'] = $reporteExistente ? $reporteExistente->created_at->toDateTimeString() : null;

        $nombreArchivo = 'planilla_cobro_' . $deductoraId . '_' . $periodo . '.pdf';
        $bgPath = public_path('pdf_background.jpg');
        $bgBase64 = file_exists($bgPath) ? 'data:image/jpeg;base64,' . base64_encode(file_get_contents($bgPath)) : '';
        $pdf = Pdf::loadHTML($this->buildPlanillaCobroPdfHtml($data, $bgBase64))
            ->setPaper('letter', 'landscape');

        // Guardar PDF en storage
        $rutaArchivo = 'planillas/' . $periodo . '/' . $nombreArchivo;
        \Illuminate\Support\Facades\Storage::put($rutaArchivo, $pdf->output());

        // Registrar o actualizar el reporte mensual
        PlanillaReport::updateOrCreate(
            ['deductora_id' => $deductoraId, 'periodo' => $periodo, 'tipo' => 'planilla_cobro'],
            ['nombre_archivo' => $nombreArchivo, 'ruta_archivo' => $rutaArchivo, 'user_id' => request()->user()?->id]
        );

        return $pdf->stream($nombreArchivo);
    }

    public function novedadesPlanillaPdf(Request $request)
    {
        $this->logActivity('export', 'Reportes', null, 'Novedades de Planilla - PDF', [], $request);
        $data = $this->novedadesPlanilla($request)->getData(true);
        $deductoraId = $request->input('deductora_id');
        $deductora   = Deductora::find($deductoraId);
        $desde       = $request->input('desde');
        $hasta       = $request->input('hasta');

        $bgPath = public_path('pdf_background.jpg');
        $bgBase64 = file_exists($bgPath) ? 'data:image/jpeg;base64,' . base64_encode(file_get_contents($bgPath)) : '';
        $pdf = Pdf::loadHTML($this->buildNovedadesPdfHtml($data, $deductora?->nombre ?? '—', $desde, $hasta, $bgBase64))
            ->setPaper('letter', 'landscape');
        return $pdf->stream('novedades_planilla.pdf');
    }

    /**
     * Estado de reportes de planilla generados por mes
     */
    public function planillaReportsStatus(Request $request)
    {
        $periodo = $request->input('periodo', Carbon::now()->format('Y-m'));

        $reports = PlanillaReport::with('deductora:id,nombre')
            ->where('periodo', $periodo)
            ->get()
            ->map(fn($r) => [
                'id'             => $r->id,
                'deductora_id'   => $r->deductora_id,
                'deductora'      => $r->deductora?->nombre ?? '—',
                'tipo'           => $r->tipo,
                'periodo'        => $r->periodo,
                'generado_en'    => $r->created_at->toDateTimeString(),
                'actualizado_en' => $r->updated_at->toDateTimeString(),
            ]);

        $deductoras = Deductora::all(['id', 'nombre']);
        $pendientes = $deductoras->filter(fn($d) =>
            !$reports->contains('deductora_id', $d->id)
        )->values()->map(fn($d) => [
            'deductora_id' => $d->id,
            'deductora'    => $d->nombre,
        ]);

        return response()->json([
            'periodo'    => $periodo,
            'generados'  => $reports,
            'pendientes' => $pendientes,
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    //  7. INVERSIONES
    // ─────────────────────────────────────────────────────────────

    public function inversiones(Request $request)
    {
        $desde = $request->input('desde', Carbon::now()->startOfMonth()->toDateString());
        $hasta = $request->input('hasta', Carbon::now()->toDateString());

        $coupons = InvestmentCoupon::with(['investment:id,numero_desembolso,investor_id,monto_capital,tasa_anual,fecha_vencimiento,moneda', 'investment.investor:id,name'])
            ->whereBetween('fecha_cupon', [$desde, $hasta])
            ->orderBy('fecha_cupon', 'asc')
            ->get();

        $rows = $coupons->map(fn($cp) => [
            'id'                => $cp->id,
            'fecha_cupon'       => $cp->fecha_cupon instanceof \Carbon\Carbon ? $cp->fecha_cupon->toDateString() : $cp->fecha_cupon,
            'numero_desembolso' => $cp->investment?->numero_desembolso,
            'inversionista'     => $cp->investment?->investor?->name ?? '—',
            'capital'           => (float) ($cp->investment?->monto_capital ?? 0),
            'tasa_anual'        => (float) ($cp->investment?->tasa_anual ?? 0),
            'moneda'            => $cp->investment?->moneda ?? '—',
            'interes_bruto'     => (float) $cp->interes_bruto,
            'retencion'         => (float) $cp->retencion,
            'interes_neto'      => (float) $cp->interes_neto,
            'estado'            => $cp->estado,
            'fecha_vencimiento' => $cp->investment?->fecha_vencimiento instanceof \Carbon\Carbon
                ? $cp->investment->fecha_vencimiento->toDateString()
                : $cp->investment?->fecha_vencimiento,
        ])->values();

        // Cupones por mes para gráfico
        $porMes = $coupons->groupBy(fn($c) => substr($c->fecha_cupon instanceof \Carbon\Carbon ? $c->fecha_cupon->toDateString() : $c->fecha_cupon, 0, 7))
            ->map(fn($g) => [
                'interes_bruto' => round($g->sum('interes_bruto'), 2),
                'retencion'     => round($g->sum('retencion'), 2),
                'interes_neto'  => round($g->sum('interes_neto'), 2),
            ]);

        // Inversiones activas al corte
        $activasCount = Investment::where('estado', 'Activa')->count();
        $capitalActivo = Investment::where('estado', 'Activa')->sum('monto_capital');

        return response()->json([
            'data'         => $rows,
            'totales'      => [
                'cupones'       => $coupons->count(),
                'interes_bruto' => round($coupons->sum('interes_bruto'), 2),
                'retencion'     => round($coupons->sum('retencion'), 2),
                'interes_neto'  => round($coupons->sum('interes_neto'), 2),
                'capital_activo'=> round((float) $capitalActivo, 2),
                'inversiones_activas' => $activasCount,
            ],
            'por_mes'      => $porMes,
        ]);
    }

    public function inversionesExcel(Request $request)
    {
        $data = $this->inversiones($request)->getData(true);
        $rows = $data['data'];
        $totales = $data['totales'];

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Inversiones');

        $headers = ['Fecha Cupón', 'Desembolso', 'Inversionista', 'Capital', 'Tasa', 'Moneda', 'Interés Bruto', 'Retención', 'Interés Neto', 'Estado'];
        foreach ($headers as $col => $header) {
            $sheet->setCellValue(chr(65 + $col) . '1', $header);
        }
        $sheet->getStyle('A1:J1')->getFont()->setBold(true);
        $sheet->getStyle('A1:J1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('FEF3C7');

        $row = 2;
        foreach ($rows as $r) {
            $sheet->setCellValue("A{$row}", $r['fecha_cupon']);
            $sheet->setCellValue("B{$row}", $r['numero_desembolso']);
            $sheet->setCellValue("C{$row}", $r['inversionista']);
            $sheet->setCellValue("D{$row}", $r['capital']);
            $sheet->setCellValue("E{$row}", ($r['tasa_anual'] * 100) . '%');
            $sheet->setCellValue("F{$row}", $r['moneda']);
            $sheet->setCellValue("G{$row}", $r['interes_bruto']);
            $sheet->setCellValue("H{$row}", $r['retencion']);
            $sheet->setCellValue("I{$row}", $r['interes_neto']);
            $sheet->setCellValue("J{$row}", $r['estado']);
            $row++;
        }

        $sheet->setCellValue("B{$row}", 'TOTALES');
        $sheet->setCellValue("G{$row}", $totales['interes_bruto']);
        $sheet->setCellValue("H{$row}", $totales['retencion']);
        $sheet->setCellValue("I{$row}", $totales['interes_neto']);
        $sheet->getStyle("A{$row}:J{$row}")->getFont()->setBold(true);

        foreach (['D', 'G', 'H', 'I'] as $col) {
            $sheet->getStyle("{$col}2:{$col}{$row}")->getNumberFormat()->setFormatCode('#,##0.00');
        }
        foreach (range('A', 'J') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        return $this->downloadExcel($spreadsheet, 'inversiones.xlsx');
    }

    // ─────────────────────────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────────────────────────

    private function downloadExcel(Spreadsheet $spreadsheet, string $filename)
    {
        $writer = new Xlsx($spreadsheet);
        $temp   = tempnam(sys_get_temp_dir(), 'rep');
        $writer->save($temp);
        return response()->download($temp, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    private function buildCarteraPdfHtml(array $rows, array $totales, string $bgBase64 = ''): string
    {
        $th = 'style="background:#184b94;color:#ffffff;font-weight:bold;padding:7px 10px;border:none;font-size:11px;"';
        $td = 'style="background:#ffffff;color:#000000;padding:6px 10px;border:1px solid #184b94;font-size:10px;"';
        $bgImg = $bgBase64 ? '<img src="' . $bgBase64 . '" style="position:fixed;top:0;left:0;width:792pt;height:612pt;" />' : '';
        $html = '<html><head><meta charset="UTF-8"><style>
@page { margin: 0; }
body { margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; }
.c { font-family: DejaVu Sans, sans-serif; }
p { margin: 0 0 0.2px 0; }
</style></head><body>
            ' . $bgImg . '
            <!-- Pill overlay matching dark pill in bg wave: x=24pt, y=48pt, w=199pt, h=29pt -->
            <div style="position:absolute;top:48pt;left:0;width:223pt;height:26pt;background-color:rgba(255,255,255,0.8);border-radius:0 13pt 13pt 0;"></div>
            <!-- Title text centered inside pill -->
            <div style="position:absolute;top:52pt;left:47pt;">
                <h2 style="color:#184b94;margin:0;font-size:14pt;">Cartera Activa</h2>
            </div>
            <!-- Content below pill -->
            <div style="position:relative;margin-top:78pt;padding-left:47pt;padding-right:20pt;">
            <p style="color:#225399;font-size:14px;font-weight:bold;">Total créditos: ' . $totales['creditos'] . '</p>
            <p style="color:#225399;font-size:14px;font-weight:bold;">Saldo total: <span class="c">₡</span>' . number_format($totales['saldo_total'], 2) . '</p>
            <p style="color:#225399;font-size:14px;font-weight:bold;">Cuota total: <span class="c">₡</span>' . number_format($totales['cuota_total'], 2) . '</p>
            <table width="100%" cellspacing="0" cellpadding="0" style="margin-top:30px;border-collapse:collapse;">
            <tr><th ' . $th . '>Referencia</th><th ' . $th . '>Cliente</th><th ' . $th . '>Cédula</th><th ' . $th . '>Deductora</th><th ' . $th . '>Monto</th><th ' . $th . '>Saldo</th><th ' . $th . '>Cuota</th><th ' . $th . '>C.Atrasadas</th><th ' . $th . '>Próx.Fecha</th><th ' . $th . '>Estado</th></tr>';
        foreach ($rows as $r) {
            $html .= '<tr><td ' . $td . '>' . htmlspecialchars($r['referencia']) . '</td><td ' . $td . '>' . htmlspecialchars($r['cliente']) . '</td><td ' . $td . '>' . $r['cedula'] . '</td><td ' . $td . '>' . htmlspecialchars($r['deductora']) . '</td><td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['monto_credito'], 2) . '</td><td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['saldo'], 2) . '</td><td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['cuota'], 2) . '</td><td ' . $td . ' align="center">' . $r['cuotas_atrasadas'] . '</td><td ' . $td . '>' . ($r['proxima_fecha'] ?? '—') . '</td><td ' . $td . '>' . $r['status'] . '</td></tr>';
        }
        $html .= '</table></div></body></html>'; // closes content div
        return $html;
    }

    private function buildMoraPdfHtml(array $rows, array $totales, string $bgBase64 = ''): string
    {
        $th = 'style="background:#184b94;color:#ffffff;font-weight:bold;padding:7px 10px;border:none;font-size:11px;"';
        $td = 'style="background:#ffffff;color:#000000;padding:6px 10px;border:1px solid #184b94;font-size:10px;"';
        $bgImg = $bgBase64 ? '<img src="' . $bgBase64 . '" style="position:fixed;top:0;left:0;width:792pt;height:612pt;" />' : '';
        $html = '<html><head><meta charset="UTF-8"><style>
@page { margin: 0; }
body { margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; }
.c { font-family: DejaVu Sans, sans-serif; }
p { margin: 0 0 0.2px 0; }
</style></head><body>
            ' . $bgImg . '
            <div style="position:absolute;top:48pt;left:0;width:223pt;height:26pt;background-color:rgba(255,255,255,0.8);border-radius:0 13pt 13pt 0;"></div>
            <div style="position:absolute;top:52pt;left:47pt;">
                <h2 style="color:#184b94;margin:0;font-size:14pt;">Cartera en Mora</h2>
            </div>
            <div style="position:relative;margin-top:78pt;padding-left:47pt;padding-right:20pt;">
            <p style="color:#225399;font-size:14px;font-weight:bold;">Total créditos: ' . $totales['creditos'] . '</p>
            <p style="color:#225399;font-size:14px;font-weight:bold;">Saldo en mora: <span class="c">₡</span>' . number_format($totales['saldo_mora'], 2) . '</p>
            <table width="100%" cellspacing="0" cellpadding="0" style="margin-top:30px;border-collapse:collapse;">
            <tr><th ' . $th . '>Referencia</th><th ' . $th . '>Cliente</th><th ' . $th . '>Cédula</th><th ' . $th . '>Deductora</th><th ' . $th . '>Saldo</th><th ' . $th . '>Cuota</th><th ' . $th . '>Días Mora</th><th ' . $th . '>Rango</th><th ' . $th . '>Estado</th></tr>';
        foreach ($rows as $r) {
            $html .= '<tr><td ' . $td . '>' . htmlspecialchars($r['referencia']) . '</td><td ' . $td . '>' . htmlspecialchars($r['cliente']) . '</td><td ' . $td . '>' . $r['cedula'] . '</td><td ' . $td . '>' . htmlspecialchars($r['deductora']) . '</td><td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['saldo'], 2) . '</td><td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['cuota'], 2) . '</td><td ' . $td . ' align="center">' . $r['dias_mora'] . '</td><td ' . $td . '>' . $r['rango_mora'] . '</td><td ' . $td . '>' . $r['status'] . '</td></tr>';
        }
        $html .= '</table></div></body></html>';
        return $html;
    }

    private function buildPlanillaCobroPdfHtml(array $data, string $bgBase64 = ''): string
    {
        $deductora = htmlspecialchars($data['deductora']);
        $fecha     = $data['fecha'];
        $totales   = $data['totales'];
        $rows      = $data['data'];

        $th = 'style="background:#184b94;color:#ffffff;font-weight:bold;padding:7px 10px;border:none;font-size:9px;text-align:left;"';
        $td = 'style="background:#ffffff;color:#000000;padding:6px 8px;border:1px solid #184b94;font-size:8px;"';
        $tdf = 'style="background:#ffffff;color:#000000;padding:6px 8px;border:1px solid #184b94;font-size:8px;font-weight:bold;"';
        $bgImg = $bgBase64 ? '<img src="' . $bgBase64 . '" style="position:fixed;top:0;left:0;width:792pt;height:612pt;" />' : '';

        $html = '<html><head><meta charset="UTF-8"><style>
@page { margin: 0; }
body { margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; }
.c { font-family: DejaVu Sans, sans-serif; }
</style></head><body>
            ' . $bgImg . '
            <div style="position:absolute;top:48pt;left:0;width:223pt;height:26pt;background-color:rgba(255,255,255,0.8);border-radius:0 13pt 13pt 0;"></div>
            <div style="position:absolute;top:52pt;left:47pt;">
                <h2 style="color:#184b94;margin:0;font-size:14pt;">Planilla de Cobro</h2>
            </div>
            <div style="position:relative;margin-top:78pt;padding-left:47pt;padding-right:20pt;">
            <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:10px;">
                <tr>
                    <td><p style="color:#225399;font-size:12px;font-weight:bold;margin:0;">' . $deductora . '</p></td>
                    <td style="text-align:right;font-size:8px;color:#6b7280;">
                        <div>Generado: ' . $fecha . '</div>
                        <div style="font-size:9px;color:#184b94;font-weight:bold;">CR Studio</div>
                    </td>
                </tr>
            </table>
            <table width="100%" cellspacing="0" cellpadding="0" style="margin-top:40px;border-collapse:collapse;">
                <tr>
                    <td style="background:#184b94;padding:8px 16px;text-align:center;">
                        <div style="font-size:14px;color:#bfdbfe;">Créditos activos</div>
                        <div style="font-size:18px;font-weight:bold;color:#ffffff;">' . $totales['creditos'] . '</div>
                    </td>
                </tr>
                <tr><td style="height:0;"></td></tr>
                <tr>
                    <td style="background:#16a34a;padding:8px 16px;text-align:center;">
                        <div style="font-size:14px;color:#dcfce7;">Total cuotas / mes</div>
                        <div style="font-size:18px;font-weight:bold;color:#ffffff;"><span class="c">₡</span>' . number_format($totales['cuota_total'], 2) . '</div>
                    </td>
                </tr>
                <tr><td style="height:0;"></td></tr>
                <tr>
                    <td style="background:#184b94;padding:8px 16px;text-align:center;opacity:0.85;">
                        <div style="font-size:14px;color:#bfdbfe;">Saldo total cartera</div>
                        <div style="font-size:18px;font-weight:bold;color:#ffffff;"><span class="c">₡</span>' . number_format($totales['saldo_total'], 2) . '</div>
                    </td>
                </tr>
            </table>

            <table width="100%" cellspacing="0" cellpadding="0" style="margin-top:30px;border-collapse:collapse;">
                <tr>
                    <th ' . $th . ' style="width:20px;">#</th>
                    <th ' . $th . '>Nombre del Asociado</th>
                    <th ' . $th . '>Cédula</th>
                    <th ' . $th . '>No. Crédito</th>
                    <th ' . $th . ' style="text-align:center;">F. Formalización</th>
                    <th ' . $th . ' style="text-align:center;">Tasa %</th>
                    <th ' . $th . ' style="text-align:center;">Plazo</th>
                    <th ' . $th . ' style="text-align:right;">Cuota a Rebajar</th>
                    <th ' . $th . ' style="text-align:right;">Saldo</th>
                    <th ' . $th . ' style="text-align:center;">Tipo Movimiento</th>
                </tr>';

        foreach ($rows as $i => $r) {
            $bg = ($i % 2 === 0) ? '' : 'style="background:#f9fafb;"';
            $moraStyle = $r['cuotas_atrasadas'] > 0 ? 'color:#dc2626;font-weight:bold;' : '';

            // Tipo de movimiento basado en el estado del crédito
            $tipoMov = match(true) {
                $r['status'] === 'Formalizado' => 'Inclusión',
                $r['status'] === 'En Mora' => 'En Mora',
                default => 'Vigente',
            };

            $html .= '<tr ' . $bg . '>
                <td ' . $td . ' align="center">' . ($i + 1) . '</td>
                <td ' . $td . '>' . htmlspecialchars($r['cliente']) . '</td>
                <td ' . $td . '>' . $r['cedula'] . '</td>
                <td ' . $td . ' style="font-family:monospace;font-size:7px;">' . htmlspecialchars($r['referencia']) . '</td>
                <td ' . $td . ' align="center">' . $r['formalized_at'] . '</td>
                <td ' . $td . ' align="center">' . number_format($r['tasa_anual'], 2) . '%</td>
                <td ' . $td . ' align="center">' . $r['plazo'] . ' m</td>
                <td ' . $td . ' align="right" style="font-weight:bold;"><span class="c">₡</span>' . number_format($r['cuota'], 2) . '</td>
                <td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['saldo'], 2) . '</td>
                <td ' . $td . ' align="center" style="' . $moraStyle . '">' . $tipoMov . ($r['cuotas_atrasadas'] > 0 ? ' (' . $r['cuotas_atrasadas'] . ')' : '') . '</td>
            </tr>';
        }

        $html .= '<tr>
                <td ' . $tdf . ' colspan="7" align="right">TOTAL</td>
                <td ' . $tdf . ' align="right"><span class="c">₡</span>' . number_format($totales['cuota_total'], 2) . '</td>
                <td ' . $tdf . ' align="right"><span class="c">₡</span>' . number_format($totales['saldo_total'], 2) . '</td>
                <td ' . $tdf . '></td>
            </tr>
            </table>

            <div style="margin-top:40px;display:flex;justify-content:space-between;">
                <div style="text-align:center;width:45%;">
                    <div style="border-top:1px solid #374151;padding-top:6px;font-size:10px;color:#374151;">Preparado por</div>
                </div>
                <div style="text-align:center;width:45%;">
                    <div style="border-top:1px solid #374151;padding-top:6px;font-size:10px;color:#374151;">Recibido por — ' . $deductora . '</div>
                </div>
            </div>
        </div></body></html>';

        return $html;
    }

    private function buildNovedadesPdfHtml(array $data, string $deductora, string $desde, string $hasta, string $bgBase64 = ''): string
    {
        $thV = 'style="background:#184b94;color:#ffffff;font-weight:bold;padding:7px 10px;border:none;font-size:8px;"';
        $td  = 'style="background:#ffffff;color:#000000;padding:6px 8px;border:1px solid #184b94;font-size:8px;"';
        $bgImg = $bgBase64 ? '<img src="' . $bgBase64 . '" style="position:fixed;top:0;left:0;width:792pt;height:612pt;" />' : '';

        $resumen = $data['resumen'];

        $html = '<html><head><meta charset="UTF-8"><style>
@page { margin: 0; }
body { margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; }
.c { font-family: DejaVu Sans, sans-serif; }
</style></head><body>
            ' . $bgImg . '
            <div style="position:absolute;top:48pt;left:0;width:223pt;height:26pt;background-color:rgba(255,255,255,0.8);border-radius:0 13pt 13pt 0;"></div>
            <div style="position:absolute;top:52pt;left:47pt;">
                <h2 style="color:#184b94;margin:0;font-size:14pt;">Novedades de Planilla</h2>
            </div>
            <div style="position:relative;margin-top:78pt;padding-left:47pt;padding-right:20pt;">
            <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:10px;">
                <tr>
                    <td><p style="color:#225399;font-size:12px;font-weight:bold;margin:0;">' . htmlspecialchars($deductora) . '</p>
                        <p style="font-size:9px;color:#6b7280;margin:2px 0 0;">Período: ' . $desde . ' al ' . $hasta . '</p>
                    </td>
                    <td style="text-align:right;font-size:8px;color:#6b7280;">
                        <div>Generado: ' . Carbon::now()->toDateString() . '</div>
                        <div style="font-size:9px;color:#184b94;font-weight:bold;">CR Studio</div>
                    </td>
                </tr>
            </table>
            <table width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;border-collapse:collapse;">
                <tr>
                    <td style="background:#184b94;padding:8px 16px;text-align:center;">
                        <div style="font-size:8px;color:#ffffff;">Inclusiones</div>
                        <div style="font-size:18px;font-weight:bold;color:#ffffff;">' . $resumen['inclusiones'] . '</div>
                    </td>
                </tr>
                <tr>
                    <td style="background:#98b83b;padding:8px 16px;text-align:center;">
                        <div style="font-size:8px;color:#ffffff;">Exclusiones</div>
                        <div style="font-size:18px;font-weight:bold;color:#ffffff;">' . $resumen['exclusiones'] . '</div>
                    </td>
                </tr>
                <tr>
                    <td style="background:#184b94;padding:8px 16px;text-align:center;">
                        <div style="font-size:8px;color:#ffffff;">Traslados</div>
                        <div style="font-size:18px;font-weight:bold;color:#ffffff;">' . ($resumen['traslados'] ?? 0) . '</div>
                    </td>
                </tr>
                <tr>
                    <td style="background:#98b83b;padding:8px 16px;text-align:center;">
                        <div style="font-size:8px;color:#ffffff;">Refundiciones</div>
                        <div style="font-size:18px;font-weight:bold;color:#ffffff;">' . ($resumen['refundiciones'] ?? 0) . '</div>
                    </td>
                </tr>
                <tr>
                    <td style="background:#184b94;padding:8px 16px;text-align:center;">
                        <div style="font-size:8px;color:#ffffff;">Cambios cuota</div>
                        <div style="font-size:18px;font-weight:bold;color:#ffffff;">' . $resumen['modificaciones'] . '</div>
                    </td>
                </tr>
            </table>
            <div style="margin-top:20px;">';

        // ── Inclusiones ──
        if (!empty($data['inclusiones'])) {
            $html .= '<h3 style="color:#065f46;font-size:11px;margin:14px 0 4px;">INCLUIR EN PLANILLA (' . count($data['inclusiones']) . ')</h3>
            <table width="100%" cellspacing="0" style="border-collapse:collapse;margin-bottom:12px;">
                <tr style="background:#d1fae5;">
                    <th ' . $thV . '>Referencia</th><th ' . $thV . '>Nombre</th><th ' . $thV . '>Cédula</th>
                    <th ' . $thV . '>F. Formalización</th><th ' . $thV . '>Tasa %</th><th ' . $thV . '>Plazo</th>
                    <th ' . $thV . ' align="right">Cuota</th><th ' . $thV . ' align="right">Saldo</th><th ' . $thV . '>Fecha</th>
                </tr>';
            foreach ($data['inclusiones'] as $r) {
                $html .= '<tr>
                    <td ' . $td . ' style="font-family:monospace;font-size:7px;">' . htmlspecialchars($r['referencia']) . '</td>
                    <td ' . $td . '>' . htmlspecialchars($r['cliente']) . '</td>
                    <td ' . $td . '>' . $r['cedula'] . '</td>
                    <td ' . $td . '>' . ($r['fecha_formalizacion'] ?? '—') . '</td>
                    <td ' . $td . ' align="center">' . number_format($r['tasa_anual'] ?? 0, 2) . '%</td>
                    <td ' . $td . ' align="center">' . ($r['plazo'] ?? 0) . ' m</td>
                    <td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['cuota'], 2) . '</td>
                    <td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['saldo'] ?? 0, 2) . '</td>
                    <td ' . $td . '>' . ($r['fecha'] ?? '—') . '</td>
                </tr>';
            }
            $html .= '</table>';
        }

        // ── Exclusiones ──
        if (!empty($data['exclusiones'])) {
            $html .= '<h3 style="color:#991b1b;font-size:11px;margin:14px 0 4px;">EXCLUIR DE PLANILLA (' . count($data['exclusiones']) . ')</h3>
            <table width="100%" cellspacing="0" style="border-collapse:collapse;margin-bottom:12px;">
                <tr style="background:#fee2e2;">
                    <th ' . $thV . '>Referencia</th><th ' . $thV . '>Nombre</th><th ' . $thV . '>Cédula</th>
                    <th ' . $thV . '>Motivo</th><th ' . $thV . ' align="right">Cuota</th><th ' . $thV . '>Fecha</th>
                </tr>';
            foreach ($data['exclusiones'] as $r) {
                $html .= '<tr>
                    <td ' . $td . ' style="font-family:monospace;font-size:7px;">' . htmlspecialchars($r['referencia']) . '</td>
                    <td ' . $td . '>' . htmlspecialchars($r['cliente']) . '</td>
                    <td ' . $td . '>' . $r['cedula'] . '</td>
                    <td ' . $td . '>' . htmlspecialchars($r['motivo'] ?? '—') . '</td>
                    <td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['cuota'], 2) . '</td>
                    <td ' . $td . '>' . ($r['fecha'] ?? '—') . '</td>
                </tr>';
            }
            $html .= '</table>';
        }

        // ── Traslados ──
        if (!empty($data['traslados'])) {
            $html .= '<h3 style="color:#1e40af;font-size:11px;margin:14px 0 4px;">TRASLADOS DE COOPERATIVA (' . count($data['traslados']) . ')</h3>
            <table width="100%" cellspacing="0" style="border-collapse:collapse;margin-bottom:12px;">
                <tr style="background:#dbeafe;">
                    <th ' . $thV . '>Referencia</th><th ' . $thV . '>Nombre</th><th ' . $thV . '>Cédula</th>
                    <th ' . $thV . '>De Cooperativa</th><th ' . $thV . '>A Cooperativa</th>
                    <th ' . $thV . ' align="right">Cuota</th><th ' . $thV . '>Fecha</th>
                </tr>';
            foreach ($data['traslados'] as $r) {
                $html .= '<tr>
                    <td ' . $td . ' style="font-family:monospace;font-size:7px;">' . htmlspecialchars($r['referencia']) . '</td>
                    <td ' . $td . '>' . htmlspecialchars($r['cliente']) . '</td>
                    <td ' . $td . '>' . $r['cedula'] . '</td>
                    <td ' . $td . '>' . htmlspecialchars($r['deductora_anterior'] ?? '—') . '</td>
                    <td ' . $td . '>' . htmlspecialchars($r['deductora_nueva'] ?? '—') . '</td>
                    <td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['cuota'], 2) . '</td>
                    <td ' . $td . '>' . ($r['fecha'] ?? '—') . '</td>
                </tr>';
            }
            $html .= '</table>';
        }

        // ── Refundiciones ──
        if (!empty($data['refundiciones'])) {
            $html .= '<h3 style="color:#5b21b6;font-size:11px;margin:14px 0 4px;">REFUNDICIONES (' . count($data['refundiciones']) . ')</h3>
            <table width="100%" cellspacing="0" style="border-collapse:collapse;margin-bottom:12px;">
                <tr style="background:#ede9fe;">
                    <th ' . $thV . '>Referencia</th><th ' . $thV . '>Nombre</th><th ' . $thV . '>Cédula</th>
                    <th ' . $thV . '>Detalle</th><th ' . $thV . ' align="right">Cuota</th>
                    <th ' . $thV . ' align="right">Saldo</th><th ' . $thV . '>Fecha</th>
                </tr>';
            foreach ($data['refundiciones'] as $r) {
                $html .= '<tr>
                    <td ' . $td . ' style="font-family:monospace;font-size:7px;">' . htmlspecialchars($r['referencia']) . '</td>
                    <td ' . $td . '>' . htmlspecialchars($r['cliente']) . '</td>
                    <td ' . $td . '>' . $r['cedula'] . '</td>
                    <td ' . $td . '>' . htmlspecialchars($r['motivo'] ?? '—') . '</td>
                    <td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['cuota'], 2) . '</td>
                    <td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['saldo'] ?? 0, 2) . '</td>
                    <td ' . $td . '>' . ($r['fecha'] ?? '—') . '</td>
                </tr>';
            }
            $html .= '</table>';
        }

        // ── Modificaciones de cuota ──
        if (!empty($data['modificaciones'])) {
            $html .= '<h3 style="color:#92400e;font-size:11px;margin:14px 0 4px;">MODIFICAR CUOTA (' . count($data['modificaciones']) . ')</h3>
            <table width="100%" cellspacing="0" style="border-collapse:collapse;margin-bottom:12px;">
                <tr style="background:#fef3c7;">
                    <th ' . $thV . '>Referencia</th><th ' . $thV . '>Nombre</th><th ' . $thV . '>Cédula</th>
                    <th ' . $thV . ' align="right">Cuota anterior</th><th ' . $thV . ' align="right">Cuota nueva</th><th ' . $thV . ' align="right">Diferencia</th>
                </tr>';
            foreach ($data['modificaciones'] as $r) {
                $dif = $r['diferencia'];
                $difStyle = $dif < 0 ? 'color:#059669;' : 'color:#dc2626;';
                $html .= '<tr>
                    <td ' . $td . ' style="font-family:monospace;font-size:7px;">' . htmlspecialchars($r['referencia']) . '</td>
                    <td ' . $td . '>' . htmlspecialchars($r['cliente']) . '</td>
                    <td ' . $td . '>' . $r['cedula'] . '</td>
                    <td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['cuota_anterior'], 2) . '</td>
                    <td ' . $td . ' align="right" style="font-weight:bold;"><span class="c">₡</span>' . number_format($r['cuota_nueva'], 2) . '</td>
                    <td ' . $td . ' align="right" style="' . $difStyle . 'font-weight:bold;">' . ($dif > 0 ? '+' : '') . '<span class="c">₡</span>' . number_format($dif, 2) . '</td>
                </tr>';
            }
            $html .= '</table>';
        }

        if ($resumen['total'] === 0) {
            $html .= '<p style="text-align:center;color:#6b7280;padding:30px;">No hay novedades para el período seleccionado.</p>';
        }

        $html .= '</div></div></body></html>';
        return $html;
    }

    private function buildCobrosPdfHtml(array $rows, array $totales, string $bgBase64 = ''): string
    {
        $th = 'style="background:#184b94;color:#ffffff;font-weight:bold;padding:7px 10px;border:none;font-size:11px;"';
        $td = 'style="background:#ffffff;color:#000000;padding:6px 10px;border:1px solid #184b94;font-size:10px;"';
        $bgImg = $bgBase64 ? '<img src="' . $bgBase64 . '" style="position:fixed;top:0;left:0;width:792pt;height:612pt;" />' : '';
        $html = '<html><head><meta charset="UTF-8"><style>
@page { margin: 0; }
body { margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; }
.c { font-family: DejaVu Sans, sans-serif; }
p { margin: 0 0 0.2px 0; }
</style></head><body>
            ' . $bgImg . '
            <div style="position:absolute;top:48pt;left:0;width:223pt;height:26pt;background-color:rgba(255,255,255,0.8);border-radius:0 13pt 13pt 0;"></div>
            <div style="position:absolute;top:52pt;left:47pt;">
                <h2 style="color:#184b94;margin:0;font-size:14pt;">Historial de Cobros</h2>
            </div>
            <div style="position:relative;margin-top:78pt;padding-left:47pt;padding-right:20pt;">
            <p style="color:#225399;font-size:14px;font-weight:bold;">Total pagos: ' . $totales['pagos'] . '</p>
            <p style="color:#225399;font-size:14px;font-weight:bold;">Monto total: <span class="c">₡</span>' . number_format($totales['monto_total'], 2) . '</p>
            <p style="color:#225399;font-size:14px;font-weight:bold;">Amortización: <span class="c">₡</span>' . number_format($totales['amortizacion'], 2) . '</p>
            <table width="100%" cellspacing="0" cellpadding="0" style="margin-top:30px;border-collapse:collapse;">
            <tr><th ' . $th . '>Fecha</th><th ' . $th . '>Referencia</th><th ' . $th . '>Cliente</th><th ' . $th . '>Cédula</th><th ' . $th . '>Deductora</th><th ' . $th . '>Cuota #</th><th ' . $th . '>Monto</th><th ' . $th . '>Amort.</th><th ' . $th . '>Interés</th><th ' . $th . '>Fuente</th></tr>';
        foreach ($rows as $r) {
            $html .= '<tr><td ' . $td . '>' . $r['fecha_pago'] . '</td><td ' . $td . '>' . htmlspecialchars($r['referencia']) . '</td><td ' . $td . '>' . htmlspecialchars($r['cliente']) . '</td><td ' . $td . '>' . $r['cedula'] . '</td><td ' . $td . '>' . htmlspecialchars($r['deductora']) . '</td><td ' . $td . ' align="center">' . $r['numero_cuota'] . '</td><td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['monto'], 2) . '</td><td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['amortizacion'], 2) . '</td><td ' . $td . ' align="right"><span class="c">₡</span>' . number_format($r['interes_corriente'], 2) . '</td><td ' . $td . '>' . $r['source'] . '</td></tr>';
        }
        $html .= '</table></div></body></html>';
        return $html;
    }
}
