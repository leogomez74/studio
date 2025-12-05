<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use Illuminate\Http\Request;

class LeadController extends Controller
{
    public function index()
    {
        // Incluimos la relación assignedAgent para mostrar en la tabla
        return response()->json(Lead::with('assignedAgent')->latest()->paginate(15), 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'cedula' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'status' => 'nullable|string',
            'lead_status_id' => 'nullable|exists:lead_statuses,id',
            'assigned_agent_id' => 'nullable|exists:users,id',
        ]);

        $lead = Lead::create($validated);
        return response()->json($lead, 201);
    }

    public function show($id)
    {
        $lead = Lead::findOrFail($id);
        return response()->json($lead, 200);
    }

    public function update(Request $request, $id)
    {
        $lead = Lead::findOrFail($id);
        $lead->update($request->all());
        return response()->json($lead, 200);
    }

    public function destroy($id)
    {
        $lead = Lead::findOrFail($id);
        $lead->delete();
        return response()->json(['message' => 'Lead deleted'], 200);
    }

    /**
     * Convierte Lead a Cliente cambiando su tipo
     */
    public function convertToClient($id)
    {
        $lead = Lead::findOrFail($id);

        // Cambiamos el tipo directamente en la base de datos
        // Usamos saveQuietly si queremos evitar eventos, o forzamos el cambio
        $lead->person_type_id = 2;
        $lead->save();

        return response()->json(['message' => 'Lead convertido a Cliente exitosamente'], 200);
    }
}
