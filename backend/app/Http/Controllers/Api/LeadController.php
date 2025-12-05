<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LeadController extends Controller
{
    public function index()
    {
        return response()->json(Lead::with('assignedAgent')->paginate(20));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'cedula' => 'required|string|max:20|unique:persons,cedula',
            'email' => 'nullable|email|max:255|unique:persons,email',
            'phone' => 'nullable|string|max:20',
            'assigned_to_id' => 'nullable|exists:users,id',
            'notes' => 'nullable|string',
            'source' => 'nullable|string',
        ]);

        $lead = Lead::create($validated);

        return response()->json($lead, 201);
    }

    public function show($id)
    {
        $lead = Lead::with('assignedAgent')->findOrFail($id);
        return response()->json($lead);
    }

    public function update(Request $request, $id)
    {
        $lead = Lead::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'cedula' => [
                'sometimes',
                'required',
                'string',
                'max:20',
                Rule::unique('persons')->ignore($lead->id),
            ],
            'email' => [
                'nullable',
                'email',
                'max:255',
                Rule::unique('persons')->ignore($lead->id),
            ],
            'phone' => 'nullable|string|max:20',
            'assigned_to_id' => 'nullable|exists:users,id',
            'notes' => 'nullable|string',
            'source' => 'nullable|string',
        ]);

        $lead->update($validated);

        return response()->json($lead);
    }

    public function destroy($id)
    {
        $lead = Lead::findOrFail($id);
        $lead->delete();

        return response()->json(null, 204);
    }

    public function toggleActive($id)
    {
        $lead = Lead::findOrFail($id);
        $lead->status = $lead->status === 'Activo' ? 'Inactivo' : 'Activo';
        $lead->save();
        return response()->json($lead);
    }
}
