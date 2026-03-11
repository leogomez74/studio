<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ExternalIntegration;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExternalRoutesService
{
    /**
     * Obtener rutas de todas las integraciones activas de tipo "rutas".
     */
    public function fetchAllRoutes(array $filters = []): array
    {
        $integrations = ExternalIntegration::where('type', 'rutas')
            ->where('is_active', true)
            ->get();

        $allRoutes = [];

        foreach ($integrations as $integration) {
            try {
                $routes = $this->fetchRoutesFromIntegration($integration, $filters);
                $allRoutes[] = [
                    'integration_id' => $integration->id,
                    'integration_name' => $integration->name,
                    'integration_slug' => $integration->slug,
                    'success' => true,
                    'routes' => $routes,
                    'count' => count($routes),
                ];

                $integration->update([
                    'last_sync_at' => now(),
                    'last_sync_status' => 'success',
                    'last_sync_message' => count($routes) . ' rutas obtenidas',
                ]);
            } catch (\Exception $e) {
                Log::warning('ExternalRoutes: error al consultar ' . $integration->name, [
                    'integration_id' => $integration->id,
                    'error' => $e->getMessage(),
                ]);

                $integration->update([
                    'last_sync_at' => now(),
                    'last_sync_status' => 'error',
                    'last_sync_message' => $e->getMessage(),
                ]);

                $allRoutes[] = [
                    'integration_id' => $integration->id,
                    'integration_name' => $integration->name,
                    'integration_slug' => $integration->slug,
                    'success' => false,
                    'error' => $e->getMessage(),
                    'routes' => [],
                    'count' => 0,
                ];
            }
        }

        return $allRoutes;
    }

    /**
     * Obtener rutas de una integración específica.
     */
    public function fetchRoutesFromIntegration(ExternalIntegration $integration, array $filters = []): array
    {
        $client = $this->buildHttpClient($integration);
        $endpoints = $integration->endpoints ?? [];
        $rutasEndpoint = $endpoints['rutas'] ?? '/api/rutas';

        $url = rtrim($integration->base_url, '/') . '/' . ltrim($rutasEndpoint, '/');

        // Pasar filtros como query params
        $queryParams = [];
        if (!empty($filters['status'])) {
            $queryParams['status'] = $filters['status'];
        }
        if (!empty($filters['fecha'])) {
            $queryParams['scheduled_date'] = $filters['fecha'];
        }

        $response = $client->timeout(15)->get($url, $queryParams);

        if (!$response->successful()) {
            throw new \RuntimeException('HTTP ' . $response->status() . ': ' . substr($response->body(), 0, 200));
        }

        $data = $response->json();

        // Manejar formatos de respuesta: { data: [...] } o directamente [...]
        if (isset($data['data']) && is_array($data['data'])) {
            return $data['data'];
        }

        if (is_array($data) && !isset($data['data'])) {
            return $data;
        }

        return [];
    }

    /**
     * Construir cliente HTTP con autenticación configurada.
     */
    private function buildHttpClient(ExternalIntegration $integration)
    {
        $client = Http::acceptJson();

        if (!empty($integration->headers)) {
            $client = $client->withHeaders($integration->headers);
        }

        $token = $integration->getRawOriginal('auth_token');
        $password = $integration->getRawOriginal('auth_password');

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
