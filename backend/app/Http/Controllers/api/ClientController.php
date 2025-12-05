<?php

namespace App\Http\Controllers\Api;

use App\Models\Client;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Validation\Rule; // <--- Necesario para validaciones avanzadas

class ClientController extends Controller
{
    public function index()
    {
        // Sugerencia: Carga también el agente asignado para mostrarlo en la tabla
        return response()->json(Client::with('assignedAgent')->paginate(20), 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            // Validamos contra la tabla real 'persons'
            'cedula' => 'nullable|string|max:20|unique:persons,cedula',
            'email' => 'nullable|email|max:255|unique:persons,email',
            'phone' => 'nullable|string|max:20',
            'province' => 'nullable|string|max:100',
            'canton' => 'nullable|string|max:100',

            // CORRECCIÓN: Usamos el nombre real de la columna en BD
            'direccion1' => 'nullable|string',

            'assigned_agent_id' => 'nullable|exists:users,id',
        ]);

        // El modelo Client forzará person_type_id = 2
        $client = Client::create($validated);

        return response()->json($client, 201);
    }

    public function show(string $id)
    {
        // Cargamos las oportunidades del cliente, útil para su perfil
        $client = Client::with('opportunities')->findOrFail($id);
        return response()->json($client, 200);
    }

    public function update(Request $request, string $id)
    {
        $client = Client::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',

            // CORRECCIÓN: Ignoramos el ID actual para no dar error de duplicado propio
            'cedula' => ['nullable', 'string', 'max:20', Rule::unique('persons')->ignore($client->id)],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('persons')->ignore($client->id)],

            'phone' => 'nullable|string|max:20',
            'province' => 'nullable|string|max:100',
            'canton' => 'nullable|string|max:100',
            'direccion1' => 'nullable|string', // Nombre corregido
            'assigned_agent_id' => 'nullable|exists:users,id',
        ]);

        $client->update($validated);

        return response()->json($client, 200);
    }

    public function destroy(string $id)
    {
        $client = Client::findOrFail($id);
        $client->delete();

        return response()->json(['message' => 'Client deleted successfully'], 200);
    }
}
