<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Detalle Inversión {{ $investment->numero_desembolso }}</title>
    <style>
        body { font-family: 'Helvetica', sans-serif; font-size: 10px; }
        h1 { font-size: 16px; margin-bottom: 5px; }
        .info-grid { display: table; width: 100%; margin-bottom: 15px; }
        .info-item { display: table-cell; width: 25%; padding: 5px; }
        .info-item label { font-weight: bold; display: block; color: #666; font-size: 9px; text-transform: uppercase; }
        .info-item span { font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #e2e8f0; padding: 4px 6px; text-align: left; border: 1px solid #cbd5e1; font-size: 9px; }
        td { padding: 4px 6px; border: 1px solid #cbd5e1; }
        .text-right { text-align: right; }
        .mono { font-family: 'Courier New', monospace; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: bold; }
        .badge-pagado { background: #dcfce7; color: #166534; }
        .badge-pendiente { background: #fef3c7; color: #92400e; }
        .badge-reservado { background: #dbeafe; color: #1e40af; }
        .fecha { font-size: 9px; text-align: right; color: #666; }
    </style>
</head>
<body>
    <h1>Inversión: {{ $investment->numero_desembolso }}</h1>
    <p class="fecha">Generado: {{ now()->format('d/m/Y H:i') }}</p>

    <div class="info-grid">
        <div class="info-item"><label>Inversionista</label><span>{{ $investment->investor->name ?? '' }}</span></div>
        <div class="info-item"><label>Monto</label><span class="mono">{{ $investment->moneda === 'USD' ? '$' : '₡' }}{{ number_format($investment->monto_capital, 2) }}</span></div>
        <div class="info-item"><label>Tasa Anual</label><span>{{ number_format($investment->tasa_anual * 100, 2) }}%</span></div>
        <div class="info-item"><label>Forma de Pago</label><span>{{ $investment->forma_pago }}</span></div>
    </div>
    <div class="info-grid">
        <div class="info-item"><label>Fecha Inicio</label><span>{{ $investment->fecha_inicio->format('d/m/Y') }}</span></div>
        <div class="info-item"><label>Fecha Vencimiento</label><span>{{ $investment->fecha_vencimiento->format('d/m/Y') }}</span></div>
        <div class="info-item"><label>Plazo</label><span>{{ $investment->plazo_meses }} meses</span></div>
        <div class="info-item"><label>Estado</label><span>{{ $investment->estado }}</span></div>
    </div>

    <h2>Cupones de Intereses</h2>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Fecha Cupón</th>
                <th class="text-right">Interés Bruto</th>
                <th class="text-right">Retención 15%</th>
                <th class="text-right">Interés Neto</th>
                <th>Estado</th>
                <th>Fecha Pago</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($investment->coupons->sortBy('fecha_cupon') as $i => $coupon)
            <tr>
                <td>{{ $i + 1 }}</td>
                <td>{{ $coupon->fecha_cupon->format('d/m/Y') }}</td>
                <td class="text-right mono">{{ number_format($coupon->interes_bruto, 2) }}</td>
                <td class="text-right mono">{{ number_format($coupon->retencion, 2) }}</td>
                <td class="text-right mono">{{ number_format($coupon->interes_neto, 2) }}</td>
                <td><span class="badge badge-{{ strtolower($coupon->estado) }}">{{ $coupon->estado }}</span></td>
                <td>{{ $coupon->fecha_pago?->format('d/m/Y') ?? '-' }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
