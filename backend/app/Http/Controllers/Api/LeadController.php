<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\Person;
use App\Models\LeadStatus;
use App\Models\Opportunity;
use App\Models\Task;
use App\Models\TaskAutomation;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class LeadController extends Controller
{
    public function index(Request $request)
    {
        $activeFilter = $this->resolveActiveFilter($request);

        $query = Lead::query()
            ->select([
                'id', 'name', 'apellido1', 'apellido2', 'cedula',
                'email', 'phone', 'lead_status_id', 'is_active',
                'assigned_to_id', 'deductora_id', 'created_at', 'updated_at',
                // Campos básicos adicionales
                'sector', 'whatsapp', 'fecha_nacimiento', 'estado_civil',
                // Información laboral
                'profesion', 'nivel_academico', 'puesto', 'institucion_labora',
                // Dirección personal
                'province', 'canton', 'distrito', 'direccion1', 'direccion2',
                // Dirección de trabajo
                'trabajo_provincia', 'trabajo_canton', 'trabajo_distrito', 'trabajo_direccion'
            ])
            ->with([
                'assignedAgent:id,name',
                'leadStatus:id,name,slug',
                'documents:id,person_id,name,category,created_at',
                'opportunities:id,lead_cedula,opportunity_type,amount,status,expected_close_date,created_at'
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

        // Si se solicita 'all', retornar sin paginar
        if ($request->get('all') === 'true') {
            return response()->json($query->latest()->get());
        }

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
            'deductora_id' => ['nullable', 'integer', 'exists:deductoras,id'],
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
            'product_id' => 'nullable|integer|exists:products,id',
            'vertical' => 'nullable|string|max:255',
            'opportunity_type' => 'nullable|string|max:255',
            'create_opportunity' => 'nullable|boolean',
        ]);

        // Extraer datos de oportunidad antes de crear el lead
        $monto = $validated['monto'] ?? null;
        $productId = $validated['product_id'] ?? null;
        $vertical = $validated['vertical'] ?? null;
        $opportunityType = $validated['opportunity_type'] ?? null;
        $createOpportunity = $validated['create_opportunity'] ?? true; // Por defecto crear oportunidad

        // Si hay product_id, obtener el nombre del producto para usar como vertical Y opportunity_type
        if ($productId) {
            $product = \App\Models\Product::find($productId);
            if ($product) {
                $productName = $product->name;
                if (!$vertical) {
                    $vertical = $productName;
                }
                if (!$opportunityType) {
                    $opportunityType = $productName;
                }
            }
        }

        unset($validated['monto'], $validated['product_id'], $validated['vertical'], $validated['opportunity_type'], $validated['create_opportunity']);

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
                    'monto' => $monto,
                    'producto' => $opportunityType
                ]);
            }

            return [
                'lead' => $lead,
                'opportunity' => $opportunity
            ];
        });

        $result['lead']->load(['assignedAgent', 'leadStatus']);

        // Crear tarea automática si está configurada
        try {
            $automation = TaskAutomation::where('event_type', 'lead_created')
                ->where('is_active', true)
                ->first();

            if ($automation && $automation->assigned_to) {
                Task::create([
                    'project_code' => (string) $result['lead']->id,
                    'title' => $automation->title,
                    'status' => 'pendiente',
                    'priority' => $automation->priority ?? 'media',
                    'assigned_to' => $automation->assigned_to,
                    'start_date' => now()->toDateString(),
                    'due_date' => now()->toDateString(),
                ]);
                Log::info('Tarea automática creada para lead', ['cedula' => $result['lead']->cedula]);
            }

            // Tarea automática para la oportunidad creada junto con el lead
            if ($result['opportunity']) {
                $oppAutomation = TaskAutomation::where('event_type', 'opportunity_created')
                    ->where('is_active', true)
                    ->first();

                if ($oppAutomation && $oppAutomation->assigned_to) {
                    Task::create([
                        'project_code' => (string) $result['opportunity']->id,
                        'title' => $oppAutomation->title,
                        'status' => 'pendiente',
                        'priority' => $oppAutomation->priority ?? 'media',
                        'assigned_to' => $oppAutomation->assigned_to,
                        'start_date' => now()->toDateString(),
                        'due_date' => now()->toDateString(),
                    ]);
                    Log::info('Tarea automática creada para oportunidad', ['opportunity_id' => $result['opportunity']->id]);
                }
            }
        } catch (\Exception $e) {
            Log::error('Error creando tarea automática', ['error' => $e->getMessage()]);
        }

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
            'deductora_id' => ['sometimes', 'nullable', 'integer', 'exists:deductoras,id'],
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

    public function deleteByCedula(Request $request)
    {
        $cedula = $request->input('cedula');

        if (!$cedula) {
            return response()->json([
                'success' => false,
                'message' => 'Cédula es requerida'
            ], 400);
        }

        try {
            DB::beginTransaction();

            // Buscar la persona por cédula
            $person = DB::table('persons')->where('cedula', $cedula)->first();

            if (!$person) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontró ningún registro con esa cédula'
                ], 404);
            }

            // Contadores para documentos eliminados
            $deletedPersonDocs = 0;
            $deletedCreditDocs = 0;

            // 1. Eliminar documentos físicos de la persona
            $personDocuments = DB::table('person_documents')
                ->where('person_id', $person->id)
                ->get();

            foreach ($personDocuments as $doc) {
                if ($doc->path && \Storage::disk('public')->exists($doc->path)) {
                    \Storage::disk('public')->delete($doc->path);
                    $deletedPersonDocs++;
                }
            }

            // Buscar oportunidades asociadas
            $opportunities = DB::table('opportunities')
                ->where('lead_cedula', $cedula)
                ->pluck('id');

            if ($opportunities->isNotEmpty()) {
                // 2. Buscar créditos y eliminar sus documentos físicos
                $credits = DB::table('credits')
                    ->whereIn('opportunity_id', $opportunities)
                    ->pluck('id');

                if ($credits->isNotEmpty()) {
                    $creditDocuments = DB::table('credit_documents')
                        ->whereIn('credit_id', $credits)
                        ->get();

                    foreach ($creditDocuments as $doc) {
                        if ($doc->path && \Storage::disk('public')->exists($doc->path)) {
                            \Storage::disk('public')->delete($doc->path);
                            $deletedCreditDocs++;
                        }
                    }

                    // Eliminar créditos (CASCADE eliminará credit_documents de la BD)
                    $deletedCredits = DB::table('credits')
                        ->whereIn('id', $credits)
                        ->delete();
                }

                // Buscar análisis y eliminar propuestas asociadas
                $analisisRefs = DB::table('analisis')
                    ->whereIn('opportunity_id', $opportunities)
                    ->pluck('reference');

                if ($analisisRefs->isNotEmpty()) {
                    DB::table('propuestas')
                        ->whereIn('analisis_reference', $analisisRefs)
                        ->delete();
                }

                // Eliminar análisis
                $deletedAnalisis = DB::table('analisis')
                    ->whereIn('opportunity_id', $opportunities)
                    ->delete();

                // Eliminar las oportunidades
                $deletedOpportunities = DB::table('opportunities')
                    ->whereIn('id', $opportunities)
                    ->delete();
            }

            // Finalmente, eliminar la persona (CASCADE eliminará person_documents de la BD)
            $deletedPerson = DB::table('persons')->where('id', $person->id)->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Registro y documentos eliminados correctamente',
                'deleted' => [
                    'person' => $deletedPerson,
                    'opportunities' => $deletedOpportunities ?? 0,
                    'analisis' => $deletedAnalisis ?? 0,
                    'credits' => $deletedCredits ?? 0,
                    'person_documents_files' => $deletedPersonDocs,
                    'credit_documents_files' => $deletedCreditDocs
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error eliminando por cédula: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar el registro: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk archive/restore leads
     * PATCH /api/leads/bulk-archive
     *
     * @param Request $request - Expects { ids: [1, 2, 3], action: 'archive'|'restore' }
     * @return \Illuminate\Http\JsonResponse
     */
    public function bulkArchive(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1|max:' . config('bulk-actions.max_items_per_request', 50),
            'ids.*' => 'required|integer|exists:persons,id',
            'action' => 'required|in:archive,restore'
        ]);

        $ids = $validated['ids'];
        $action = $validated['action'];
        $isActive = ($action === 'restore'); // restore = is_active true, archive = is_active false

        $successful = 0;
        $failed = 0;
        $errors = [];

        try {
            DB::beginTransaction();

            foreach ($ids as $id) {
                try {
                    // Use Person model instead of Lead to handle both Leads and Clients
                    // (Lead model has global scope that filters person_type_id=1)
                    $person = Person::findOrFail($id);

                    // Only process if person_type_id is 1 (Lead) or 2 (Client)
                    if (!in_array($person->person_type_id, [1, 2])) {
                        $failed++;
                        $errors[] = [
                            'id' => $id,
                            'message' => "Registro #{$id} no es un Lead o Cliente válido"
                        ];
                        continue;
                    }

                    $person->is_active = $isActive;
                    $person->save();
                    $successful++;

                } catch (\Exception $e) {
                    $failed++;
                    $errors[] = [
                        'id' => $id,
                        'message' => $e->getMessage()
                    ];
                }
            }

            if (config('bulk-actions.use_transactions', true)) {
                DB::commit();
            }

            $actionText = $action === 'archive' ? 'archivados' : 'restaurados';

            return response()->json([
                'success' => true,
                'data' => [
                    'successful' => $successful,
                    'failed' => $failed,
                    'errors' => $errors
                ],
                'message' => "$successful registros $actionText correctamente"
            ]);

        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Error al archivar/restaurar',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk convert leads to clients
     * POST /api/leads/bulk-convert
     *
     * @param Request $request - Expects { ids: [1, 2, 3] }
     * @return \Illuminate\Http\JsonResponse
     */
    public function bulkConvert(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1|max:' . config('bulk-actions.max_items_per_request', 50),
            'ids.*' => 'required|integer|exists:persons,id'
        ]);

        $ids = $validated['ids'];
        $successful = 0;
        $failed = 0;
        $errors = [];

        try {
            DB::beginTransaction();

            foreach ($ids as $id) {
                try {
                    $lead = Lead::findOrFail($id);

                    // Verify it's actually a Lead (person_type_id = 1)
                    if ($lead->person_type_id !== 1) {
                        $failed++;
                        $errors[] = [
                            'id' => $id,
                            'message' => "Registro #{$id} no es un Lead"
                        ];
                        continue;
                    }

                    // Verify lead is active
                    if (!$lead->is_active) {
                        $failed++;
                        $errors[] = [
                            'id' => $id,
                            'message' => "Lead #{$id} está archivado"
                        ];
                        continue;
                    }

                    // Convert: 1 (Lead) -> 2 (Client)
                    $lead->person_type_id = 2;
                    $lead->status = 'Activo'; // Default client status
                    $lead->save();
                    $successful++;

                } catch (\Exception $e) {
                    $failed++;
                    $errors[] = [
                        'id' => $id,
                        'message' => $e->getMessage()
                    ];
                }
            }

            if (config('bulk-actions.use_transactions', true)) {
                DB::commit();
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'successful' => $successful,
                    'failed' => $failed,
                    'errors' => $errors
                ],
                'message' => "$successful leads convertidos a clientes correctamente"
            ]);

        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Error al convertir leads',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Buscar persons (leads y clientes) con autocompletar
     * Búsqueda insensitive en nombre, apellidos y cédula
     */
    public function search(Request $request)
    {
        $query = $request->input('q', '');

        if (strlen($query) < 2) {
            return response()->json([]);
        }

        // Buscar solo en Clientes (person_type_id = 2)
        $results = Person::select('id', 'name', 'apellido1', 'apellido2', 'cedula', 'person_type_id')
            ->where(function($q) use ($query) {
                $q->where('name', 'LIKE', "%{$query}%")
                  ->orWhere('apellido1', 'LIKE', "%{$query}%")
                  ->orWhere('apellido2', 'LIKE', "%{$query}%")
                  ->orWhere('cedula', 'LIKE', "%{$query}%");
            })
            ->where('is_active', true)
            ->where('person_type_id', 2) // Solo clientes
            ->limit(20)
            ->get()
            ->map(function($person) {
                $fullName = trim("{$person->name} {$person->apellido1} {$person->apellido2}");

                return [
                    'id' => $person->id,
                    'name' => $fullName,
                    'cedula' => $person->cedula,
                    'type' => 'Cliente',
                    'label' => $fullName . ($person->cedula ? " ({$person->cedula})" : '')
                ];
            });

        return response()->json($results);
    }
}
