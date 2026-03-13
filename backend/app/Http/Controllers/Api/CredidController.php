<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CredidService;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CredidController extends Controller
{
    use LogsActivity;

    private CredidService $credidService;

    public function __construct(CredidService $credidService)
    {
        $this->credidService = $credidService;
    }

    /**
     * Verificar configuración de Credid (solo admins).
     * GET /api/credid/status
     *
     * No expone valores de configuración, solo estado booleano.
     */
    public function status(Request $request): JsonResponse
    {
        $result = $this->credidService->verificarConfiguracion();

        $this->logActivity('view', 'Credid', null, 'credid/status', [], $request);

        return response()->json($result);
    }

    /**
     * Consultar reporte Credid por cédula y retornar datos procesados para análisis.
     * GET /api/credid/reporte?cedula=123456789
     */
    public function reporte(Request $request): JsonResponse
    {
        $request->validate([
            'cedula' => ['required', 'string', 'regex:/^\d{9,12}$/'],
        ], [
            'cedula.regex' => 'La cédula debe contener entre 9 y 12 dígitos numéricos.',
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

        $this->logActivity('view', 'Credid', null, 'credid/reporte', [], $request);

        return response()->json([
            'success' => true,
            'tipo' => $reporte['Tipo'] ?? 'Desconocido',
            'consulta_id' => $reporte['ConsultaId'] ?? null,
            'datos_analisis' => $datosAnalisis,
        ]);
    }
}
