<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Analisis;
use Illuminate\Http\Request;

class AnalisisController extends Controller
{
// AnalisisController.php

public function index()
{
    $analisis = Analisis::with(['opportunity', 'lead'])
        ->orderBy('created_at', 'desc')
        ->get();

    return response()->json($analisis);
}
    public function store(Request $request)
    {
        $validated = $request->validate([
            'reference' => 'required|unique:analisis,reference',
            'title' => 'required|string',
            'status' => 'required|string',
            'category' => 'nullable|string',
            'monto_credito' => 'required|numeric|min:1',
            'lead_id' => 'nullable|integer',
            'opportunity_id' => 'nullable|integer',
            'assigned_to' => 'nullable|string',
            'opened_at' => 'nullable|date',
            'description' => 'nullable|string',
            'divisa' => 'nullable|string',
            'plazo' => 'required|integer|min:1',
            'ingreso_bruto' => 'nullable|numeric',
            'ingreso_neto' => 'nullable|numeric',
            'propuesta' => 'nullable|string',
        ]);

        // Auto-mapear category basado en la oportunidad o el lead
        if (!isset($validated['category'])) {
            $validated['category'] = $this->determineCategoryFromData($validated);
        }

        $analisis = Analisis::create($validated);
        return response()->json($analisis, 201);
    }

    public function show(int $id)
    {
        $analisis = Analisis::with(['opportunity', 'lead'])->findOrFail($id);
        return response()->json($analisis);
    }

    public function update(Request $request, $id)
    {
        $analisis = Analisis::findOrFail($id);
        $validated = $request->validate([
            'reference' => 'sometimes|required|unique:analisis,reference,' . $id,
            'title' => 'sometimes|required|string',
            'status' => 'sometimes|required|string',
            'category' => 'nullable|string',
            'monto_credito' => 'nullable|numeric',
            'lead_id' => 'nullable|integer',
            'opportunity_id' => 'nullable|integer',
            'assigned_to' => 'nullable|string',
            'opened_at' => 'nullable|date',
            'description' => 'nullable|string',
            'divisa' => 'nullable|string',
            'plazo' => 'nullable|integer',
            'ingreso_bruto' => 'nullable|numeric',
            'ingreso_neto' => 'nullable|numeric',
            'propuesta' => 'nullable|string',
        ]);
        $analisis->update($validated);
        return response()->json($analisis);
    }

    public function destroy($id)
    {
        $analisis = Analisis::findOrFail($id);
        $analisis->delete();
        return response()->json(null, 204);
    }

    /**
     * Determinar la categoría del análisis basado en la oportunidad o el lead.
     *
     * @param array $data
     * @return string
     */
    private function determineCategoryFromData(array $data): string
    {
        // Si hay opportunity_id, buscar la oportunidad y usar su tipo
        if (!empty($data['opportunity_id'])) {
            $opportunity = \App\Models\Opportunity::find($data['opportunity_id']);
            if ($opportunity) {
                return $this->mapOpportunityTypeToCategory($opportunity->opportunity_type);
            }
        }

        // Si hay lead_id, buscar el lead y usar su interes
        if (!empty($data['lead_id'])) {
            $lead = \App\Models\Lead::find($data['lead_id']);
            if ($lead) {
                return $this->mapInteresToCategory($lead->interes);
            }
        }

        // Default
        return 'General';
    }

    /**
     * Mapear el tipo de oportunidad a una categoría de análisis.
     *
     * @param string|null $opportunityType
     * @return string
     */
    private function mapOpportunityTypeToCategory(?string $opportunityType): string
    {
        if (!$opportunityType) {
            return 'General';
        }

        $creditTypes = ['Crédito', 'Micro Crédito'];
        $legalTypes = ['Divorcio', 'Notariado', 'Testamentos', 'Descuento de Facturas', 'Poder', 'Escritura', 'Declaratoria de Herederos'];

        if (in_array($opportunityType, $creditTypes)) {
            return 'Crédito';
        }

        if (in_array($opportunityType, $legalTypes)) {
            return 'Servicios Legales';
        }

        return 'General';
    }

    /**
     * Mapear el interes del lead a una categoría de análisis.
     *
     * @param string|null $interes
     * @return string
     */
    private function mapInteresToCategory(?string $interes): string
    {
        if ($interes === 'credito') {
            return 'Crédito';
        }

        if ($interes === 'servicios_legales') {
            return 'Servicios Legales';
        }

        if ($interes === 'ambos') {
            return 'Crédito'; // Priorizar crédito
        }

        return 'General';
    }
}
