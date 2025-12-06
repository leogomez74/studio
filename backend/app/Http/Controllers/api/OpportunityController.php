<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Opportunity;
use Illuminate\Http\Request;

class OpportunityController extends Controller
{
    public function index(Request $request)
    {
        $query = Opportunity::with(['lead', 'user']);

        // Filter by Status
        if ($request->has('status')) {
            $query->where('status', $request->input('status'));
        }

        // Filter by Lead Cedula
        if ($request->has('lead_cedula')) {
            $query->where('lead_cedula', $request->input('lead_cedula'));
        }

        // Filter by Assigned User
        if ($request->has('assigned_to_id')) {
            $query->where('assigned_to_id', $request->input('assigned_to_id'));
        }

        $opportunities = $query->latest()->paginate(20);

        return response()->json($opportunities, 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'lead_cedula' => 'required|string|exists:persons,cedula',
            'opportunity_type' => 'nullable|string',
            'vertical' => 'nullable|string',
            'amount' => 'required|numeric|min:0',
            'status' => 'required|string',
            'expected_close_date' => 'nullable|date',
            'comments' => 'nullable|string',
            'assigned_to_id' => 'nullable|exists:users,id',
        ]);

        $opportunity = Opportunity::create($validated);

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
            'opportunity_type' => 'sometimes|nullable|string',
            'vertical' => 'sometimes|nullable|string',
            'amount' => 'sometimes|required|numeric|min:0',
            'status' => 'sometimes|required|string',
            'expected_close_date' => 'sometimes|nullable|date',
            'comments' => 'sometimes|nullable|string',
            'assigned_to_id' => 'sometimes|nullable|exists:users,id',
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
