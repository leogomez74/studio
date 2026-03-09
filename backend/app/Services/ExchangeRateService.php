<?php

namespace App\Services;

use App\Models\ExchangeRate;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExchangeRateService
{
    /**
     * API pública del Ministerio de Hacienda de Costa Rica.
     * Retorna tipo de cambio del dólar (compra/venta) del BCCR.
     */
    private const HACIENDA_URL = 'https://api.hacienda.go.cr/indicadores/tc';

    public function fetchAndStore(?string $date = null): ?ExchangeRate
    {
        $fecha = $date ? Carbon::parse($date) : Carbon::today();

        // Si ya existe para esta fecha, retornar el existente
        $existing = ExchangeRate::forDate($fecha->toDateString());
        if ($existing) {
            return $existing;
        }

        try {
            $response = Http::timeout(15)->get(self::HACIENDA_URL);

            if (!$response->successful()) {
                Log::warning('ExchangeRate: HTTP error from Hacienda API', [
                    'status' => $response->status(),
                ]);
                return null;
            }

            $data = $response->json();
            $compra = $data['dolar']['compra']['valor'] ?? null;
            $venta = $data['dolar']['venta']['valor'] ?? null;
            $fechaApi = $data['dolar']['venta']['fecha'] ?? $fecha->toDateString();

            if ($compra && $venta) {
                return ExchangeRate::updateOrCreate(
                    ['fecha' => $fechaApi],
                    [
                        'compra' => $compra,
                        'venta' => $venta,
                        'fuente' => 'BCCR',
                    ]
                );
            }

            Log::warning('ExchangeRate: Datos incompletos de Hacienda API', [
                'response' => $data,
            ]);

            return null;
        } catch (\Exception $e) {
            Log::error('ExchangeRate: Error al obtener tipo de cambio', [
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
