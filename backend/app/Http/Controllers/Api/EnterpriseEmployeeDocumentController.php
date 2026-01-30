<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Enterprise;
use App\Models\EnterprisesRequirement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
            'business_name' => 'required|string|max:255|unique:enterprises,business_name',
            'requirements' => 'required|array',
            'requirements.*.name' => 'required|string|max:255',
            'requirements.*.file_extension' => 'required|string|max:50',
            'requirements.*.quantity' => 'nullable|integer|min:1', // Nuevo campo
            'requirements.*.upload_date' => 'required|date',
            'requirements.*.last_updated' => 'nullable|date',
        ]);

        $empresa = DB::transaction(function () use ($validated) {
            $empresa = Enterprise::create([
                'business_name' => $validated['business_name'],
            ]);

            foreach ($validated['requirements'] as $req) {
                // Asignar default de 1 si no viene
                $req['quantity'] = $req['quantity'] ?? 1;
                $empresa->requirements()->create($req);
            }

            return $empresa;
        });

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
            'business_name' => 'sometimes|required|string|max:255|unique:enterprises,business_name,' . $id,
            'requirements' => 'sometimes|array',
            'requirements.*.id' => 'nullable|exists:enterprises_requirements,id',
            'requirements.*.name' => 'required_with:requirements|string|max:255',
            'requirements.*.file_extension' => 'required_with:requirements|string|max:50',
            'requirements.*.quantity' => 'nullable|integer|min:1', // Nuevo campo
            'requirements.*.upload_date' => 'required_with:requirements|date',
            'requirements.*.last_updated' => 'nullable|date',
        ]);

        DB::transaction(function () use ($empresa, $validated) {
            if (isset($validated['business_name'])) {
                $empresa->update(['business_name' => $validated['business_name']]);
            }

            if (isset($validated['requirements'])) {
                // Recopilar IDs que vienen en el request
                $incomingIds = collect($validated['requirements'])
                    ->pluck('id')
                    ->filter()
                    ->toArray();

                // Eliminar solo los requirements que NO están en el request
                $empresa->requirements()
                    ->whereNotIn('id', $incomingIds)
                    ->delete();

                // Actualizar o crear cada requirement
                foreach ($validated['requirements'] as $req) {
                    $req['quantity'] = $req['quantity'] ?? 1;

                    if (isset($req['id'])) {
                        // Actualizar existente
                        $empresa->requirements()
                            ->where('id', $req['id'])
                            ->update([
                                'name' => $req['name'],
                                'file_extension' => $req['file_extension'],
                                'quantity' => $req['quantity'],
                                'upload_date' => $req['upload_date'],
                                'last_updated' => $req['last_updated'] ?? null,
                            ]);
                    } else {
                        // Crear nuevo
                        unset($req['id']); // Asegurar que no se pase un ID null
                        $empresa->requirements()->create($req);
                    }
                }
            }
        });

        return response()->json($empresa->load('requirements'));
    }

    public function destroy(string $id)
    {
        $empresa = Enterprise::findOrFail($id);

        DB::transaction(function () use ($empresa) {
            $empresa->requirements()->delete();
            $empresa->delete();
        });

        return response()->json(null, 204);
    }
}
