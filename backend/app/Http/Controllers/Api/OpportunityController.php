<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Opportunity;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class OpportunityController extends Controller
{
    public function index()
    {
        return response()->json(Opportunity::with(['lead', 'user'])->paginate(20), 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'lead_cedula' => 'required|string|exists:persons,cedula',
            'credit_type' => 'required|in:Regular,Micro-crédito',
            'amount' => 'required|numeric|min:0',
            'status' => 'required|in:En proceso,Rechazada,Aceptada,Convertido',
            'start_date' => 'required|date',
            'assigned_to_id' => 'required|exists:users,id',
        ]);

        $data = $validated;
        if (!isset($data['id'])) {
             $data['id'] = Str::random(20);
        }

        $opportunity = Opportunity::create($data);

        return response()->json($opportunity, 201);
    }

    public function show(string $id)
    {
        $opportunity = Opportunity::with(['lead', 'user'])->findOrFail($id);
        return response()->json($opportunity, 200);
    }

    public function update(Request $request, string $id)
    {
        $opportunity = Opportunity::findOrFail($id);

        $validated = $request->validate([
            'lead_cedula' => 'sometimes|required|string|exists:persons,cedula',
            'credit_type' => 'sometimes|required|in:Regular,Micro-crédito',
            'amount' => 'sometimes|required|numeric|min:0',
            'status' => 'sometimes|required|in:En proceso,Rechazada,Aceptada,Convertido',
            'start_date' => 'sometimes|required|date',
            'assigned_to_id' => 'sometimes|required|exists:users,id',
        ]);

        $opportunity->update($validated);

        return response()->json($opportunity, 200);
    }

    public function destroy(string $id)
    {
        $opportunity = Opportunity::findOrFail($id);
        $opportunity->delete();

        return response()->json(['message' => 'Opportunity deleted successfully'], 200);
    }
}
