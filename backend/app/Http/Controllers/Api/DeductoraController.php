<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Deductora;
use Illuminate\Http\Request;

class DeductoraController extends Controller
{
    public function index()
    {
        return response()->json(Deductora::all());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:255',
            'fecha_reporte_pago' => 'nullable|date',
            'comision' => 'nullable|numeric',
        ]);

        $deductora = Deductora::create($validated);
        return response()->json($deductora, 201);
    }

    public function show(string $id)
    {
        $deductora = Deductora::findOrFail($id);
        return response()->json($deductora);
    }

    public function update(Request $request, string $id)
    {
        $deductora = Deductora::findOrFail($id);

        $validated = $request->validate([
            'nombre' => 'sometimes|required|string|max:255',
            'fecha_reporte_pago' => 'nullable|date',
            'comision' => 'nullable|numeric',
        ]);

        $deductora->update($validated);
        return response()->json($deductora);
    }

    public function destroy(string $id)
    {
        $deductora = Deductora::findOrFail($id);
        $deductora->delete();
        return response()->json(null, 204);
    }
}
