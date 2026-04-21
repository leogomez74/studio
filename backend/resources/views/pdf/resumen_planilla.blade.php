<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Resumen de Distribución de Planilla</title>
    <style>
        @page { margin: 0; size: letter portrait; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Helvetica, Arial, sans-serif; font-size: 9px; color: #12368c; }
        .colones { font-family: 'DejaVu Sans', sans-serif; }

        table { width: 100%; border-collapse: collapse; }

        thead tr th {
            background-color: #184b94;
            color: #ffffff;
            border: none;
            padding: 5px 6px;
            font-size: 8px;
            font-weight: bold;
            text-align: center;
            white-space: nowrap;
        }

        tbody tr td {
            background-color: #ccd8e8;
            border: none;
            padding: 3px 6px;
            font-size: 8px;
            color: #12368c;
        }

        tbody tr.alt td { background-color: #eeeeee; }

        .total-row td {
            background-color: #ccd8e8;
            font-weight: bold;
            border-top: none;
            color: #12368c;
        }

        .info-label { font-weight: bold; }
    </style>
</head>
<body>

    {{-- BACKGROUND --}}
    <img src="{{ $bgBase64 }}" style="position:fixed;top:0;left:0;width:612pt;height:792pt;" />

    {{-- TÍTULO --}}
    <div style="position:absolute;top:114pt;left:0;width:612pt;text-align:center;">
        <span style="font-family:Helvetica,Arial,sans-serif;font-size:14pt;font-weight:bold;color:#12368c;text-decoration:underline;">
            Resumen de Distribución de Planilla
        </span>
    </div>

    {{-- CONTENIDO --}}
    <div style="position:relative;margin-top:148pt;padding-left:24pt;padding-right:24pt;">

        {{-- INFO BLOCK — dos columnas --}}
        <table style="width:100%;border-collapse:collapse;border:none;font-family:Helvetica,Arial,sans-serif;font-size:9px;color:#12368c;line-height:1.8;margin-bottom:8pt;">
            <tr>
                {{-- Columna izquierda: ~44% --}}
                <td style="vertical-align:top;width:38%;padding-right:0;border:none;background:transparent;">
                    <div><span class="info-label">Deductora:</span> {{ $planilla->deductora->nombre ?? '-' }}</div>
                    <div><span class="info-label">Procesada por:</span> {{ $planilla->user->name ?? '-' }}</div>
                    <div><span class="info-label">Total Pagos:</span> {{ $planilla->cantidad_pagos ?? $payments->count() }}</div>
                </td>
                {{-- Separación visual --}}
                <td style="width:4%;border:none;background:transparent;"></td>
                {{-- Columna derecha: ~58% — alineada bajo la "R" del título --}}
                <td style="vertical-align:top;width:58%;border:none;background:transparent;">
                    <div><span class="info-label">Fecha Planilla:</span> {{ $planilla->fecha_planilla ?? '-' }}</div>
                    <div><span class="info-label">Estado:</span> {{ ucfirst($planilla->estado) }}</div>
                    <div><span class="info-label">Monto Total:</span> <span class="colones">₡</span>{{ number_format((float) $planilla->monto_total, 2) }}</div>
                </td>
            </tr>
        </table>

        {{-- TABLA --}}
        <table>
            <thead>
                <tr>
                    <th style="width:4%;">#</th>
                    <th style="width:16%;">Operación</th>
                    <th style="width:24%;">Deudor</th>
                    <th style="width:12%;">Cédula</th>
                    <th style="width:8%;">Cuota N°</th>
                    <th style="width:13%;text-align:right;">Monto Pagado</th>
                    <th style="width:13%;text-align:right;">Sobrante</th>
                    <th style="width:10%;">Estado</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($payments as $idx => $pago)
                @php
                    $credit  = $pago->credit;
                    $lead    = $credit->lead ?? null;
                    $nombre  = $lead
                        ? trim(($lead->name ?? '') . ' ' . ($lead->apellido1 ?? '') . ' ' . ($lead->apellido2 ?? ''))
                        : ($pago->cedula ?? '-');
                    $operacion = $credit ? ($credit->numero_operacion ?? $credit->reference ?? '-') : '-';
                    $sobrante  = $pago->movimiento_total > 0 ? '<span class="colones">₡</span>' . number_format((float) $pago->movimiento_total, 2) : '-';
                    // Estado real de la cuota en el plan de pagos
                    $cuotaEstado = null;
                    if ($credit && $pago->numero_cuota) {
                        $cuotaRow = \App\Models\PlanDePago::where('credit_id', $credit->id)
                            ->where('numero_cuota', $pago->numero_cuota)
                            ->value('estado');
                        $cuotaEstado = $cuotaRow;
                    }
                    if ($pago->estado_reverso === 'Anulado') {
                        $estado = 'Anulado';
                    } elseif ($pago->movimiento_total > 0.50) {
                        $estado = 'Sobrepago';
                    } elseif ($cuotaEstado) {
                        $estado = $cuotaEstado; // Pagado, Parcial, etc.
                    } else {
                        $estado = $pago->estado ?? '-';
                    }
                @endphp
                <tr class="{{ $idx % 2 === 1 ? 'alt' : '' }}">
                    <td style="text-align:center;">{{ $idx + 1 }}</td>
                    <td>{{ $operacion }}</td>
                    <td>{{ $nombre }}</td>
                    <td>{{ $pago->cedula ?? '-' }}</td>
                    <td style="text-align:center;">{{ $pago->numero_cuota ?? '-' }}</td>
                    <td style="text-align:right;"><span class="colones">₡</span>{{ number_format((float) $pago->monto, 2) }}</td>
                    <td style="text-align:right;">{!! $sobrante !!}</td>
                    <td style="text-align:center;">
                        @if($estado === 'Pagado')
                            <span style="color:#16a34a;font-weight:bold;">Pagado</span>
                        @elseif($estado === 'Parcial')
                            <span style="color:#d97706;font-weight:bold;">Parcial</span>
                        @elseif($estado === 'Sobrepago')
                            <span style="color:#2563eb;font-weight:bold;">Sobrepago</span>
                        @elseif($estado === 'Anulado')
                            <span style="color:#dc2626;font-weight:bold;">Anulado</span>
                        @else
                            {{ $estado }}
                        @endif
                    </td>
                </tr>
                @empty
                <tr><td colspan="8" style="text-align:center;padding:8px;color:#888;">Sin pagos registrados</td></tr>
                @endforelse

                <tr class="total-row">
                    <td colspan="5" style="text-align:right;padding-right:8px;">TOTAL</td>
                    <td style="text-align:right;background-color:#184b94;color:#ffffff;font-weight:bold;"><span class="colones">₡</span>{{ number_format((float) $totalMonto, 2) }}</td>
                    <td colspan="2" style="background-color:#184b94;"></td>
                </tr>
            </tbody>
        </table>

    </div>

</body>
</html>
