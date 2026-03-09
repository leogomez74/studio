<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmbargoConfiguracion;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;

class EmbargoConfiguracionController extends Controller
{
    use LogsActivity;

    public function show(): JsonResponse
    {
        $config = EmbargoConfiguracion::vigente();

        if (!$config) {
            return response()->json(['error' => 'No hay configuracion de embargo activa.'], 404);
        }

        return response()->json($config);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'salario_minimo_inembargable' => 'required|numeric|min:0',
            'tasa_ccss' => 'required|numeric|min:0|max:1',
            'tasa_tramo1' => 'required|numeric|min:0|max:1',
            'tasa_tramo2' => 'required|numeric|min:0|max:1',
            'multiplicador_tramo1' => 'required|integer|min:1|max:10',
            'tramos_renta' => 'required|array',
            'tramos_renta.*.limite' => 'nullable|numeric|min:0',
            'tramos_renta.*.tasa' => 'required|numeric|min:0|max:1',
            'decreto' => 'nullable|string|max:50',
            'anio' => 'required|integer|min:2020|max:2100',
        ]);

        $config = EmbargoConfiguracion::vigente();
        $oldData = $config ? $config->toArray() : null;

        if (!$config) {
            $config = EmbargoConfiguracion::create(array_merge($validated, [
                'fuente' => 'manual',
                'activo' => true,
            ]));

            $this->logActivity('create', 'Configuración Embargo', $config, 'Config Embargo ' . ($config->anio ?? ''), null, $request);
        } else {
            $config->update(array_merge($validated, [
                'fuente' => 'manual',
            ]));

            $this->logActivity('update', 'Configuración Embargo', $config, 'Config Embargo ' . ($config->anio ?? ''), $this->getChanges($oldData, $config->fresh()->toArray()), $request);
        }

        Log::info('Embargo config updated manually', [
            'user_id' => $request->user()?->id,
            'smi' => $validated['salario_minimo_inembargable'],
        ]);

        return response()->json($config->fresh());
    }

    public function verificarPdf(): JsonResponse
    {
        try {
            Artisan::call('embargo:actualizar-smi');
            $output = Artisan::output();

            return response()->json([
                'success' => true,
                'output' => trim($output),
                'config' => EmbargoConfiguracion::vigente(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
