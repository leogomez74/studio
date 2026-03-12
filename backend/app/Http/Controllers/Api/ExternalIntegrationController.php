<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExternalIntegration;
use App\Services\ExternalRoutesService;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Exception;

class ExternalIntegrationController extends Controller
{
    use LogsActivity;

    public function index(): JsonResponse
    {
        $integrations = ExternalIntegration::orderBy('name')->get();

        // Agregar campo has_token para indicar si tiene credenciales sin exponerlas
        $integrations->each(function ($integration) {
            $integration->has_token = !empty($integration->auth_token);
            $integration->has_password = !empty($integration->auth_password);
        });

        return response()->json($integrations);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'slug' => 'nullable|string|max:50|unique:external_integrations,slug',
            'type' => 'sometimes|string|in:rutas,general',
            'is_active' => 'boolean',
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        $integration = ExternalIntegration::create($validated);

        $this->logActivity('create', 'Integraciones', $integration, $integration->name, [], $request);

        return response()->json($integration, 201);
    }

    public function show(int $id): JsonResponse
    {
        $integration = ExternalIntegration::findOrFail($id);

        $integration->has_token = !empty($integration->auth_token);
        $integration->has_password = !empty($integration->auth_password);

        return response()->json($integration);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $integration = ExternalIntegration::findOrFail($id);
        $oldData = $integration->toArray();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'slug' => 'sometimes|string|max:50|unique:external_integrations,slug,' . $id,
            'type' => 'sometimes|string|in:rutas,general',
            'is_active' => 'boolean',
        ]);

        // Only update explicitly allowed fields (defense-in-depth)
        $integration->update($request->only(['name', 'slug', 'type', 'is_active']));

        $changes = $this->getChanges($oldData, $integration->fresh()->toArray());
        $this->logActivity('update', 'Integraciones', $integration, $integration->name, $changes, $request);

        return response()->json($integration);
    }

    public function destroy(int $id): JsonResponse
    {
        $integration = ExternalIntegration::findOrFail($id);

        $this->logActivity('delete', 'Integraciones', $integration, $integration->name, [], request());

        $integration->delete();

        return response()->json(['message' => 'Integración eliminada']);
    }

    /**
     * Probar la conexión con una integración externa.
     * POST /api/external-integrations/{id}/test
     */
    public function test(int $id): JsonResponse
    {
        $integration = ExternalIntegration::findOrFail($id);

        // Resolver URL y token desde .env o DB (slug exacto o sin dígitos finales: dsf3 → dsf)
        $slug = $integration->slug;
        $envConfig = config("services.{$slug}") ?? config("services." . rtrim($slug, '0123456789')) ?? [];
        $baseUrl = $envConfig['url'] ?? $integration->base_url ?? '';
        $token = $envConfig['token'] ?? $integration->auth_token ?? '';

        if (empty($baseUrl)) {
            return response()->json(['success' => false, 'message' => 'URL base no configurada (ni en .env ni en DB)'], 422);
        }

        try {
            $httpClient = Http::acceptJson();
            if ($token) {
                $httpClient = $httpClient->withToken($token);
            }

            $endpoints = $integration->endpoints ?? [];
            $testEndpoint = $endpoints['test'] ?? $endpoints['rutas'] ?? '/api/external/rutas';
            $testUrl = rtrim($baseUrl, '/') . '/' . ltrim($testEndpoint, '/');

            /** @var \Illuminate\Http\Client\Response $response */
            $response = $httpClient->timeout(15)->get($testUrl);

            $integration->update([
                'last_sync_at' => now(),
                'last_sync_status' => $response->successful() ? 'success' : 'error',
                'last_sync_message' => $response->successful()
                    ? 'Conexión exitosa (HTTP ' . $response->status() . ')'
                    : 'Error HTTP ' . $response->status(),
            ]);

            return response()->json([
                'success' => $response->successful(),
                'status' => $response->status(),
                'message' => $response->successful()
                    ? 'Conexión exitosa'
                    : 'Error: HTTP ' . $response->status(),
                'body_preview' => substr($response->body(), 0, 500),
            ]);
        } catch (Exception $e) {
            Log::warning('ExternalIntegration test failed', [
                'integration_id' => $id,
                'error' => $e->getMessage(),
            ]);

            $integration->update([
                'last_sync_at' => now(),
                'last_sync_status' => 'error',
                'last_sync_message' => substr($e->getMessage(), 0, 200),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error de conexión con el servicio externo.',
            ], 500);
        }
    }

    /**
     * Obtener rutas de todas las integraciones externas activas.
     * GET /api/external-integrations/routes
     */
    public function routes(Request $request): JsonResponse
    {
        $service = app(ExternalRoutesService::class);

        $filters = $request->only(['status', 'fecha']);
        $forceRefresh = $request->boolean('refresh');
        $results = $service->fetchAllRoutes($filters, $forceRefresh);

        return response()->json($results);
    }

    /**
     * Obtener rutas de una integración específica.
     * GET /api/external-integrations/{id}/routes
     */
    public function integrationRoutes(Request $request, int $id): JsonResponse
    {
        $integration = ExternalIntegration::where('type', 'rutas')
            ->where('is_active', true)
            ->findOrFail($id);

        $service = app(ExternalRoutesService::class);
        $filters = $request->only(['status', 'fecha']);

        try {
            $routes = $service->fetchRoutesFromIntegration($integration, $filters);
            return response()->json([
                'success' => true,
                'integration_name' => $integration->name,
                'routes' => $routes,
                'count' => count($routes),
            ]);
        } catch (Exception $e) {
            Log::warning('ExternalIntegration routes fetch failed', [
                'integration_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al consultar rutas del servicio externo.',
            ], 500);
        }
    }

    /**
     * Construir cliente HTTP con autenticación configurada.
     */
    private function buildHttpClient(ExternalIntegration $integration)
    {
        $client = Http::acceptJson();

        // Headers adicionales
        if (!empty($integration->headers)) {
            $client = $client->withHeaders($integration->headers);
        }

        // Autenticación
        $token = $integration->auth_token;
        $password = $integration->auth_password;

        switch ($integration->auth_type) {
            case 'bearer':
                if ($token) {
                    $client = $client->withToken($token);
                }
                break;
            case 'basic':
                if ($integration->auth_user && $password) {
                    $client = $client->withBasicAuth($integration->auth_user, $password);
                }
                break;
            case 'api_key':
                if ($token) {
                    $client = $client->withHeaders(['X-API-Key' => $token]);
                }
                break;
        }

        return $client;
    }
}
