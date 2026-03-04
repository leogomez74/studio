<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MtssEmbargoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class EmbargoCalculatorController extends Controller
{
    public function calcular(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'salario_bruto' => 'required|numeric|min:0',
            'pension_alimenticia' => 'nullable|numeric|min:0',
            'otro_embargo_1' => 'nullable|numeric|min:0',
            'otro_embargo_2' => 'nullable|numeric|min:0',
        ]);

        $salario = (float) $validated['salario_bruto'];
        $pension = (float) ($validated['pension_alimenticia'] ?? 0);
        $embargo1 = (float) ($validated['otro_embargo_1'] ?? 0);
        $embargo2 = (float) ($validated['otro_embargo_2'] ?? 0);

        try {
            $service = new MtssEmbargoService();
            $result = $service->calcular($salario, $pension, $embargo1, $embargo2);

            return response()->json([
                'resultado' => $result['resultado'],
                'source' => 'mtss',
                'cached' => $result['cached'] ?? false,
            ]);
        } catch (\Exception $e) {
            Log::warning('MTSS Embargo: scraping failed', [
                'error' => $e->getMessage(),
                'salario' => $salario,
            ]);

            return response()->json([
                'error' => $e->getMessage(),
            ], 503);
        }
    }
}
