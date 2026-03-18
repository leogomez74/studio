<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Resumen de Distribución de Planilla</title>
    <style>
        @page { margin: 0; size: letter portrait; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Helvetica, Arial, sans-serif; font-size: 9px; color: #12368c; }

        table { width: 100%; border-collapse: collapse; }

        thead tr th {
            background-color: #184b94;
            color: #ffffff;
            border: 1px solid #184b94;
            padding: 5px 5px;
            font-size: 8px;
            font-weight: bold;
            text-align: center;
            white-space: nowrap;
        }

        tbody tr td {
            background-color: #ffffff;
            border: 1px solid #184b94;
            padding: 3px 5px;
            font-size: 8px;
            color: #12368c;
        }

        tbody tr.alt td { background-color: #f0f4fa; }

        .total-row td {
            background-color: #dbeafe;
            font-weight: bold;
            border-top: 2px solid #184b94;
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
        <table style="width:100%;border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;font-size:9px;color:#12368c;line-height:1.8;margin-bottom:8pt;">
            <tr>
                {{-- Columna izquierda: ~44% --}}
                <td style="vertical-align:top;width:38%;padding-right:0;">
                    <div><span class="info-label">Deductora:</span> {{ $planilla->deductora->nombre ?? '-' }}</div>
                    <div><span class="info-label">Procesada por:</span> {{ $planilla->user->name ?? '-' }}</div>
                    <div><span class="info-label">Total Pagos:</span> {{ $planilla->cantidad_pagos ?? $payments->count() }}</div>
                </td>
                {{-- Separación visual --}}
                <td style="width:4%;"></td>
                {{-- Columna derecha: ~58% — alineada bajo la "R" del título --}}
                <td style="vertical-align:top;width:58%;">
                    <div><span class="info-label">Fecha Planilla:</span> {{ $planilla->fecha_planilla ?? '-' }}</div>
                    <div><span class="info-label">Estado:</span> {{ ucfirst($planilla->estado) }}</div>
                    <div><span class="info-label">Monto Total:</span> ₡{{ number_format((float) $planilla->monto_total, 2) }}</div>
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
                    $sobrante  = $pago->movimiento_total > 0 ? '₡' . number_format((float) $pago->movimiento_total, 2) : '-';
                    $estado    = $pago->estado_reverso === 'Anulado' ? 'Anulado' : ($pago->estado ?? '-');
                @endphp
                <tr class="{{ $idx % 2 === 1 ? 'alt' : '' }}">
                    <td style="text-align:center;">{{ $idx + 1 }}</td>
                    <td>{{ $operacion }}</td>
                    <td>{{ $nombre }}</td>
                    <td>{{ $pago->cedula ?? '-' }}</td>
                    <td style="text-align:center;">{{ $pago->numero_cuota ?? '-' }}</td>
                    <td style="text-align:right;">₡{{ number_format((float) $pago->monto, 2) }}</td>
                    <td style="text-align:right;">{{ $sobrante }}</td>
                    <td style="text-align:center;">{{ $estado }}</td>
                </tr>
                @empty
                <tr><td colspan="8" style="text-align:center;padding:8px;color:#888;">Sin pagos registrados</td></tr>
                @endforelse

                <tr class="total-row">
                    <td colspan="5" style="text-align:right;padding-right:8px;">TOTAL</td>
                    <td style="text-align:right;">₡{{ number_format((float) $totalMonto, 2) }}</td>
                    <td colspan="2"></td>
                </tr>
            </tbody>
        </table>

    </div>

</body>
</html>
