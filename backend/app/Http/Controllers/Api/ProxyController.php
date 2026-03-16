<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ProxyController extends Controller
{
    /**
     * Proxy para verificar números de WhatsApp via Evolution API.
     * POST /api/proxy/whatsapp-check
     */
    public function whatsappCheck(Request $request)
    {
        $request->validate([
            'numbers' => 'required|array|min:1|max:10',
            'numbers.*' => 'string|regex:/^\d{7,15}$/',
        ]);

        $url = config('services.evolution.url');
        $key = config('services.evolution.key');
        $instance = config('services.evolution.instance');

        if (empty($url) || empty($key) || empty($instance)) {
            return response()->json(['message' => 'Evolution API no configurada.'], 503);
        }

        try {
            $response = Http::withHeaders([
                'Content-Type' => 'application/json',
                'apikey' => $key,
            ])->post("{$url}/chat/whatsappNumbers/" . rawurlencode($instance), [
                'numbers' => $request->numbers,
            ]);

            return response()->json($response->json(), $response->status());
        } catch (\Exception $e) {
            Log::warning('Error en proxy WhatsApp check', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Error al verificar WhatsApp.'], 502);
        }
    }

    /**
     * Proxy para buscar GIFs en Tenor API.
     * GET /api/proxy/tenor/search?q=keyword&limit=20
     */
    public function tenorSearch(Request $request)
    {
        $request->validate([
            'q' => 'required|string|max:100',
            'limit' => 'integer|min:1|max:50',
            'pos' => 'nullable|string',
            'locale' => 'nullable|string|max:10',
        ]);

        $key = config('services.tenor.key');

        if (empty($key)) {
            return response()->json(['message' => 'Tenor API no configurada.'], 503);
        }

        try {
            $response = Http::get('https://tenor.googleapis.com/v2/search', [
                'key' => $key,
                'q' => $request->q,
                'limit' => $request->input('limit', 20),
                'pos' => $request->pos,
                'locale' => $request->input('locale', 'es'),
                'client_key' => 'cr_studio',
            ]);

            return response()->json($response->json(), $response->status());
        } catch (\Exception $e) {
            Log::warning('Error en proxy Tenor search', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Error al buscar GIFs.'], 502);
        }
    }
}
