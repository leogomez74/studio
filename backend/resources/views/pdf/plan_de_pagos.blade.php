<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Plan de Pagos - {{ $credit->numero_operacion ?? $credit->reference }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 7pt; color: #333; }
        .header { padding: 10px 15px; border-bottom: 2px solid #2980b9; margin-bottom: 8px; }
        .header h1 { font-size: 14pt; color: #2980b9; margin-bottom: 5px; }
        .info-grid { display: table; width: 100%; margin-bottom: 5px; }
        .info-row { display: table-row; }
        .info-cell { display: table-cell; width: 33%; font-size: 8pt; padding: 1px 0; }
        .info-cell strong { color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
        th { background-color: #2980b9; color: white; font-size: 5.5pt; padding: 3px 2px; text-align: center; white-space: nowrap; }
        td { font-size: 6pt; padding: 2px 2px; border-bottom: 0.5px solid #ddd; text-align: right; white-space: nowrap; font-family: 'Courier New', monospace; }
        td.center { text-align: center; font-family: 'Helvetica', 'Arial', sans-serif; }
        td.left { text-align: left; font-family: 'Helvetica', 'Arial', sans-serif; }
        tr:nth-child(even) { background-color: #f5f5f5; }
        tr.mora { background-color: #fde8e8; }
        tr.pagado { background-color: #e8fde8; }
        tr.parcial { background-color: #fdf8e8; }
        .badge { display: inline-block; padding: 1px 4px; border-radius: 3px; font-size: 5.5pt; font-weight: bold; }
        .badge-pagado { background: #d4edda; color: #155724; }
        .badge-mora { background: #f8d7da; color: #721c24; }
        .badge-parcial { background: #fff3cd; color: #856404; }
        .badge-pendiente { background: #e2e3e5; color: #383d41; }
        .badge-pagado-mora { background: #cce5ff; color: #004085; }
        .footer { margin-top: 10px; text-align: center; font-size: 6pt; color: #999; border-top: 1px solid #ddd; padding-top: 5px; }
        @page { size: landscape; margin: 8mm; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Plan de Pagos - {{ $credit->numero_operacion ?? $credit->reference }}</h1>
        <div class="info-grid">
            <div class="info-row">
                <div class="info-cell"><strong>Cliente:</strong> {{ $credit->lead->name ?? 'N/A' }}</div>
                <div class="info-cell"><strong>Saldo por Pagar:</strong> {{ number_format($credit->saldo, 2, ',', ' ') }}</div>
                <div class="info-cell"><strong>Tasa:</strong> {{ $credit->tasa_anual ?? ($credit->tasa->tasa ?? '0.00') }}%</div>
            </div>
            <div class="info-row">
                <div class="info-cell"><strong>Monto:</strong> {{ number_format($credit->monto_credito, 2, ',', ' ') }}</div>
                <div class="info-cell"><strong>Estado:</strong> {{ $credit->status }}</div>
                <div class="info-cell"><strong>Plazo:</strong> {{ $credit->plazo }} meses</div>
            </div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Cuota</th>
                <th>Poliza</th>
                <th>Int.Corr</th>
                <th>Int.C.Venc</th>
                <th>Int.Mora</th>
                <th>Amort</th>
                <th>Capital</th>
                <th>Saldo por Pagar</th>
                <th>Mora</th>
                <th>F.Mov</th>
                <th>Mov.Total</th>
                <th>Mov.Pol</th>
                <th>Mov.Int.C</th>
                <th>Mov.Int.V</th>
                <th>Mov.Int.M</th>
                <th>Mov.Amort</th>
                <th>Mov.Princ</th>
            </tr>
        </thead>
        <tbody>
            @foreach($planDePagos as $p)
            <tr class="{{ $p->estado === 'Mora' ? 'mora' : ($p->estado === 'Pagado' ? 'pagado' : ($p->estado === 'Parcial' ? 'parcial' : '')) }}">
                <td class="center">{{ $p->numero_cuota }}</td>
                <td class="center">
                    <span class="badge badge-{{ strtolower(str_replace(['/', ' '], '-', $p->estado ?? 'pendiente')) }}">
                        {{ $p->estado ?? 'Pendiente' }}
                    </span>
                </td>
                <td class="center">{{ $p->fecha_corte ? \Carbon\Carbon::parse($p->fecha_corte)->format('d/m/Y') : '-' }}</td>
                <td>{{ number_format($p->cuota, 2, ',', ' ') }}</td>
                <td>{{ number_format($p->poliza ?? 0, 2, ',', ' ') }}</td>
                <td>{{ number_format($p->interes_corriente, 2, ',', ' ') }}</td>
                <td>{{ number_format($p->int_corriente_vencido ?? 0, 2, ',', ' ') }}</td>
                <td>{{ number_format($p->interes_moratorio ?? 0, 2, ',', ' ') }}</td>
                <td>{{ number_format($p->amortizacion, 2, ',', ' ') }}</td>
                <td>{{ number_format($p->saldo_anterior, 2, ',', ' ') }}</td>
                <td>{{ number_format($p->saldo_nuevo, 2, ',', ' ') }}</td>
                <td class="center">{{ $p->dias_mora ?? 0 }}</td>
                <td class="center">{{ $p->fecha_movimiento ? \Carbon\Carbon::parse($p->fecha_movimiento)->format('d/m/Y') : '-' }}</td>
                <td>{{ number_format($p->movimiento_total ?? 0, 2, ',', ' ') }}</td>
                <td>{{ number_format($p->movimiento_poliza ?? 0, 2, ',', ' ') }}</td>
                <td>{{ number_format($p->movimiento_interes_corriente ?? 0, 2, ',', ' ') }}</td>
                <td>{{ number_format($p->movimiento_int_corriente_vencido ?? 0, 2, ',', ' ') }}</td>
                <td>{{ number_format($p->movimiento_interes_moratorio ?? 0, 2, ',', ' ') }}</td>
                <td>{{ number_format($p->movimiento_amortizacion ?? 0, 2, ',', ' ') }}</td>
                <td>{{ number_format($p->movimiento_principal ?? 0, 2, ',', ' ') }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="footer">
        Generado el {{ now()->format('d/m/Y H:i:s') }}
    </div>
</body>
</html>
