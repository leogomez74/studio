<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CredidService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CredidController extends Controller
{
    private CredidService $credidService;

    public function __construct(CredidService $credidService)
    {
        $this->credidService = $credidService;
    }

    /**
     * Verificar configuración y probar consulta de Credid.
     * GET /api/credid/status?cedula=123456789
     */
    public function status(Request $request): JsonResponse
    {
        $url = config('services.credid.url', '');
        $token = config('services.credid.token', '');

        $result = [
            'url_configured' => !empty($url),
            'url_value' => $url,
            'token_configured' => !empty($token),
            'token_length' => strlen($token),
        ];

        // Si se pasa cédula, hacer consulta de diagnóstico
        if ($cedula = $request->input('cedula')) {
            try {
                $response = \Illuminate\Support\Facades\Http::timeout(30)->get($url, [
                    'token' => $token,
                    'cedula' => preg_replace('/[^0-9]/', '', $cedula),
                ]);
                $result['http_status'] = $response->status();
                $result['content_type'] = $response->header('Content-Type');
                $body = $response->body();
                $result['body_length'] = strlen($body);
                $result['body_type'] = gettype($response->json());
                $result['body_preview'] = substr($body, 0, 300);
            } catch (\Exception $e) {
                $result['error'] = $e->getMessage();
            }
        }

        return response()->json($result);
    }

    /**
     * Consultar reporte Credid por cédula y retornar datos procesados para análisis.
     * GET /api/credid/reporte?cedula=123456789
     */
    public function reporte(Request $request): JsonResponse
    {
        $request->validate([
            'cedula' => 'required|string|min:5|max:20',
        ]);

        $cedula = $request->input('cedula');
        $reporte = $this->credidService->consultarReporte($cedula);

        if (!$reporte) {
            return response()->json([
                'success' => false,
                'message' => 'No se pudo obtener el reporte de Credid. Verifique la cédula e intente de nuevo.',
            ], 422);
        }

        $datosAnalisis = $this->credidService->extraerDatosAnalisis($reporte);

        return response()->json([
            'success' => true,
            'tipo' => $reporte['Tipo'] ?? 'Desconocido',
            'consulta_id' => $reporte['ConsultaId'] ?? null,
            'datos_analisis' => $datosAnalisis,
        ]);
    }
}
