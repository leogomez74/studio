<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\LeadStatus;
use App\Models\Opportunity;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class LeadController extends Controller
{
    public function index(Request $request)
    {
        $activeFilter = $this->resolveActiveFilter($request);

        $query = Lead::query()
            ->select([
                'id', 'name', 'apellido1', 'apellido2', 'cedula',
                'email', 'phone', 'lead_status_id', 'is_active',
                'assigned_to_id', 'deductora_id', 'created_at', 'updated_at'
            ])
            ->with([
                'assignedAgent:id,name',
                'leadStatus:id,name,slug'
            ]);

        // Filter by Active Status
        if ($activeFilter !== null) {
            $query->where('is_active', $activeFilter);
        }

        // Filter by Lead Status (ID)
        if ($request->has('lead_status_id') && $request->input('lead_status_id') !== 'all') {
            $query->where('lead_status_id', $request->input('lead_status_id'));
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
            // Strip non-numeric characters for cedula search
            $strippedSearch = preg_replace('/[^0-9]/', '', $search);

            $query->where(function ($q) use ($search, $strippedSearch) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('cedula', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");

                // Also search stripped cedula if it differs from original
                if (!empty($strippedSearch) && $strippedSearch !== $search) {
                    $q->orWhereRaw("REPLACE(REPLACE(cedula, '-', ''), ' ', '') LIKE ?", ["%{$strippedSearch}%"]);
                }
            });
        }

        // Filter by Date Range (created_at)
        if ($request->has('date_from') && !empty($request->input('date_from'))) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }
        if ($request->has('date_to') && !empty($request->input('date_to'))) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        $perPage = min((int) $request->input('per_page', 10), 100);
        $leads = $query->latest()->paginate($perPage);

        return response()->json($leads);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'apellido1' => 'nullable|string|max:255',
            'apellido2' => 'nullable|string|max:255',
            'cedula' => 'required|string|max:20|unique:persons,cedula',
            'email' => 'required|email|max:255|unique:persons,email',
            'phone' => 'required|string|max:20',
            'status' => 'nullable|string|max:100',
            'lead_status_id' => 'nullable|integer|exists:lead_statuses,id',
            'assigned_to_id' => 'nullable|exists:users,id',
            'notes' => 'nullable|string',
            'source' => 'nullable|string',
            'whatsapp' => 'nullable|string|max:50',
            'tel_casa' => 'nullable|string|max:50',
            'tel_amigo' => 'nullable|string|max:50',
            'province' => 'nullable|string|max:255',
            'canton' => 'nullable|string|max:255',
            'distrito' => 'nullable|string|max:255',
            'direccion1' => 'nullable|string|max:255',
            'direccion2' => 'nullable|string|max:255',
            'ocupacion' => 'nullable|string|max:255',
            'estado_civil' => 'nullable|string|max:255',
            'relacionado_a' => 'nullable|string|max:255',
            'tipo_relacion' => 'nullable|string|max:255',
            'fecha_nacimiento' => 'nullable|date',
            'is_active' => 'sometimes|boolean',
            'cedula_vencimiento' => 'nullable|date',
            'genero' => 'nullable|string|max:255',
            'nacionalidad' => 'nullable|string|max:255',
            'telefono2' => 'nullable|string|max:50',
            'telefono3' => 'nullable|string|max:50',
            'institucion_labora' => 'nullable|string|max:255',
            'departamento_cargo' => 'nullable|string|max:255',
            'deductora_id' => ['nullable', 'integer', 'in:1,2,3'],
            'nivel_academico' => 'nullable|string|max:255',
            'profesion' => 'nullable|string|max:255',
            'sector' => 'nullable|string|max:255',
            'puesto' => 'nullable|string|max:255',
            'estado_puesto' => 'nullable|string|max:255',
            'trabajo_provincia' => 'nullable|string|max:255',
            'trabajo_canton' => 'nullable|string|max:255',
            'trabajo_distrito' => 'nullable|string|max:255',
            'trabajo_direccion' => 'nullable|string',
            'institucion_direccion' => 'nullable|string',
            'actividad_economica' => 'nullable|string|max:255',
            'tipo_sociedad' => 'nullable|string|max:255',
            'nombramientos' => 'nullable|string',
            // Campos opcionales para oportunidad (si se proporcionan)
            'monto' => 'nullable|numeric|min:0',
            'vertical' => 'nullable|string|max:255',
            'opportunity_type' => 'nullable|string|max:255',
            'create_opportunity' => 'nullable|boolean',
        ]);

        // Extraer datos de oportunidad antes de crear el lead
        $monto = $validated['monto'] ?? null;
        $vertical = $validated['vertical'] ?? null;
        $opportunityType = $validated['opportunity_type'] ?? null;
        $createOpportunity = $validated['create_opportunity'] ?? true; // Por defecto crear oportunidad
        unset($validated['monto'], $validated['vertical'], $validated['opportunity_type'], $validated['create_opportunity']);

        $leadStatus = $this->resolveStatus($validated['lead_status_id'] ?? null);
        $validated['lead_status_id'] = $leadStatus?->id;
        $validated['status'] = $leadStatus?->name ?? $validated['status'] ?? 'Activo';
        $validated['is_active'] = $validated['is_active'] ?? true;

        // Usar transacción para asegurar consistencia
        $result = DB::transaction(function () use ($validated, $monto, $vertical, $opportunityType, $createOpportunity) {
            $lead = Lead::create($validated);
            $opportunity = null;

            // Crear oportunidad automáticamente si tiene cédula y no se desactivó explícitamente
            if ($createOpportunity && !empty($validated['cedula'])) {
                $opportunity = Opportunity::create([
                    'lead_cedula' => $validated['cedula'],
                    'amount' => $monto, // Puede ser null
                    'status' => 'Pendiente',
                    'vertical' => $vertical ?? 'General',
                    'opportunity_type' => $opportunityType ?? 'Estándar',
                    'assigned_to_id' => $validated['assigned_to_id'] ?? null,
                ]);

                Log::info('Oportunidad creada automáticamente con lead', [
                    'lead_id' => $lead->id,
                    'opportunity_id' => $opportunity->id,
                    'monto' => $monto
                ]);
            }

            return [
                'lead' => $lead,
                'opportunity' => $opportunity
            ];
        });

        $result['lead']->load(['assignedAgent', 'leadStatus']);

        return response()->json([
            'lead' => $result['lead'],
            'opportunity' => $result['opportunity'],
        ], 201);
    }

    public function show($id)
    {
        $lead = Lead::with(['assignedAgent', 'leadStatus', 'documents'])->findOrFail($id);
        return response()->json($lead);
    }

    public function update(Request $request, $id)
    {
        $lead = Lead::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'apellido1' => 'sometimes|nullable|string|max:255',
            'apellido2' => 'sometimes|nullable|string|max:255',
            'cedula' => ['sometimes', 'nullable', 'string', 'max:20', Rule::unique('persons')->ignore($lead->id)],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('persons')->ignore($lead->id)],
            'phone' => 'sometimes|nullable|string|max:20',
            'status' => 'sometimes|nullable|string|max:100',
            'lead_status_id' => 'sometimes|nullable|integer|exists:lead_statuses,id',
            'assigned_to_id' => 'sometimes|nullable|exists:users,id',
            'notes' => 'sometimes|nullable|string',
            'source' => 'sometimes|nullable|string',
            'whatsapp' => 'sometimes|nullable|string|max:50',
            'tel_casa' => 'sometimes|nullable|string|max:50',
            'tel_amigo' => 'sometimes|nullable|string|max:50',
            'province' => 'sometimes|nullable|string|max:255',
            'canton' => 'sometimes|nullable|string|max:255',
            'distrito' => 'sometimes|nullable|string|max:255',
            'direccion1' => 'sometimes|nullable|string|max:255',
            'direccion2' => 'sometimes|nullable|string|max:255',
            'ocupacion' => 'sometimes|nullable|string|max:255',
            'estado_civil' => 'sometimes|nullable|string|max:255',
            'relacionado_a' => 'sometimes|nullable|string|max:255',
            'tipo_relacion' => 'sometimes|nullable|string|max:255',
            'fecha_nacimiento' => 'sometimes|nullable|date',
            'is_active' => 'sometimes|boolean',
            'cedula_vencimiento' => 'sometimes|nullable|date',
            'genero' => 'sometimes|nullable|string|max:255',
            'nacionalidad' => 'sometimes|nullable|string|max:255',
            'telefono2' => 'sometimes|nullable|string|max:50',
            'telefono3' => 'sometimes|nullable|string|max:50',
            'institucion_labora' => 'sometimes|nullable|string|max:255',
            'departamento_cargo' => 'sometimes|nullable|string|max:255',
            'deductora_id' => ['sometimes', 'nullable', 'integer', 'in:1,2,3'],
            'nivel_academico' => 'sometimes|nullable|string|max:255',
            'profesion' => 'sometimes|nullable|string|max:255',
            'sector' => 'sometimes|nullable|string|max:255',
            'puesto' => 'sometimes|nullable|string|max:255',
            'estado_puesto' => 'sometimes|nullable|string|max:255',
            'trabajo_provincia' => 'sometimes|nullable|string|max:255',
            'trabajo_canton' => 'sometimes|nullable|string|max:255',
            'trabajo_distrito' => 'sometimes|nullable|string|max:255',
            'trabajo_direccion' => 'sometimes|nullable|string',
            'institucion_direccion' => 'sometimes|nullable|string',
            'actividad_economica' => 'sometimes|nullable|string|max:255',
            'tipo_sociedad' => 'sometimes|nullable|string|max:255',
            'nombramientos' => 'sometimes|nullable|string',
        ]);

        if (array_key_exists('lead_status_id', $validated)) {
            $leadStatus = $this->resolveStatus($validated['lead_status_id']);
            $validated['lead_status_id'] = $leadStatus?->id;
            $validated['status'] = $leadStatus?->name ?? $validated['status'] ?? null;
        }

        $lead->update($validated);
        $lead->load(['assignedAgent', 'leadStatus']);

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
        $lead->is_active = !$lead->is_active;
        $lead->save();
        $lead->load('leadStatus');
        return response()->json($lead);
    }

    private function resolveStatus(?int $statusId): ?LeadStatus
    {
        if ($statusId) {
            return LeadStatus::find($statusId);
        }

        return LeadStatus::query()
            ->orderByDesc('is_default')
            ->orderBy('order_column')
            ->orderBy('id')
            ->first();
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

    public function convertToClient($id)
    {
        $lead = Lead::findOrFail($id);

        // 1: Lead, 2: Client
        $lead->person_type_id = 2;
        $lead->status = 'Activo'; // Default client status
        $lead->save();

        return response()->json($lead);
    }
}
