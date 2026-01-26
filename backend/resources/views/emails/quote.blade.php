<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cotización de Crédito</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #2563eb;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #f9fafb;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
        }
        .quote-details {
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            border: 1px solid #e5e7eb;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #f3f4f6;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            font-weight: 600;
            color: #6b7280;
        }
        .detail-value {
            font-weight: 700;
            color: #111827;
        }
        .highlight {
            background-color: #dbeafe;
            padding: 15px;
            border-left: 4px solid #2563eb;
            margin: 20px 0;
            border-radius: 3px;
        }
        .footer {
            text-align: center;
            padding: 20px;
            font-size: 12px;
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 style="margin: 0;">Cotización de {{ $creditType }}</h1>
    </div>

    <div class="content">
        <p>Estimado/a <strong>{{ $leadName }}</strong>,</p>

        <p>Nos complace presentarle la siguiente cotización para su solicitud de crédito:</p>

        <div class="quote-details">
            <div class="detail-row">
                <span class="detail-label">Tipo de Crédito:</span>
                <span class="detail-value">{{ $creditType }}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Monto Solicitado:</span>
                <span class="detail-value">₡{{ number_format($amount, 2, ',', '.') }}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Tasa de Interés Anual:</span>
                <span class="detail-value">{{ $rate }}%</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Plazo:</span>
                <span class="detail-value">{{ $term }} meses</span>
            </div>
        </div>

        <div class="highlight">
            <div style="text-align: center;">
                <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Cuota Mensual Estimada</p>
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #2563eb;">
                    ₡{{ number_format($monthlyPayment, 2, ',', '.') }}
                </p>
            </div>
        </div>

        <p><strong>Nota importante:</strong> Esta cotización es una estimación preliminar. Los términos finales estarán sujetos a la aprobación de crédito y evaluación completa de su solicitud.</p>

        <p>Para continuar con su solicitud o si tiene alguna pregunta, no dude en contactarnos.</p>

        <p>Atentamente,<br>
        <strong>Equipo de Créditos</strong></p>
    </div>

    <div class="footer">
        <p>Este es un correo automático generado por el sistema de cotizaciones.<br>
        Por favor no responda directamente a este mensaje.</p>
    </div>
</body>
</html>
