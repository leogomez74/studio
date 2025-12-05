<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClientController extends Controller
{
    public function index()
    {
        return response()->json(Client::with('assignedAgent')->paginate(20), 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'cedula' => 'nullable|string|max:20|unique:persons,cedula',
            'email' => 'nullable|email|max:255|unique:persons,email',
            'phone' => 'nullable|string|max:20',
            'province' => 'nullable|string|max:100',
            'canton' => 'nullable|string|max:100',
            'address' => 'nullable|string',
            'assigned_to_id' => 'nullable|exists:users,id',
        ]);

        $client = Client::create($validated);

        return response()->json($client, 201);
    }

    public function show(string $id)
    {
        $client = Client::with('assignedAgent')->findOrFail($id);
        return response()->json($client, 200);
    }

    public function update(Request $request, string $id)
    {
        $client = Client::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'cedula' => ['nullable', 'string', 'max:20', Rule::unique('persons')->ignore($client->id)],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('persons')->ignore($client->id)],
            'phone' => 'nullable|string|max:20',
            'province' => 'nullable|string|max:100',
            'canton' => 'nullable|string|max:100',
            'address' => 'nullable|string',
            'assigned_to_id' => 'nullable|exists:users,id',
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
