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
}
