<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EvolutionServerConfig;
use App\Models\WhatsappMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class WhatsappController extends Controller
{
    private function getInstance(Request $request)
    {
        $user = $request->user()->load('evolutionInstance');
        return $user->evolutionInstance ?? null;
    }

    private function getBaseUrl(): string
    {
        return rtrim(EvolutionServerConfig::instance()->base_url, '/');
    }

    /**
     * GET /api/whatsapp/conversations
     * Lista conversaciones desde la BD local (mensajes enviados/vistos),
     * agrupadas por phone_number, ordenadas por el mensaje más reciente.
     */
    public function conversations(Request $request): JsonResponse
    {
        $instance = $this->getInstance($request);
        if (!$instance) {
            return response()->json(['message' => 'Sin instancia asignada'], 403);
        }

        $conversations = WhatsappMessage::where('evolution_instance_id', $instance->id)
            ->orderByDesc('wa_timestamp')
            ->get()
            ->groupBy('phone_number')
            ->map(function ($messages, $phone) {
                $last = $messages->first();
                return [
                    'phone_number' => $phone,
                    'contact_name' => $last->contact_name ?: $phone,
                    'last_message' => $last->body,
                    'last_at'      => $last->wa_timestamp,
                    'unread'       => 0,
                ];
            })
            ->values();

        return response()->json($conversations);
    }

    /**
     * GET /api/whatsapp/messages?phone=506XXXXXXX&limit=20&offset=0
     * Consulta Evolution API con paginación. Hace upsert en BD como respaldo.
     */
    public function messages(Request $request): JsonResponse
    {
        $instance = $this->getInstance($request);
        if (!$instance) {
            return response()->json(['message' => 'Sin instancia asignada'], 403);
        }

        $request->validate(['phone' => 'required|string']);

        $limit  = (int) ($request->query('limit', 20));
        $offset = (int) ($request->query('offset', 0));
        $phone  = preg_replace('/\D/', '', $request->phone);
        $jid    = $phone . '@s.whatsapp.net';

        try {
            $response = Http::withHeaders(['apikey' => $instance->api_key])
                ->timeout(15)
                ->post($this->getBaseUrl() . '/chat/findMessages/' . $instance->instance_name, [
                    'where'  => ['key' => ['remoteJid' => $jid]],
                    'limit'  => $limit,
                    'offset' => $offset,
                ]);

            if (!$response->successful()) {
                return response()->json(['message' => "Evolution API: HTTP {$response->status()}"], 422);
            }

            $raw     = $response->json();
            $records = $raw['messages']['records'] ?? $raw['records'] ?? (is_array($raw) ? $raw : []);
            $total   = $raw['messages']['total']   ?? $raw['total']   ?? count($records);

            $messages = collect($records)->map(function ($msg) use ($phone, $instance) {
                $body      = $msg['message']['conversation']
                    ?? $msg['message']['extendedTextMessage']['text']
                    ?? '[media]';
                $direction = ($msg['key']['fromMe'] ?? false) ? 'out' : 'in';
                $waId      = $msg['key']['id'] ?? null;
                $ts        = isset($msg['messageTimestamp'])
                    ? \Carbon\Carbon::createFromTimestamp($msg['messageTimestamp'])
                    : now();

                // Upsert silencioso en BD local (respaldo)
                if ($waId) {
                    WhatsappMessage::updateOrCreate(
                        ['wa_message_id' => $waId],
                        [
                            'evolution_instance_id' => $instance->id,
                            'user_id'               => $direction === 'out' ? auth()->id() : null,
                            'phone_number'          => $phone,
                            'body'                  => $body,
                            'direction'             => $direction,
                            'wa_timestamp'          => $ts,
                        ]
                    );
                }

                return [
                    'wa_message_id' => $waId,
                    'body'          => $body,
                    'direction'     => $direction,
                    'wa_timestamp'  => $ts,
                ];
            })->sortBy('wa_timestamp')->values();

            return response()->json([
                'messages' => $messages,
                'total'    => $total,
                'has_more' => ($offset + $limit) < $total,
            ]);

        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * POST /api/whatsapp/send
     * Envía un mensaje via Evolution API y lo guarda en BD.
     */
    public function send(Request $request): JsonResponse
    {
        $instance = $this->getInstance($request);
        if (!$instance) {
            return response()->json(['message' => 'No tienes una instancia de WhatsApp asignada.'], 403);
        }

        $validated = $request->validate([
            'phone'        => 'required|string|max:20',
            'body'         => 'required|string|max:4096',
            'contact_name' => 'nullable|string|max:200',
        ]);

        $serverConfig = EvolutionServerConfig::instance();
        if (empty($serverConfig->base_url)) {
            return response()->json(['message' => 'URL del servidor Evolution no configurada.'], 422);
        }

        $phone = preg_replace('/\D/', '', $validated['phone']);

        try {
            $response = Http::withHeaders(['apikey' => $instance->api_key])
                ->timeout(15)
                ->post($this->getBaseUrl() . '/message/sendText/' . $instance->instance_name, [
                    'number' => $phone,
                    'text'   => $validated['body'],
                    'delay'  => 1200,
                ]);

            if (!$response->successful()) {
                return response()->json(['message' => "Error Evolution API: HTTP {$response->status()}"], 422);
            }

            $waData = $response->json();
            $waId   = $waData['key']['id'] ?? null;

            // Resolver nombre de contacto desde leads/clientes
            $contactName = $validated['contact_name'] ?? '';
            if (!$contactName) {
                $person = \App\Models\Person::where('phone', 'like', "%{$phone}%")
                    ->first();
                $contactName = $person ? trim(($person->name ?? '') . ' ' . ($person->apellido1 ?? '') . ' ' . ($person->apellido2 ?? '')) : '';
            }

        } catch (\Exception $e) {
            return response()->json(['message' => 'No se pudo conectar con Evolution API: ' . $e->getMessage()], 422);
        }

        $message = WhatsappMessage::create([
            'evolution_instance_id' => $instance->id,
            'user_id'               => $request->user()->id,
            'phone_number'          => $phone,
            'contact_name'          => $contactName,
            'body'                  => $validated['body'],
            'direction'             => 'out',
            'wa_message_id'         => $waId,
            'wa_timestamp'          => now(),
        ]);

        return response()->json([
            'wa_message_id' => $message->wa_message_id,
            'body'          => $message->body,
            'direction'     => 'out',
            'wa_timestamp'  => $message->wa_timestamp,
        ], 201);
    }
}
