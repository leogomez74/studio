<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EvolutionInstance;
use App\Models\WhatsappMessage;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ChatwootWebhookController extends Controller
{
    /**
     * POST /api/webhooks/chatwoot
     *
     * Recibe eventos de Chatwoot cuando una instancia de Evolution API está sincronizada.
     * En ese caso, Evolution cede el control del webhook a Chatwoot, por lo que los
     * mensajes entrantes/salientes deben procesarse desde aquí.
     *
     * Eventos manejados: message_created
     * Tipos de mensaje:  0 = incoming (del contacto), 1 = outgoing (del agente)
     */
    public function handle(Request $request): JsonResponse
    {
        $payload = $request->all();
        $event   = $payload['event'] ?? null;

        // Solo procesar mensajes nuevos
        if ($event !== 'message_created') {
            return response()->json(['status' => 'ignored']);
        }

        // Ignorar mensajes de actividad (type=2) o plantillas (type=3)
        $messageType = $payload['message_type'] ?? null;
        if (!in_array($messageType, [0, 1], true)) {
            return response()->json(['status' => 'ignored']);
        }

        $inboxId = $payload['conversation']['inbox_id'] ?? null;
        if (!$inboxId) {
            return response()->json(['status' => 'ignored']);
        }

        // Buscar la instancia Evolution vinculada a este inbox de Chatwoot
        $instance = EvolutionInstance::where('chatwoot_inbox_id', $inboxId)->first();
        if (!$instance) {
            Log::debug("ChatwootWebhook: inbox_id={$inboxId} no está vinculado a ninguna instancia Evolution.");
            return response()->json(['status' => 'no_instance']);
        }

        // Extraer número de teléfono del contacto
        $phone = $this->extractPhone($payload);
        if (!$phone) {
            return response()->json(['status' => 'no_phone']);
        }

        $body      = $payload['content'] ?? '';
        $direction = $messageType === 0 ? 'in' : 'out';
        $sourceId  = $payload['id'] ?? null;  // ID del mensaje en Chatwoot
        $waId      = $payload['source_id'] ?? ("cw-{$sourceId}"); // ID de Evolution si está disponible
        $ts        = isset($payload['created_at'])
            ? Carbon::createFromTimestamp($payload['created_at'])
            : now();

        // Nombre del contacto
        $contactName = $payload['conversation']['meta']['sender']['name']
            ?? $payload['sender']['name']
            ?? '';

        // Upsert: evitar duplicados por wa_message_id
        if ($waId) {
            WhatsappMessage::updateOrCreate(
                ['wa_message_id' => $waId],
                [
                    'evolution_instance_id' => $instance->id,
                    'user_id'               => null,
                    'phone_number'          => $phone,
                    'contact_name'          => $contactName,
                    'body'                  => $body,
                    'direction'             => $direction,
                    'wa_timestamp'          => $ts,
                ]
            );
        } else {
            // Sin ID único, insertar solo si el body no está vacío
            if ($body) {
                WhatsappMessage::create([
                    'evolution_instance_id' => $instance->id,
                    'user_id'               => null,
                    'phone_number'          => $phone,
                    'contact_name'          => $contactName,
                    'body'                  => $body,
                    'direction'             => $direction,
                    'wa_message_id'         => null,
                    'wa_timestamp'          => $ts,
                ]);
            }
        }

        return response()->json(['status' => 'ok']);
    }

    /**
     * Extrae el número de teléfono del contacto desde el payload de Chatwoot.
     * Prioriza el número limpio del sender, luego el identifier del JID de WhatsApp.
     */
    private function extractPhone(array $payload): ?string
    {
        // Ruta principal: conversation.meta.sender.phone_number
        $raw = $payload['conversation']['meta']['sender']['phone_number']
            ?? $payload['conversation']['meta']['sender']['identifier']
            ?? $payload['sender']['phone_number']
            ?? null;

        if (!$raw) {
            return null;
        }

        // Si viene como JID de WhatsApp (ej: 50612345678@s.whatsapp.net), extraer la parte numérica
        if (str_contains($raw, '@')) {
            $raw = explode('@', $raw)[0];
        }

        // Limpiar caracteres no numéricos (quitar +, espacios, guiones, etc.)
        $phone = preg_replace('/\D/', '', $raw);

        // Validar E.164: 8-15 dígitos, no empieza con 0
        if (!$phone || strlen($phone) < 8 || strlen($phone) > 15 || $phone[0] === '0') {
            return null;
        }

        return $phone;
    }
}
