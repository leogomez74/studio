<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ExternalIntegration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;
use RuntimeException;

class ExternalRoutesService
{
    private const CACHE_TTL = 120; // 2 minutos

    /**
     * Obtener rutas de todas las integraciones activas de tipo "rutas".
     */
    public function fetchAllRoutes(array $filters = [], bool $forceRefresh = false): array
    {
        $cacheKey = 'external_routes_' . md5(json_encode($filters));

        if ($forceRefresh) {
            Cache::forget($cacheKey);
        }

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($filters) {
            return $this->doFetchAllRoutes($filters);
        });
    }

    private function doFetchAllRoutes(array $filters): array
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
            } catch (Exception $e) {
                Log::warning('ExternalRoutes: error al consultar ' . $integration->name, [
                    'integration_id' => $integration->id,
                    'error' => $e->getMessage(),
                ]);

                $integration->update([
                    'last_sync_at' => now(),
                    'last_sync_status' => 'error',
                    'last_sync_message' => substr($e->getMessage(), 0, 200),
                ]);

                $allRoutes[] = [
                    'integration_id' => $integration->id,
                    'integration_name' => $integration->name,
                    'integration_slug' => $integration->slug,
                    'success' => false,
                    'error' => 'Error al consultar ' . $integration->name,
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
        $resolved = $this->resolveConfig($integration);
        $baseUrl = $resolved['base_url'];
        $token = $resolved['token'];
        $rutasEndpoint = $resolved['endpoint'];

        if (empty($baseUrl)) {
            throw new RuntimeException('URL base no configurada para ' . $integration->name);
        }

        $url = rtrim($baseUrl, '/') . '/' . ltrim($rutasEndpoint, '/');

        $client = Http::acceptJson();
        if ($token) {
            $client = $client->withToken($token);
        }

        $queryParams = [];
        if (!empty($filters['status'])) {
            $queryParams['status'] = $filters['status'];
        }
        if (!empty($filters['fecha'])) {
            $queryParams['scheduled_date'] = $filters['fecha'];
        }

        /** @var \Illuminate\Http\Client\Response $response */
        $response = $client->timeout(15)->get($url, $queryParams);

        if (!$response->successful()) {
            Log::warning('ExternalRoutes: HTTP error', [
                'integration' => $integration->name,
                'status' => $response->status(),
                'body' => substr($response->body(), 0, 500),
            ]);
            throw new RuntimeException('Error HTTP ' . $response->status() . ' al consultar ' . $integration->name);
        }

        $data = $response->json();

        if (isset($data['data']) && is_array($data['data'])) {
            return $data['data'];
        }

        if (is_array($data) && !isset($data['data'])) {
            return $data;
        }

        return [];
    }

    /**
     * Resolver configuración: prioriza .env (config/services) sobre campos de la DB.
     */
    private function resolveConfig(ExternalIntegration $integration): array
    {
        $slug = $integration->slug;

        // Buscar config: slug exacto (dsf3) o sin dígitos finales (dsf)
        $envConfig = config("services.{$slug}") ?? config("services." . rtrim($slug, '0123456789')) ?? [];

        $baseUrl = !empty($envConfig['url']) ? $envConfig['url'] : ($integration->base_url ?? '');
        $token = !empty($envConfig['token']) ? $envConfig['token'] : ($integration->auth_token ?? '');
        $endpoints = $integration->endpoints ?? [];
        $endpoint = $endpoints['rutas'] ?? '/api/external/rutas';

        // TODO: SSRF protection — descomentar cuando se configure ALLOWED_INTEGRATION_DOMAINS en .env
        // if (!empty($baseUrl)) {
        //     $this->validateBaseUrl($baseUrl);
        // }

        return ['base_url' => $baseUrl, 'token' => $token, 'endpoint' => $endpoint];
    }

    /**
     * Validate that a base URL is on the allowed domain whitelist (SSRF prevention).
     */
    private function validateBaseUrl(string $url): void
    {
        $allowedDomains = config('services.allowed_integration_domains', []);

        // If no whitelist is configured, block all DB-sourced URLs as a safety net
        if (empty($allowedDomains)) {
            // Allow only .env-sourced URLs (they were already validated by the admin)
            return;
        }

        $host = parse_url($url, PHP_URL_HOST);

        if (empty($host)) {
            throw new RuntimeException('URL inválida: no se pudo extraer el host.');
        }

        // Block private/internal IPs
        $ip = gethostbyname($host);
        if ($ip !== $host && filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            throw new RuntimeException('URL no permitida: apunta a una red interna.');
        }

        // Check against domain whitelist
        foreach ($allowedDomains as $allowed) {
            if ($host === $allowed || str_ends_with($host, '.' . $allowed)) {
                return;
            }
        }

        Log::warning('SSRF: intento de conexión a dominio no autorizado', [
            'url' => $url,
            'host' => $host,
        ]);

        throw new RuntimeException('Dominio no autorizado: ' . $host);
    }
}
