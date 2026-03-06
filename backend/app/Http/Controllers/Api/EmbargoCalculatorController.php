<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Person;
use App\Services\EmbargoCalculatorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class EmbargoCalculatorController extends Controller
{
    /**
     * Buscar personas (leads + clientes) con salario para la calculadora.
     */
    public function buscarPersonas(Request $request): JsonResponse
    {
        $query = Person::select('id', 'name', 'apellido1', 'apellido2', 'cedula', 'salario_exacto', 'person_type_id')
            ->where('is_active', true);

        if ($request->filled('q')) {
            $q = $request->input('q');
            $query->where(function ($builder) use ($q) {
                $builder->where('name', 'LIKE', "%{$q}%")
                    ->orWhere('apellido1', 'LIKE', "%{$q}%")
                    ->orWhere('apellido2', 'LIKE', "%{$q}%")
                    ->orWhere('cedula', 'LIKE', "%{$q}%");
            });
        }

        $results = $query->orderByDesc('updated_at')
            ->limit((int) $request->input('per_page', 15))
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'name' => trim("{$p->name} {$p->apellido1} {$p->apellido2}"),
                'cedula' => $p->cedula,
                'salario_exacto' => $p->salario_exacto,
                'tipo' => $p->person_type_id === 2 ? 'Cliente' : 'Lead',
            ]);

        return response()->json($results);
    }

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
            $service = new EmbargoCalculatorService();
            return response()->json($service->calcular($salario, $pension, $embargo1, $embargo2));
        } catch (\Exception $e) {
            Log::warning('Embargo Calculator: calculation failed', [
                'error' => $e->getMessage(),
                'salario' => $salario,
            ]);

            return response()->json([
                'error' => $e->getMessage(),
            ], 503);
        }
    }
}
