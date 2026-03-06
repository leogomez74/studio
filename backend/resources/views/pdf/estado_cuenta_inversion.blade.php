<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $lang === 'en' ? 'Account Statement' : 'Estado de Cuenta' }} — {{ $investment->numero_desembolso }}</title>
    <style>
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 10px; margin: 30px 40px; }
        .header { display: table; width: 100%; margin-bottom: 10px; }
        .header-left { display: table-cell; vertical-align: top; width: 65%; }
        .header-right { display: table-cell; vertical-align: top; width: 35%; text-align: right; }
        .bill-to { font-size: 9px; font-weight: bold; color: #333; margin-bottom: 2px; }
        .investor-name { font-size: 18px; font-weight: bold; color: #1a1a1a; margin: 0; }
        .investor-country { font-size: 10px; color: #666; margin-top: 2px; }
        .period-info { font-size: 10px; margin-bottom: 3px; }
        .period-label { font-weight: bold; }
        .logo-text { font-size: 22px; font-weight: bold; color: #1a5276; letter-spacing: 1px; }

        h1 { font-size: 20px; text-align: center; margin: 15px 0 10px; color: #1a1a1a; }

        .summary { margin-bottom: 15px; }
        .summary-row { display: table; width: 100%; margin-bottom: 3px; }
        .summary-label { display: table-cell; width: 15%; font-weight: bold; font-size: 10px; }
        .summary-date { display: table-cell; width: 20%; font-size: 10px; }
        .summary-detail { display: table-cell; width: 65%; font-size: 10px; }
        .current-interest { font-weight: bold; font-size: 11px; margin-top: 5px; }

        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th {
            background: #e2e8f0;
            padding: 6px 8px;
            text-align: left;
            border: 1px solid #cbd5e1;
            font-size: 9px;
            font-weight: bold;
            text-transform: uppercase;
        }
        td {
            padding: 5px 8px;
            border: 1px solid #cbd5e1;
            font-size: 9px;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .mono { font-family: 'DejaVu Sans Mono', monospace; }
        .total-row td { font-weight: bold; background: #f8fafc; }
        .fecha { font-size: 9px; text-align: right; color: #999; margin-top: 5px; }
        .footer { margin-top: 20px; font-size: 8px; color: #999; text-align: center; }
    </style>
</head>
<body>
    @php
        $sym = $investment->moneda === 'USD' ? '$' : "\xE2\x82\xA1";
        $isEn = $lang === 'en';
    @endphp

    {{-- Header --}}
    <div class="header">
        <div class="header-left">
            <div class="bill-to">{{ $isEn ? 'Bill to:' : 'Dirigido a:' }}</div>
            <p class="investor-name">{{ strtoupper($investment->investor->name ?? '') }}</p>
            @if($investment->investor->notas)
                <div class="investor-country">{{ $investment->investor->notas }}</div>
            @endif
        </div>
        <div class="header-right">
            <div class="period-info">
                <span class="period-label">{{ $isEn ? 'Period:' : 'Periodo:' }}</span>
                {{ $periodLabel }}
            </div>
            <div class="period-info">
                <span class="period-label">{{ $isEn ? 'Interest:' : 'Intereses:' }}</span>
                {{ number_format($investment->tasa_anual * 100, 2) }}% {{ $isEn ? 'annual' : 'anual' }}
            </div>
            <div class="period-info">
                <span class="period-label">{{ $isEn ? 'Currency:' : 'Moneda:' }}</span>
                {{ $investment->moneda }}
            </div>
            <div style="margin-top: 8px;">
                <img src="{{ $logoBase64 }}" alt="CREDIPEP" style="height: 60px;">
            </div>
        </div>
    </div>

    <h1>{{ $isEn ? 'ACCOUNT STATEMENT' : 'ESTADO DE CUENTA' }}</h1>

    {{-- Summary --}}
    <div class="summary">
        <div class="summary-row">
            <div class="summary-label">{{ $isEn ? 'From' : 'Desde' }}</div>
            <div class="summary-date">{{ $fechaDesde }}</div>
            <div class="summary-detail">
                {{ $isEn ? 'Initial amount:' : 'Monto inicial:' }}
                {{ $sym }}{{ number_format($investment->monto_capital, 2) }}
            </div>
        </div>
        <div class="summary-row">
            <div class="summary-label">{{ $isEn ? 'To' : 'Hasta' }}</div>
            <div class="summary-date">{{ $fechaHasta }}</div>
            <div class="summary-detail">
                {{ $isEn ? 'Initial monthly interest amount:' : 'Intereses mensuales iniciales:' }}
                {{ $sym }}{{ number_format($investment->interes_mensual, 2) }}
            </div>
        </div>
        <div class="current-interest">
            {{ $isEn ? 'Current monthly Interest:' : 'Intereses mensuales actuales:' }}
            {{ $sym }}{{ number_format($currentMonthlyInterest, 2) }}
        </div>
    </div>

    {{-- Payments Table --}}
    <table>
        <thead>
            <tr>
                <th></th>
                <th class="text-center">{{ $isEn ? 'Days' : 'Dias' }}</th>
                <th class="text-right">{{ $isEn ? 'Interest' : 'Intereses' }}</th>
                <th class="text-right">{{ $isEn ? 'Payment' : 'Pago' }}</th>
                <th class="text-right">{{ $isEn ? 'Interest Payment' : 'Pago Intereses' }}</th>
                <th class="text-right">{{ $isEn ? 'Capital Payment' : 'Pago Capital' }}</th>
                <th class="text-right">{{ $isEn ? 'Balance' : 'Balance' }}</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($rows as $i => $row)
            <tr>
                <td>{{ $row['date'] }}</td>
                <td class="text-center">{{ $row['days'] }}</td>
                <td class="text-right mono">{{ $row['interest'] > 0 ? $sym . ' ' . number_format($row['interest'], 2) : '' }}</td>
                <td class="text-right mono">{{ $row['payment'] > 0 ? $sym . ' ' . number_format($row['payment'], 2) : ($row['payment'] == 0 && $i > 0 ? '0' : '') }}</td>
                <td class="text-right mono">{{ $row['interest_payment'] > 0 ? $sym . ' ' . number_format($row['interest_payment'], 2) : ($row['interest_payment'] == 0 && $i > 0 ? '0' : '') }}</td>
                <td class="text-right mono">{{ $row['capital_payment'] > 0 ? $sym . ' ' . number_format($row['capital_payment'], 2) : ($row['capital_payment'] == 0 && $i > 0 ? '0' : '') }}</td>
                <td class="text-right mono">{{ $sym . ' ' . number_format($row['balance'], 2) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <p class="fecha">{{ $isEn ? 'Generated:' : 'Generado:' }} {{ now()->format('d/m/Y H:i') }}</p>

    <div class="footer">CREDIPEP — {{ $isEn ? 'This document is for informational purposes only.' : 'Este documento es solo para fines informativos.' }}</div>
</body>
</html>
