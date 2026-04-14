<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EvolutionServerConfig;
use App\Models\WhatsappContact;
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

        // Cargar aliases del usuario para esta instancia
        $aliases = WhatsappContact::where('evolution_instance_id', $instance->id)
            ->pluck('alias', 'phone_number');

        $conversations = WhatsappMessage::where('evolution_instance_id', $instance->id)
            ->whereRaw('CHAR_LENGTH(phone_number) BETWEEN 8 AND 15') // E.164: mín 8 dígitos, máx 15
            ->where('phone_number', 'not like', '0%')              // excluir JIDs con prefijo 0 (no son E.164 válido)
            ->orderByDesc('wa_timestamp')
            ->get()
            ->groupBy('phone_number')
            ->map(function ($messages, $phone) use ($aliases) {
                $last = $messages->first();

                // Prioridad: alias guardado > contact_name > búsqueda en personas
                if ($aliases->has($phone)) {
                    $name = $aliases[$phone];
                } else {
                    $name = $last->contact_name ?: '';
                    if (!$name) {
                        $person = \App\Models\Person::where('phone', 'like', "%{$phone}%")
                            ->orWhere('whatsapp', 'like', "%{$phone}%")
                            ->first();
                        if ($person) {
                            $name = trim(($person->name ?? '') . ' ' . ($person->apellido1 ?? '') . ' ' . ($person->apellido2 ?? ''));
                        }
                    }
                }

                // (string) forzado: PHP castea claves numéricas de groupBy a int,
                // lo que haría que el JSON no envíe comillas y Laravel rechazaría el campo.
                $phoneStr = (string) $phone;

                return [
                    'phone_number' => $phoneStr,
                    'contact_name' => $name ?: $phoneStr,
                    'alias'        => $aliases[$phone] ?? null,
                    'last_message' => $last->body,
                    'last_at'      => $last->wa_timestamp,
                    'unread'       => 0,
                ];
            })
            ->sortByDesc('last_at')
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
                $pushName  = $msg['pushName'] ?? '';
                $ts        = isset($msg['messageTimestamp'])
                    ? \Carbon\Carbon::createFromTimestamp($msg['messageTimestamp'])
                    : now();

                // Upsert silencioso en BD local (respaldo)
                if ($waId) {
                    $upsertData = [
                        'evolution_instance_id' => $instance->id,
                        'user_id'               => $direction === 'out' ? auth()->id() : null,
                        'phone_number'          => $phone,
                        'body'                  => $body,
                        'direction'             => $direction,
                        'wa_timestamp'          => $ts,
                    ];
                    // Guardar nombre solo si Evolution lo provee
                    if ($pushName) {
                        $upsertData['contact_name'] = $pushName;
                    }
                    WhatsappMessage::updateOrCreate(['wa_message_id' => $waId], $upsertData);
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
     * POST /api/whatsapp/sync-chats
     * Consulta Evolution API para obtener todos los chats existentes y hace
     * un upsert de un registro seed por cada conversación nueva en la BD local.
     * Esto permite que la lista de conversaciones muestre todos los chats
     * aunque el usuario nunca haya interactuado desde esta plataforma.
     */
    public function syncChats(Request $request): JsonResponse
    {
        $instance = $this->getInstance($request);
        if (!$instance) {
            return response()->json(['message' => 'Sin instancia asignada'], 403);
        }

        try {
            $response = Http::withHeaders(['apikey' => $instance->api_key])
                ->timeout(20)
                ->post($this->getBaseUrl() . '/chat/findChats/' . $instance->instance_name, []);

            if (!$response->successful()) {
                return response()->json(['message' => "Evolution API: HTTP {$response->status()}"], 422);
            }

            $chats = $response->json();
            // La respuesta puede ser un array directo o venir bajo una clave
            if (!is_array($chats)) {
                $chats = [];
            }

            $synced = 0;
            foreach ($chats as $chat) {
                $remoteJid = $chat['id'] ?? null;
                if (!$remoteJid) continue;

                // Ignorar grupos, broadcasts, newsletters y cualquier JID no personal
                if (str_contains($remoteJid, '@g.us')
                    || str_contains($remoteJid, '@broadcast')
                    || str_contains($remoteJid, '@newsletter')
                    || str_contains($remoteJid, '@lid')
                ) {
                    continue;
                }

                $phone = preg_replace('/[^0-9]/', '', explode('@', $remoteJid)[0]);

                // Solo teléfonos E.164 válidos: 8-15 dígitos, sin prefijo 0
                if (!$phone || strlen($phone) < 8 || strlen($phone) > 15 || $phone[0] === '0') continue;

                // Solo crear si no existe ningún mensaje de este número para esta instancia
                $exists = WhatsappMessage::where('evolution_instance_id', $instance->id)
                    ->where('phone_number', $phone)
                    ->exists();

                if (!$exists) {
                    $contactName = $chat['name'] ?? '';
                    $lastTs      = isset($chat['lastMsgTimestamp'])
                        ? \Carbon\Carbon::createFromTimestamp($chat['lastMsgTimestamp'])
                        : now();

                    WhatsappMessage::create([
                        'evolution_instance_id' => $instance->id,
                        'user_id'               => null,
                        'phone_number'          => $phone,
                        'contact_name'          => $contactName,
                        'body'                  => '',
                        'direction'             => 'in',
                        'wa_message_id'         => null,
                        'wa_timestamp'          => $lastTs,
                    ]);
                    $synced++;
                }
            }

            return response()->json(['synced' => $synced]);

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

    /**
     * POST /api/whatsapp/contacts
     * Crea o actualiza el alias de un número de teléfono.
     */
    public function upsertAlias(Request $request): JsonResponse
    {
        $instance = $this->getInstance($request);
        if (!$instance) {
            return response()->json(['message' => 'Sin instancia asignada'], 403);
        }

        // Convertir phone a string explícitamente antes de validar
        // (puede llegar como número entero desde el JSON frontend)
        $request->merge(['phone' => (string) $request->input('phone', '')]);

        $validated = $request->validate([
            'phone' => 'required|string|max:20',
            'alias' => 'required|string|max:120',
        ]);

        $phone = preg_replace('/\D/', '', $validated['phone']);

        $contact = WhatsappContact::updateOrCreate(
            ['evolution_instance_id' => $instance->id, 'phone_number' => $phone],
            ['alias' => trim($validated['alias'])],
        );

        return response()->json([
            'phone_number' => $contact->phone_number,
            'alias'        => $contact->alias,
        ], 200);
    }

    /**
     * DELETE /api/whatsapp/contacts/{phone}
     * Elimina el alias de un número de teléfono.
     */
    public function deleteAlias(Request $request, string $phone): JsonResponse
    {
        $instance = $this->getInstance($request);
        if (!$instance) {
            return response()->json(['message' => 'Sin instancia asignada'], 403);
        }

        $phone = preg_replace('/\D/', '', (string) $phone);

        WhatsappContact::where('evolution_instance_id', $instance->id)
            ->where('phone_number', $phone)
            ->delete();

        return response()->json(['message' => 'Alias eliminado']);
    }
}
