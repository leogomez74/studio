<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reporte de Retenciones</title>
    <style>
        @page { margin: 0; size: letter portrait; }
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: Helvetica, Arial, sans-serif;
            font-size: 8px;
            color: #1a1a1a;
        }

        /* ─── SECCIÓN MONEDA ─── */
        .section-title {
            font-size: 9px;
            font-weight: bold;
            background-color: #184b94;
            color: #ffffff;
            padding: 4px 10px;
            margin-top: 10px;
            margin-bottom: 0;
            letter-spacing: 0.3px;
        }

        /* ─── TABLA ─── */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
        }

        thead tr th {
            background-color: #184b94;
            color: #ffffff;
            border: 1px solid #184b94;
            padding: 5px 5px;
            font-size: 7.5px;
            font-weight: bold;
            text-align: center;
            vertical-align: bottom;
            white-space: nowrap;
        }

        tbody tr td {
            background-color: #ffffff;
            border: 1px solid #184b94;
            padding: 4px 5px;
            font-size: 7.5px;
            vertical-align: middle;
        }

        /* ─── COLUMNAS ─── */
        .col-num      { width: 5%;  text-align: left; }
        .col-nombre   { width: 22%; text-align: left; }
        .col-monto    { width: 12%; text-align: right; }
        .col-plazo    { width: 4%;  text-align: center; }
        .col-fecha    { width: 8%;  text-align: center; }
        .col-tasa     { width: 5%;  text-align: center; }
        .col-int      { width: 10%; text-align: right; }
        .col-ret      { width: 9%;  text-align: right; }
        .col-neto     { width: 10%; text-align: right; }
        .col-pago     { width: 8%;  text-align: center; }

        /* ─── FILA TOTALES ─── */
        .total-row td {
            background-color: #dbeafe !important;
            font-weight: bold;
            border-top: 2px solid #184b94;
            font-size: 7.5px;
            color: #184b94;
        }
    </style>
</head>
<body>

    {{-- BACKGROUND portrait (612×792pt) --}}
    @if(!empty($bgBase64))
    <img src="{{ $bgBase64 }}" style="position:fixed;top:0;left:0;width:612pt;height:792pt;" />
    @endif

    {{-- TÍTULO CENTRADO CON UNDERLINE --}}
    <div style="position:absolute;top:114pt;left:0;width:612pt;text-align:center;">
        <span style="font-family:Helvetica,Arial,sans-serif;font-size:14pt;font-weight:bold;color:#184b94;text-decoration:underline;">
            Reporte de Retenciones
        </span>
    </div>

    {{-- FECHA --}}
    <div style="position:absolute;top:142pt;left:0;width:612pt;text-align:center;">
        <span style="font-family:Helvetica,Arial,sans-serif;font-size:8pt;color:#555;">
            Fecha de corte: {{ now()->format('d/m/Y') }}
        </span>
    </div>

    {{-- CONTENIDO --}}
    <div style="position:relative;margin-top:168pt;padding-left:24pt;padding-right:24pt;">
        @foreach (['dolares' => 'DÓLARES (USD)', 'colones' => 'COLONES (CRC)'] as $key => $label)
        @php $section = $$key; @endphp

        <div class="section-title">{{ $label }}</div>

        <table>
            <thead>
                <tr>
                    <th class="col-num">#</th>
                    <th class="col-nombre">Inversionista</th>
                    <th class="col-monto">Monto Capital</th>
                    <th class="col-plazo">Plazo</th>
                    <th class="col-fecha">Inicio</th>
                    <th class="col-fecha">Vencimiento</th>
                    <th class="col-tasa">Tasa</th>
                    <th class="col-int">Int. Mensual</th>
                    <th class="col-ret">Retención</th>
                    <th class="col-neto">Int. Neto</th>
                    <th class="col-pago">Forma Pago</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($section['inversiones'] as $inv)
                <tr>
                    <td class="col-num">{{ $inv->numero_desembolso }}</td>
                    <td class="col-nombre">{{ $inv->investor->name ?? '' }}</td>
                    <td class="col-monto">{{ number_format($inv->monto_capital, 2) }}</td>
                    <td class="col-plazo">{{ $inv->plazo_meses }}m</td>
                    <td class="col-fecha">{{ $inv->fecha_inicio->format('d/m/Y') }}</td>
                    <td class="col-fecha">{{ $inv->fecha_vencimiento->format('d/m/Y') }}</td>
                    <td class="col-tasa">{{ number_format($inv->tasa_anual * 100, 2) }}%</td>
                    <td class="col-int">{{ number_format($inv->interes_mensual, 2) }}</td>
                    <td class="col-ret">{{ number_format($inv->retencion_mensual, 2) }}</td>
                    <td class="col-neto">{{ number_format($inv->interes_neto_mensual, 2) }}</td>
                    <td class="col-pago">{{ $inv->forma_pago }}</td>
                </tr>
                @empty
                <tr><td colspan="11" style="text-align:center; padding:8px; color:#888;">Sin inversiones activas</td></tr>
                @endforelse

                <tr class="total-row">
                    <td colspan="2" style="text-align:left; padding-left:5px;">TOTALES</td>
                    <td class="col-monto">{{ number_format($section['total_capital'], 2) }}</td>
                    <td colspan="4"></td>
                    <td class="col-int">{{ number_format($section['total_interes_mensual'], 2) }}</td>
                    <td class="col-ret">{{ number_format($section['total_retencion'], 2) }}</td>
                    <td class="col-neto">{{ number_format($section['total_neto'], 2) }}</td>
                    <td></td>
                </tr>
            </tbody>
        </table>

        @endforeach

    </div>

</body>
</html>
