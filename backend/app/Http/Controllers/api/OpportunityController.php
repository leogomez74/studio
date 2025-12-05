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
        return response()->json(Opportunity::with(['lead', 'staff'])->latest()->paginate(20), 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'lead_cedula' => 'required|string|exists:persons,cedula',
            'credit_type' => 'required|string',
            'amount' => 'required|numeric|min:0',
            'status' => 'required|string',
            'start_date' => 'required|date',
            'assigned_to_id' => 'required|exists:users,id',
        ]);

        $data = $validated;
        // ID manual porque el modelo no es auto-incremental
        $data['id'] = Str::random(20);

        $opportunity = Opportunity::create($data);

        return response()->json($opportunity, 201);
    }

    public function show($id)
    {
        $opportunity = Opportunity::with(['lead', 'staff'])->findOrFail($id);
        return response()->json($opportunity, 200);
    }

    public function update(Request $request, $id)
    {
        $opportunity = Opportunity::findOrFail($id);
        $opportunity->update($request->all());
        return response()->json($opportunity, 200);
    }

    public function destroy($id)
    {
        $opportunity = Opportunity::findOrFail($id);
        $opportunity->delete();
        return response()->json(['message' => 'Opportunity deleted'], 200);
    }
}
