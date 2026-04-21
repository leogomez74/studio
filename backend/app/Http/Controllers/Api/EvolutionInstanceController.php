<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EvolutionInstance;
use App\Models\EvolutionServerConfig;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class EvolutionInstanceController extends Controller
{
    use LogsActivity;

    /** GET /api/evolution-instances */
    public function index(): JsonResponse
    {
        $instances = EvolutionInstance::orderBy('instance_name')->get();
        return response()->json($instances->map(fn($i) => array_merge(
            $i->toArray(),
            ['has_api_key' => !empty($i->api_key)]
        )));
    }

    /**
     * POST /api/evolution-instances
     * Recibe api_key, llama a Evolution API para obtener info de la instancia,
     * y guarda el registro completo.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'api_key' => 'required|string|max:500',
            'alias'   => 'nullable|string|max:100',
        ]);

        $serverConfig = EvolutionServerConfig::instance();
        if (empty($serverConfig->base_url)) {
            return response()->json(['message' => 'Primero configura la URL del servidor Evolution API.'], 422);
        }

        try {
            $response = Http::withHeaders(['apikey' => $validated['api_key']])
                ->timeout(10)
                ->get(rtrim($serverConfig->base_url, '/') . '/instance/fetchInstances');

            if (!$response->successful()) {
                return response()->json([
                    'message' => "Error al conectar con Evolution API: HTTP {$response->status()}",
                ], 422);
            }

            $data = $response->json();
            // La respuesta es un array de instancias. Tomamos la primera.
            $instanceData = is_array($data) && isset($data[0]) ? $data[0] : null;

            if (!$instanceData) {
                return response()->json([
                    'message' => 'No se encontró ninguna instancia asociada a este API Key.',
                ], 422);
            }

            $instanceName = $instanceData['instance']['instanceName']
                ?? $instanceData['name']
                ?? $instanceData['instanceName']
                ?? '';

            $ownerJid    = $instanceData['instance']['owner']
                ?? $instanceData['ownerJid']
                ?? $instanceData['owner']
                ?? '';
            $phoneNumber = $ownerJid ? preg_replace('/@.*/', '', $ownerJid) : '';
            $profileName = $instanceData['instance']['profileName']
                ?? $instanceData['profileName']
                ?? '';
            $status      = $instanceData['instance']['connectionStatus']
                ?? $instanceData['connectionStatus']
                ?? 'unknown';

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'No se pudo conectar al servidor Evolution API: ' . $e->getMessage(),
            ], 422);
        }

        $instance = EvolutionInstance::create([
            'api_key'       => $validated['api_key'],
            'alias'         => $validated['alias'] ?? '',
            'instance_name' => $instanceName,
            'phone_number'  => $phoneNumber,
            'profile_name'  => $profileName,
            'status'        => $status,
            'is_active'     => true,
        ]);

        $this->logActivity('create', 'EvolutionInstance', $instance,
            "Instancia conectada: {$instanceName}", [], $request);

        return response()->json(array_merge($instance->toArray(), ['has_api_key' => true]), 201);
    }

    /** PATCH /api/evolution-instances/{evolutionInstance}/alias */
    public function updateAlias(Request $request, EvolutionInstance $evolutionInstance): JsonResponse
    {
        $validated = $request->validate([
            'alias' => 'required|string|max:100',
        ]);

        $evolutionInstance->update(['alias' => $validated['alias']]);

        return response()->json(array_merge($evolutionInstance->fresh()->toArray(), ['has_api_key' => true]));
    }

    /**
     * PATCH /api/evolution-instances/{evolutionInstance}/chatwoot
     * Vincula o desvincula esta instancia con un inbox de Chatwoot.
     * Cuando está vinculada, los mensajes entrantes llegan vía webhook de Chatwoot
     * en lugar del webhook directo de Evolution API.
     */
    public function updateChatwoot(Request $request, EvolutionInstance $evolutionInstance): JsonResponse
    {
        $validated = $request->validate([
            // null = desvincular; número = inbox_id de Chatwoot
            'chatwoot_inbox_id' => 'nullable|integer|min:1',
        ]);

        $evolutionInstance->update(['chatwoot_inbox_id' => $validated['chatwoot_inbox_id']]);

        return response()->json(array_merge($evolutionInstance->fresh()->toArray(), ['has_api_key' => true]));
    }

    /** DELETE /api/evolution-instances/{evolutionInstance} */
    public function destroy(Request $request, EvolutionInstance $evolutionInstance): JsonResponse
    {
        $this->logActivity('delete', 'EvolutionInstance', $evolutionInstance,
            "Instancia eliminada: {$evolutionInstance->instance_name}", [], $request);
        $evolutionInstance->delete();

        return response()->json(['message' => 'Instancia desconectada correctamente']);
    }

    /**
     * POST /api/evolution-instances/{evolutionInstance}/reconnect
     * Re-consulta Evolution API para actualizar el estado de la instancia.
     */
    public function reconnect(Request $request, EvolutionInstance $evolutionInstance): JsonResponse
    {
        $serverConfig = EvolutionServerConfig::instance();
        if (empty($serverConfig->base_url)) {
            return response()->json(['message' => 'URL del servidor no configurada.'], 422);
        }

        try {
            $response = Http::withHeaders(['apikey' => $evolutionInstance->api_key])
                ->timeout(10)
                ->get(rtrim($serverConfig->base_url, '/') . '/instance/fetchInstances');

            if (!$response->successful()) {
                $evolutionInstance->update(['status' => 'unknown']);
                return response()->json(['message' => "HTTP {$response->status()}", 'status' => 'unknown'], 422);
            }

            $data         = $response->json();
            $instanceData = is_array($data) && isset($data[0]) ? $data[0] : null;

            if ($instanceData) {
                $status      = $instanceData['instance']['connectionStatus']
                    ?? $instanceData['connectionStatus']
                    ?? 'unknown';
                $ownerJid    = $instanceData['instance']['owner']
                    ?? $instanceData['ownerJid']
                    ?? $evolutionInstance->phone_number;
                $phoneNumber = preg_replace('/@.*/', '', $ownerJid);
                $profileName = $instanceData['instance']['profileName']
                    ?? $instanceData['profileName']
                    ?? $evolutionInstance->profile_name;

                $evolutionInstance->update([
                    'status'       => $status,
                    'phone_number' => $phoneNumber,
                    'profile_name' => $profileName,
                ]);
            }

            return response()->json(array_merge(
                $evolutionInstance->fresh()->toArray(),
                ['has_api_key' => true]
            ));

        } catch (\Exception $e) {
            $evolutionInstance->update(['status' => 'unknown']);
            return response()->json(['message' => $e->getMessage(), 'status' => 'unknown'], 422);
        }
    }
}
