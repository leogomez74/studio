<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClientController extends Controller
{
    public function index(Request $request)
    {
        $activeFilter = $this->resolveActiveFilter($request);

        $query = Client::query()
            ->with('assignedAgent');

        // Filter by Active Status (Boolean)
        if ($activeFilter !== null) {
            $query->where('is_active', $activeFilter);
        }

        // Filter by Client Status (String: 'Moroso', 'Activo', etc.)
        if ($request->has('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }

        // Filter by Assigned Agent
        if ($request->has('assigned_to_id') && $request->input('assigned_to_id') !== 'all') {
            $query->where('assigned_to_id', $request->input('assigned_to_id'));
        }

        // Filter by Contact Info
        if ($request->has('has_contact') && $request->input('has_contact') !== 'all') {
            $hasContact = $request->input('has_contact');
            if ($hasContact === 'con-contacto') {
                $query->where(function ($q) {
                    $q->whereNotNull('email')->where('email', '!=', '')
                      ->orWhereNotNull('phone')->where('phone', '!=', '');
                });
            } elseif ($hasContact === 'sin-contacto') {
                $query->where(function ($q) {
                    $q->where(function ($sub) {
                        $sub->whereNull('email')->orWhere('email', '');
                    })->where(function ($sub) {
                        $sub->whereNull('phone')->orWhere('phone', '');
                    });
                });
            }
        }

        // Search by Name, Cedula, Email, Phone
        if ($request->has('q') && !empty($request->input('q'))) {
            $search = $request->input('q');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('cedula', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        // Filter by Date Range (created_at)
        if ($request->has('date_from') && !empty($request->input('date_from'))) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }
        if ($request->has('date_to') && !empty($request->input('date_to'))) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        $clients = $query->latest()->paginate(20);

        return response()->json($clients, 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'apellido1' => 'nullable|string|max:255',
            'apellido2' => 'nullable|string|max:255',
            'cedula' => 'nullable|string|max:20|unique:persons,cedula',
            'email' => 'nullable|email|max:255|unique:persons,email',
            'phone' => 'nullable|string|max:20',
            'province' => 'nullable|string|max:100',
            'canton' => 'nullable|string|max:100',
            'distrito' => 'nullable|string|max:100',
            'direccion1' => 'nullable|string',
            'direccion2' => 'nullable|string',
            'assigned_to_id' => 'nullable|exists:users,id',
            'whatsapp' => 'nullable|string|max:50',
            'tel_casa' => 'nullable|string|max:50',
            'tel_amigo' => 'nullable|string|max:50',
            'ocupacion' => 'nullable|string|max:255',
            'estado_civil' => 'nullable|string|max:255',
            'fecha_nacimiento' => 'nullable|date',
            'is_active' => 'sometimes|boolean',
        ]);

        $validated['is_active'] = $validated['is_active'] ?? true;

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
            'apellido1' => 'sometimes|nullable|string|max:255',
            'apellido2' => 'sometimes|nullable|string|max:255',
            'cedula' => ['sometimes', 'nullable', 'string', 'max:20', Rule::unique('persons')->ignore($client->id)],
            'email' => ['sometimes', 'nullable', 'email', 'max:255', Rule::unique('persons')->ignore($client->id)],
            'phone' => 'sometimes|nullable|string|max:20',
            'province' => 'sometimes|nullable|string|max:100',
            'canton' => 'sometimes|nullable|string|max:100',
            'distrito' => 'sometimes|nullable|string|max:100',
            'direccion1' => 'sometimes|nullable|string',
            'direccion2' => 'sometimes|nullable|string',
            'assigned_to_id' => 'sometimes|nullable|exists:users,id',
            'whatsapp' => 'sometimes|nullable|string|max:50',
            'tel_casa' => 'sometimes|nullable|string|max:50',
            'tel_amigo' => 'sometimes|nullable|string|max:50',
            'ocupacion' => 'sometimes|nullable|string|max:255',
            'estado_civil' => 'sometimes|nullable|string|max:255',
            'fecha_nacimiento' => 'sometimes|nullable|date',
            'is_active' => 'sometimes|boolean',
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

    private function resolveActiveFilter(Request $request): ?bool
    {
        $raw = $request->input('is_active');

        if ($raw === null) {
            return true;
        }

        if (is_bool($raw)) {
            return $raw;
        }

        if (is_numeric($raw)) {
            return (bool) ((int) $raw);
        }

        if (is_string($raw)) {
            $value = strtolower($raw);
            if (in_array($value, ['all', 'todos', 'cualquiera', 'any', '*'], true)) {
                return null;
            }

            if (in_array($value, ['1', 'true', 'activo', 'activos', 'yes', 'si'], true)) {
                return true;
            }

            if (in_array($value, ['0', 'false', 'inactivo', 'inactivos', 'no'], true)) {
                return false;
            }
        }

        return true;
    }
}
