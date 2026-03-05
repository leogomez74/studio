<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Resumen - {{ $investor->name }}</title>
    <style>
        body { font-family: 'Helvetica', sans-serif; font-size: 10px; }
        h1 { font-size: 16px; margin-bottom: 5px; }
        h2 { font-size: 13px; margin-top: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 3px; }
        .summary-box { background: #f1f5f9; padding: 10px; margin-bottom: 15px; border-radius: 4px; }
        .summary-item { display: inline-block; margin-right: 30px; }
        .summary-item label { font-weight: bold; font-size: 9px; text-transform: uppercase; color: #666; display: block; }
        .summary-item span { font-size: 14px; font-family: 'Courier New', monospace; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #e2e8f0; padding: 4px 6px; text-align: left; border: 1px solid #cbd5e1; font-size: 9px; }
        td { padding: 4px 6px; border: 1px solid #cbd5e1; }
        .text-right { text-align: right; }
        .mono { font-family: 'Courier New', monospace; }
        .fecha { font-size: 9px; text-align: right; color: #666; }
    </style>
</head>
<body>
    <h1>Resumen: {{ $investor->name }}</h1>
    <p class="fecha">Generado: {{ now()->format('d/m/Y H:i') }}</p>

    <div class="summary-box">
        <div class="summary-item"><label>Cédula</label><span>{{ $investor->cedula ?? 'N/A' }}</span></div>
        <div class="summary-item"><label>Total Capital CRC</label><span>₡{{ number_format($total_capital_crc, 2) }}</span></div>
        <div class="summary-item"><label>Total Capital USD</label><span>${{ number_format($total_capital_usd, 2) }}</span></div>
        <div class="summary-item"><label>Intereses Pagados CRC</label><span>₡{{ number_format($total_interes_pagado_crc, 2) }}</span></div>
        <div class="summary-item"><label>Intereses Pagados USD</label><span>${{ number_format($total_interes_pagado_usd, 2) }}</span></div>
    </div>

    <h2>Inversiones</h2>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th class="text-right">Monto</th>
                <th>Moneda</th>
                <th>Tasa</th>
                <th>Plazo</th>
                <th>Inicio</th>
                <th>Vencimiento</th>
                <th>Forma Pago</th>
                <th>Estado</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($investments as $inv)
            <tr>
                <td>{{ $inv->numero_desembolso }}</td>
                <td class="text-right mono">{{ number_format($inv->monto_capital, 2) }}</td>
                <td>{{ $inv->moneda }}</td>
                <td>{{ number_format($inv->tasa_anual * 100, 2) }}%</td>
                <td>{{ $inv->plazo_meses }}m</td>
                <td>{{ $inv->fecha_inicio->format('d/m/Y') }}</td>
                <td>{{ $inv->fecha_vencimiento->format('d/m/Y') }}</td>
                <td>{{ $inv->forma_pago }}</td>
                <td>{{ $inv->estado }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
