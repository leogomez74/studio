<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Enterprise;
use App\Models\EnterprisesRequirement;
use Illuminate\Http\Request;

class EnterpriseEmployeeDocumentController extends Controller
{
    public function index(Request $request)
    {
        $query = Enterprise::with('requirements');
        if ($request->has('business_name')) {
            $query->where('business_name', $request->input('business_name'));
        }
        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'business_name' => 'required|string|max:255',
            'requirements' => 'required|array',
            'requirements.*.name' => 'required|string|max:255',
            'requirements.*.file_extension' => 'required|string|max:50',
            'requirements.*.quantity' => 'nullable|integer|min:1', // Nuevo campo
            'requirements.*.upload_date' => 'required|date',
            'requirements.*.last_updated' => 'nullable|date',
        ]);

        $empresa = Enterprise::create([
            'business_name' => $validated['business_name'],
        ]);

        foreach ($validated['requirements'] as $req) {
            // Asignar default de 1 si no viene
            $req['quantity'] = $req['quantity'] ?? 1;
            $empresa->requirements()->create($req);
        }

        return response()->json($empresa->load('requirements'), 201);
    }

    public function show(string $id)
    {
        $empresa = Enterprise::with('requirements')->findOrFail($id);
        return response()->json($empresa);
    }

    public function update(Request $request, string $id)
    {
        $empresa = Enterprise::findOrFail($id);
        
        $validated = $request->validate([
            'business_name' => 'sometimes|required|string|max:255',
            'requirements' => 'sometimes|array',
            'requirements.*.name' => 'required_with:requirements|string|max:255',
            'requirements.*.file_extension' => 'required_with:requirements|string|max:50',
            'requirements.*.quantity' => 'nullable|integer|min:1', // Nuevo campo
            'requirements.*.upload_date' => 'required_with:requirements|date',
            'requirements.*.last_updated' => 'nullable|date',
        ]);

        if (isset($validated['business_name'])) {
            $empresa->update(['business_name' => $validated['business_name']]);
        }

        if (isset($validated['requirements'])) {
            $empresa->requirements()->delete();
            foreach ($validated['requirements'] as $req) {
                $req['quantity'] = $req['quantity'] ?? 1;
                $empresa->requirements()->create($req);
            }
        }

        return response()->json($empresa->load('requirements'));
    }

    public function destroy(string $id)
    {
        $empresa = Enterprise::findOrFail($id);
        $empresa->requirements()->delete();
        $empresa->delete();
        return response()->json(null, 204);
    }
}
