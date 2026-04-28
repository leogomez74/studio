<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EvolutionInstance;
use App\Models\WhatsappMessage;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EvolutionWebhookController extends Controller
{
    /**
     * POST /api/webhooks/evolution
     *
     * Recibe eventos push de Evolution API cuando llega un mensaje.
     * Evolution llama a este endpoint con el evento MESSAGES_UPSERT.
     *
     * Payload esperado:
     * {
     *   "event": "messages.upsert",
     *   "instance": "nombre-instancia",
     *   "data": { "key": {...}, "message": {...}, "messageTimestamp": 123, "pushName": "..." }
     * }
     */
    public function handle(Request $request): JsonResponse
    {
        $payload  = $request->all();
        $event    = $payload['event'] ?? null;
        $instName = $payload['instance'] ?? null;

        if ($event !== 'messages.upsert' || !$instName) {
            return response()->json(['status' => 'ignored']);
        }

        $instance = EvolutionInstance::where('instance_name', $instName)->first();
        if (!$instance) {
            return response()->json(['status' => 'no_instance']);
        }

        // Evolution puede enviar un objeto o un array de mensajes
        $data = $payload['data'] ?? [];
        $msgs = isset($data[0]) ? $data : [$data];

        foreach ($msgs as $msg) {
            $this->processMessage($msg, $instance);
        }

        return response()->json(['status' => 'ok']);
    }

    private function processMessage(array $msg, EvolutionInstance $instance): void
    {
        $key       = $msg['key'] ?? [];
        $waId      = $key['id'] ?? null;
        $remoteJid = $key['remoteJid'] ?? '';
        $fromMe    = $key['fromMe'] ?? false;

        // Ignorar grupos, broadcasts, etc.
        if (str_contains($remoteJid, '@g.us')
            || str_contains($remoteJid, '@broadcast')
            || str_contains($remoteJid, '@newsletter')
            || str_contains($remoteJid, '@lid')
        ) {
            return;
        }

        $phone = preg_replace('/[^0-9]/', '', explode('@', $remoteJid)[0]);

        // Validar E.164: 8-15 dígitos, sin prefijo 0
        if (!$phone || strlen($phone) < 8 || strlen($phone) > 15 || $phone[0] === '0') {
            return;
        }

        $msgContent  = $msg['message'] ?? [];
        $direction   = $fromMe ? 'out' : 'in';
        $rawPush     = $msg['pushName'] ?? '';
        $selfNames   = ['você', 'voce', 'usted', 'you', 'tú', 'tu'];
        $pushName    = ($rawPush && !in_array(mb_strtolower(trim($rawPush)), $selfNames, true))
            ? $rawPush : '';

        $ts = isset($msg['messageTimestamp'])
            ? Carbon::createFromTimestamp($msg['messageTimestamp'])
            : now();

        // Detectar tipo y cuerpo del mensaje
        $messageType = 'text';
        $body        = $msgContent['conversation']
            ?? $msgContent['extendedTextMessage']['text']
            ?? null;

        if (!$body) {
            if (isset($msgContent['audioMessage']) || isset($msgContent['ptvMessage'])) {
                $messageType = 'audio';
                $body        = '🎤 Audio';
            } elseif (isset($msgContent['imageMessage'])) {
                $messageType = 'image';
                $body        = '🖼 Imagen';
            } elseif (isset($msgContent['videoMessage'])) {
                $messageType = 'video';
                $body        = '🎥 Video';
            } elseif (isset($msgContent['documentMessage'])) {
                $messageType = 'document';
                $body        = '📄 ' . ($msgContent['documentMessage']['fileName'] ?? 'Documento');
            } elseif (isset($msgContent['stickerMessage'])) {
                $messageType = 'sticker';
                $body        = '🎨 Sticker';
            } else {
                $body = '[media]';
            }
        }

        if (!$waId) return;

        $upsertData = [
            'evolution_instance_id' => $instance->id,
            'user_id'               => null,
            'phone_number'          => $phone,
            'body'                  => $body,
            'message_type'          => $messageType,
            'direction'             => $direction,
            'wa_timestamp'          => $ts,
        ];

        if ($pushName) {
            $upsertData['contact_name'] = $pushName;
        }

        WhatsappMessage::updateOrCreate(['wa_message_id' => $waId], $upsertData);
    }
}
