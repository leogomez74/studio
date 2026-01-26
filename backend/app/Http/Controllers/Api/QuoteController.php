<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\QuoteMail;
use App\Models\ChatMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;

class QuoteController extends Controller
{
    /**
     * Envía una cotización de crédito por email
     */
    public function sendQuote(Request $request)
    {
        // Validar los datos recibidos
        $validator = Validator::make($request->all(), [
            'lead_id' => 'required|string',
            'lead_name' => 'required|string',
            'lead_email' => 'required|email',
            'amount' => 'required|numeric|min:0',
            'rate' => 'required|numeric|min:0',
            'term' => 'required|integer|min:1',
            'monthly_payment' => 'required|numeric|min:0',
            'credit_type' => 'required|string|in:regular,micro',
            'method' => 'required|string|in:email,comunicaciones',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();

        try {
            // Si el método es email, enviar el correo
            if ($data['method'] === 'email') {
                Mail::to($data['lead_email'])->send(new QuoteMail([
                    'lead_name' => $data['lead_name'],
                    'amount' => $data['amount'],
                    'rate' => $data['rate'],
                    'term' => $data['term'],
                    'monthly_payment' => $data['monthly_payment'],
                    'credit_type' => $data['credit_type'],
                ]));

                return response()->json([
                    'success' => true,
                    'message' => 'Cotización enviada exitosamente por correo electrónico.',
                    'data' => [
                        'recipient' => $data['lead_email'],
                        'method' => 'email'
                    ]
                ], 200);
            }

            // Si el método es comunicaciones, crear mensaje en el chat
            if ($data['method'] === 'comunicaciones') {
                // Formatear el mensaje de cotización
                $messageText = sprintf(
                    "📊 Cotización de %s\n\n" .
                    "Monto solicitado: ₡%s\n" .
                    "Tasa de interés: %s%%\n" .
                    "Plazo: %d meses\n\n" .
                    "💰 Cuota Mensual Estimada: ₡%s\n\n" .
                    "Esta cotización es una estimación preliminar. Los términos finales están sujetos a aprobación.",
                    $data['credit_type'] === 'regular' ? 'Crédito Regular' : 'Micro-crédito',
                    number_format($data['amount'], 2, ',', '.'),
                    $data['rate'],
                    $data['term'],
                    number_format($data['monthly_payment'], 2, ',', '.')
                );

                // Crear el mensaje en la base de datos
                $chatMessage = ChatMessage::create([
                    'conversation_id' => $data['lead_id'],
                    'sender_type' => 'system',
                    'sender_name' => 'Sistema de Cotizaciones',
                    'text' => $messageText,
                    'message_type' => 'quote',
                    'metadata' => [
                        'amount' => $data['amount'],
                        'rate' => $data['rate'],
                        'term' => $data['term'],
                        'monthly_payment' => $data['monthly_payment'],
                        'credit_type' => $data['credit_type'],
                    ],
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Cotización enviada exitosamente por sistema de comunicaciones.',
                    'data' => [
                        'recipient' => $data['lead_name'],
                        'method' => 'comunicaciones',
                        'message_id' => $chatMessage->id,
                    ]
                ], 200);
            }

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al enviar la cotización: ' . $e->getMessage()
            ], 500);
        }
    }
}
