<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExchangeRate;
use App\Services\ExchangeRateService;
use Illuminate\Http\Request;

class ExchangeRateController extends Controller
{
    public function current()
    {
        $rate = ExchangeRate::latest();

        if (!$rate) {
            return response()->json([
                'compra' => null,
                'venta' => (float) config('services.inversiones.tipo_cambio_usd', 500),
                'fecha' => null,
                'fuente' => 'config',
            ]);
        }

        return response()->json([
            'compra' => (float) $rate->compra,
            'venta' => (float) $rate->venta,
            'fecha' => $rate->fecha->toDateString(),
            'fuente' => $rate->fuente,
            'updated_at' => $rate->updated_at->toDateTimeString(),
        ]);
    }

    public function history(Request $request)
    {
        $days = $request->get('days', 30);
        $rates = ExchangeRate::orderByDesc('fecha')
            ->limit($days)
            ->get(['fecha', 'compra', 'venta', 'fuente']);

        return response()->json($rates);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'fecha' => 'required|date',
            'compra' => 'required|numeric|min:0',
            'venta' => 'required|numeric|min:0',
        ]);

        $rate = ExchangeRate::updateOrCreate(
            ['fecha' => $validated['fecha']],
            [
                'compra' => $validated['compra'],
                'venta' => $validated['venta'],
                'fuente' => 'Manual',
            ]
        );

        return response()->json($rate, 201);
    }

    public function refresh(ExchangeRateService $service)
    {
        $rate = $service->fetchAndStore();

        if (!$rate) {
            return response()->json(['message' => 'No se pudo obtener el tipo de cambio del BCCR.'], 422);
        }

        return response()->json([
            'compra' => (float) $rate->compra,
            'venta' => (float) $rate->venta,
            'fecha' => $rate->fecha->toDateString(),
            'fuente' => $rate->fuente,
            'updated_at' => $rate->updated_at->toDateTimeString(),
        ]);
    }
}
