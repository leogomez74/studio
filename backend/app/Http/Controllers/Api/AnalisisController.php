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
    // Cargamos la oportunidad Y el lead dentro de la oportunidad
    $analisis = Analisis::with(['opportunity.lead'])
        ->orderBy('created_at', 'desc')
        ->get(); // O ->paginate(10);

    // Si estás usando API Resources (Recomendado):
    // return AnalisisResource::collection($analisis);

    // Si retornas JSON directo:
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
        ]);
        $analisis = Analisis::create($validated);
        return response()->json($analisis, 201);
    }

    public function show($id)
    {
        $analisis = Analisis::findOrFail($id);
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
}
