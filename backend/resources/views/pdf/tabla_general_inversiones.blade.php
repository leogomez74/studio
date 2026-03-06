<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $titulo ?? 'Resumen de Inversiones' }}</title>
    <style>
        body { font-family: 'Helvetica', sans-serif; font-size: 10px; }
        h1 { text-align: center; font-size: 16px; margin-bottom: 5px; }
        h2 { font-size: 13px; background: #2563eb; color: white; padding: 5px 10px; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th { background: #e2e8f0; padding: 4px 6px; text-align: left; border: 1px solid #cbd5e1; font-size: 9px; }
        td { padding: 4px 6px; border: 1px solid #cbd5e1; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .total-row { background: #f1f5f9; font-weight: bold; }
        .mono { font-family: 'Courier New', monospace; }
        .fecha { font-size: 9px; text-align: right; margin-bottom: 10px; color: #666; }
    </style>
</head>
<body>
    <h1>{{ $titulo ?? 'RESUMEN DE INVERSIONES' }}</h1>
    <p class="fecha">Generado: {{ now()->format('d/m/Y H:i') }}</p>

    @foreach (['dolares' => 'DÓLARES (USD)', 'colones' => 'COLONES (CRC)'] as $key => $label)
    @php $section = $$key; @endphp
    <h2>{{ $label }}</h2>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Inversionista</th>
                <th class="text-right">Monto Capital</th>
                <th class="text-center">Plazo</th>
                <th>Inicio</th>
                <th>Vencimiento</th>
                <th class="text-center">Tasa</th>
                <th class="text-right">Int. Mensual</th>
                <th class="text-right">Retención</th>
                <th class="text-right">Int. Neto</th>
                <th>Forma Pago</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($section['inversiones'] as $inv)
            <tr>
                <td>{{ $inv->numero_desembolso }}</td>
                <td>{{ $inv->investor->name ?? '' }}</td>
                <td class="text-right mono">{{ number_format($inv->monto_capital, 2) }}</td>
                <td class="text-center">{{ $inv->plazo_meses }}m</td>
                <td>{{ $inv->fecha_inicio->format('d/m/Y') }}</td>
                <td>{{ $inv->fecha_vencimiento->format('d/m/Y') }}</td>
                <td class="text-center">{{ number_format($inv->tasa_anual * 100, 2) }}%</td>
                <td class="text-right mono">{{ number_format($inv->interes_mensual, 2) }}</td>
                <td class="text-right mono">{{ number_format($inv->retencion_mensual, 2) }}</td>
                <td class="text-right mono">{{ number_format($inv->interes_neto_mensual, 2) }}</td>
                <td>{{ $inv->forma_pago }}</td>
            </tr>
            @empty
            <tr><td colspan="11" style="text-align:center">Sin inversiones</td></tr>
            @endforelse
            <tr class="total-row">
                <td colspan="2">TOTALES</td>
                <td class="text-right mono">{{ number_format($section['total_capital'], 2) }}</td>
                <td colspan="4"></td>
                <td class="text-right mono">{{ number_format($section['total_interes_mensual'], 2) }}</td>
                <td class="text-right mono">{{ number_format($section['total_retencion'], 2) }}</td>
                <td class="text-right mono">{{ number_format($section['total_neto'], 2) }}</td>
                <td></td>
            </tr>
        </tbody>
    </table>
    @endforeach
</body>
</html>
