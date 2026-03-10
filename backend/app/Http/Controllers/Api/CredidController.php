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
