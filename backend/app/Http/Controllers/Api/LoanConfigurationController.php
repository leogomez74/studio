<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoanConfiguration;
use Illuminate\Http\Request;

class LoanConfigurationController extends Controller
{
    /**
     * Obtener todas las configuraciones de préstamos
     */
    public function index()
    {
        return response()->json(LoanConfiguration::with('tasa')->get());
    }

    /**
     * Obtener solo las configuraciones activas (para formularios públicos)
     */
    public function activas()
    {
        return response()->json(LoanConfiguration::activas());
    }

    /**
     * Obtener configuración por tipo (regular o microcredito)
     */
    public function porTipo(string $tipo)
    {
        $config = LoanConfiguration::where('tipo', $tipo)->first();

        if (!$config) {
            return response()->json(['message' => 'Configuración no encontrada'], 404);
        }

        return response()->json($config);
    }

    /**
     * Actualizar configuración por tipo
     */
    public function update(Request $request, string $tipo)
    {
        $config = LoanConfiguration::where('tipo', $tipo)->first();

        if (!$config) {
            return response()->json(['message' => 'Configuración no encontrada'], 404);
        }

        $validated = $request->validate([
            'nombre' => 'sometimes|string|max:255',
            'descripcion' => 'nullable|string',
            'monto_minimo' => 'sometimes|numeric|min:0',
            'monto_maximo' => 'sometimes|numeric|min:0',
            'tasa_anual' => 'sometimes|numeric|min:0|max:100',
            'plazo_minimo' => 'sometimes|integer|min:1',
            'plazo_maximo' => 'sometimes|integer|min:1',
            'activo' => 'sometimes|boolean',
            'monto_poliza' => 'sometimes|numeric|min:0',
        ]);

        $config->update($validated);
        return response()->json($config);
    }

    /**
     * Obtener rangos de montos para formularios (formateado para selects)
     */
    public function rangosParaFormulario()
    {
        $configs = LoanConfiguration::activas();
        $result = [];

        foreach ($configs as $config) {
            $result[$config->tipo] = [
                'nombre' => $config->nombre,
                'monto_minimo' => $config->monto_minimo,
                'monto_maximo' => $config->monto_maximo,
                'tasa_anual' => $config->tasa_anual,
                'plazo_minimo' => $config->plazo_minimo,
                'plazo_maximo' => $config->plazo_maximo,
                'rangos_monto' => $this->generarRangosMonto($config),
                'rangos_plazo' => $this->generarRangosPlazo($config),
            ];
        }

        return response()->json($result);
    }

    /**
     * Generar rangos de monto automáticamente
     */
    private function generarRangosMonto(LoanConfiguration $config): array
    {
        $rangos = [];
        $min = $config->monto_minimo;
        $max = $config->monto_maximo;

        // Dividir en 3-4 rangos
        $paso = ($max - $min) / 3;

        for ($i = 0; $i < 3; $i++) {
            $desde = $min + ($paso * $i);
            $hasta = $min + ($paso * ($i + 1));

            $rangos[] = [
                'value' => $this->formatearRangoValue($desde, $hasta),
                'label' => $this->formatearMontoColones($desde) . ' - ' . $this->formatearMontoColones($hasta),
                'min' => $desde,
                'max' => $hasta,
            ];
        }

        return $rangos;
    }

    /**
     * Generar rangos de plazo
     */
    private function generarRangosPlazo(LoanConfiguration $config): array
    {
        $rangos = [];
        $plazos = [6, 12, 18, 24, 36, 48, 60, 72];

        foreach ($plazos as $plazo) {
            if ($plazo >= $config->plazo_minimo && $plazo <= $config->plazo_maximo) {
                $rangos[] = [
                    'value' => $plazo,
                    'label' => $plazo . ' meses',
                ];
            }
        }

        return $rangos;
    }

    /**
     * Formatear monto en colones
     */
    private function formatearMontoColones(float $monto): string
    {
        return '₡' . number_format($monto, 0, ',', ',');
    }

    /**
     * Formatear valor para el select
     */
    private function formatearRangoValue(float $desde, float $hasta): string
    {
        $desdeK = $desde / 1000;
        $hastaK = $hasta / 1000;

        if ($hastaK >= 1000) {
            return number_format($desdeK / 1000, 1) . 'm-' . number_format($hastaK / 1000, 1) . 'm';
        }

        return number_format($desdeK, 0) . 'k-' . number_format($hastaK, 0) . 'k';
    }
}
