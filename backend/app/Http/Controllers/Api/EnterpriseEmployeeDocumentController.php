<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Enterprise as Enterprise;
use App\Models\EnterpriseEmployeeDocumentRequirement;
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
            'requirements.*.file_extension' => 'required|string|max:50',
            'requirements.*.binary' => 'required',
            'requirements.*.upload_date' => 'required|date',
            'requirements.*.last_updated' => 'nullable|date',
        ]);

        $document = Enterprise::create([
            'business_name' => $validated['business_name'],
        ]);

        foreach ($validated['requirements'] as $req) {
            $document->requirements()->create($req);
        }

        return response()->json($document->load('requirements'), 201);
    }

    public function show(string $id)
    {
        $document = Enterprise::with('requirements')->findOrFail($id);
        return response()->json($document);
    }

    public function update(Request $request, string $id)
    {
        $document = Enterprise::findOrFail($id);
        $validated = $request->validate([
            'business_name' => 'sometimes|required|string|max:255',
            'requirements' => 'sometimes|array',
            'requirements.*.file_extension' => 'required_with:requirements|string|max:50',
            'requirements.*.binary' => 'required_with:requirements',
            'requirements.*.upload_date' => 'required_with:requirements|date',
            'requirements.*.last_updated' => 'nullable|date',
        ]);

        if (isset($validated['business_name'])) {
            $document->update(['business_name' => $validated['business_name']]);
        }
        if (isset($validated['requirements'])) {
            // Opcional: eliminar y volver a crear, o actualizar individualmente
            $document->requirements()->delete();
            foreach ($validated['requirements'] as $req) {
                $document->requirements()->create($req);
            }
        }
        return response()->json($document->load('requirements'));
    }
    

    public function destroy(string $id)
    {
        $document = Enterprise::findOrFail($id);
        $document->requirements()->delete();
        $document->delete();
        return response()->json(null, 204);
    }
}
