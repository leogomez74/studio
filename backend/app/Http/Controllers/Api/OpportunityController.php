<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Opportunity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class OpportunityController extends Controller
{
    public function index(Request $request)
    {
        $query = Opportunity::query()
            ->select([
                'id', 'lead_cedula', 'opportunity_type', 'vertical',
                'amount', 'status', 'expected_close_date', 'comments',
                'assigned_to_id', 'created_at', 'updated_at'
            ])
            ->with([
                'lead:id,cedula,name,email,phone',
                'user:id,name'
            ]);

        if ($request->has('status') && $request->input('status') !== 'todos') {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('search')) {
            $search = $request->input('search');
            $cleanSearch = ltrim($search, '#');
            $strippedSearch = preg_replace('/[^0-9]/', '', $search);

            $query->where(function ($q) use ($search, $cleanSearch, $strippedSearch) {
                $q->where('id', 'like', "%{$cleanSearch}%")
                ->orWhere('lead_cedula', 'like', "%{$search}%")
                ->orWhere('opportunity_type', 'like', "%{$search}%")
                ->orWhere('vertical', 'like', "%{$search}%")
                ->orWhere('comments', 'like', "%{$search}%")
                ->orWhereHas('lead', function ($qLead) use ($search) {
                    $qLead->where('name', 'like', "%{$search}%")
                          ->orWhere('email', 'like', "%{$search}%");
                });

                // Buscar por ID y cédula sin guiones
                if (!empty($strippedSearch)) {
                    $q->orWhereRaw("REPLACE(id, '-', '') LIKE ?", ["%{$strippedSearch}%"])
                      ->orWhere('lead_cedula', 'like', "%{$strippedSearch}%")
                      ->orWhereHas('lead', function ($qLead) use ($strippedSearch) {
                          $qLead->where('cedula', 'like', "%{$strippedSearch}%");
                      });
                }
            });
        }
        if ($request->has('lead_cedula')) {
            $query->where('lead_cedula', $request->input('lead_cedula'));
        }

        if ($request->has('assigned_to_id')) {
            $query->where('assigned_to_id', $request->input('assigned_to_id'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
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
            'amount' => 'nullable|numeric|min:0',
            'status' => 'nullable|string',
            'expected_close_date' => 'nullable|date',
            'comments' => 'nullable|string',
            'assigned_to_id' => 'nullable|exists:users,id',
        ]);

        // Valores por defecto
        $validated['status'] = $validated['status'] ?? 'Nueva';
        $validated['vertical'] = $validated['vertical'] ?? 'General';
        $validated['opportunity_type'] = $validated['opportunity_type'] ?? 'Estándar';

        // Crear la oportunidad
        $opportunity = Opportunity::create($validated);

        // Usar el ID de la oportunidad para crear la carpeta y mover archivos
        $moveResult = $this->moveFilesToOpportunityFolder(
            $validated['lead_cedula'],
            $opportunity->id
        );

        return response()->json([
            'opportunity' => $opportunity,
            'files_moved' => $moveResult
        ], 201);
    }

    public function show(string $id)
    {
        $opportunity = Opportunity::with(['lead', 'user','lead.documents'])->findOrFail($id);
        return response()->json($opportunity, 200);
    }

    public function update(Request $request, string $id)
    {
        $opportunity = Opportunity::findOrFail($id);

        $validated = $request->validate([
            'lead_cedula' => 'sometimes|string|exists:persons,cedula',
            'opportunity_type' => 'sometimes|nullable|string',
            'vertical' => 'sometimes|nullable|string',
            'amount' => 'sometimes|nullable|numeric|min:0',
            'status' => 'sometimes|nullable|string',
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

    /**
     * Actualizar el status de oportunidades por ID o filtros.
     * PATCH /api/opportunities/update-status
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     *
     * Ejemplos de uso:
     * - Por ID: { "id": "25-00001-OP", "status": "Ganada" }
     * - Por filtro: { "filter": { "lead_cedula": "1-2345-6789" }, "status": "Perdida" }
     * - Por status actual: { "filter": { "current_status": "Nueva" }, "status": "En Proceso" }
     */
    public function updateStatus(Request $request)
    {
        $validated = $request->validate([
            'status' => 'required|string',
            'id' => 'sometimes|string',
            'filter' => 'sometimes|array',
            'filter.lead_cedula' => 'sometimes|string',
            'filter.current_status' => 'sometimes|string',
            'filter.assigned_to_id' => 'sometimes|integer',
            'filter.vertical' => 'sometimes|string',
        ]);

        $newStatus = $validated['status'];

        // Caso 1: Actualizar por ID específico
        if (!empty($validated['id'])) {
            $opportunity = Opportunity::findOrFail($validated['id']);
            $oldStatus = $opportunity->status;
            $opportunity->update(['status' => $newStatus]);

            Log::info('Status de oportunidad actualizado', [
                'id' => $opportunity->id,
                'old_status' => $oldStatus,
                'new_status' => $newStatus
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Status actualizado correctamente',
                'opportunity' => $opportunity,
                'old_status' => $oldStatus,
                'new_status' => $newStatus
            ]);
        }

        // Caso 2: Actualizar por filtros (bulk update)
        if (!empty($validated['filter'])) {
            $query = Opportunity::query();
            $filter = $validated['filter'];
            $hasValidFilter = false;

            if (!empty($filter['lead_cedula'])) {
                $query->where('lead_cedula', $filter['lead_cedula']);
                $hasValidFilter = true;
            }

            if (!empty($filter['current_status'])) {
                $query->where('status', $filter['current_status']);
                $hasValidFilter = true;
            }

            if (!empty($filter['assigned_to_id'])) {
                $query->where('assigned_to_id', $filter['assigned_to_id']);
                $hasValidFilter = true;
            }

            if (!empty($filter['vertical'])) {
                $query->where('vertical', $filter['vertical']);
                $hasValidFilter = true;
            }

            // Evitar actualizar TODAS las oportunidades si no hay filtros válidos
            if (!$hasValidFilter) {
                return response()->json([
                    'success' => false,
                    'message' => 'Debe proporcionar al menos un filtro válido (lead_cedula, current_status, assigned_to_id, o vertical)'
                ], 422);
            }

            $count = $query->count();

            if ($count === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontraron oportunidades con los filtros especificados',
                    'updated_count' => 0
                ], 404);
            }

            $query->update(['status' => $newStatus, 'updated_at' => now()]);

            Log::info('Status de oportunidades actualizado en bulk', [
                'filter' => $filter,
                'new_status' => $newStatus,
                'count' => $count
            ]);

            return response()->json([
                'success' => true,
                'message' => "Se actualizaron {$count} oportunidad(es)",
                'updated_count' => $count,
                'new_status' => $newStatus
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Debe proporcionar un ID o filtros para actualizar'
        ], 422);
    }

    /**
     * Mover archivos del Buzón del Cliente (PersonDocument) al Expediente de la Oportunidad.
     *
     * @param string $cedula
     * @param string $opportunityId
     * @return array
     */
    private function moveFilesToOpportunityFolder(string $cedula, string $opportunityId): array
    {
        $cedula = preg_replace('/[^0-9]/', '', $cedula);

        if (empty($cedula)) {
            return ['success' => false, 'message' => 'Cédula vacía'];
        }

        // Buscar la Persona (Lead/Cliente) por cédula
        $person = \App\Models\Person::where('cedula', $cedula)->first();

        if (!$person) {
            Log::info('Persona no encontrada para mover archivos', ['cedula' => $cedula]);
            return ['success' => true, 'message' => 'Persona no encontrada', 'files' => []];
        }

        $personDocuments = $person->documents;

        if ($personDocuments->isEmpty()) {
            return ['success' => true, 'message' => 'No hay documentos en el buzón', 'files' => []];
        }

        $opportunityFolder = "documentos/{$cedula}/{$opportunityId}";
        $movedFiles = [];

        try {
            // Crear carpeta de oportunidad si no existe
            if (!Storage::disk('public')->exists($opportunityFolder)) {
                Storage::disk('public')->makeDirectory($opportunityFolder);
            }

            foreach ($personDocuments as $doc) {
                // Verificar existencia física
                if (Storage::disk('public')->exists($doc->path)) {
                    $fileName = basename($doc->path);
                    $newPath = "{$opportunityFolder}/{$fileName}";

                    // Manejo de colisiones de nombre
                    if (Storage::disk('public')->exists($newPath)) {
                        $extension = pathinfo($fileName, PATHINFO_EXTENSION);
                        $nameWithoutExt = pathinfo($fileName, PATHINFO_FILENAME);
                        $timestamp = now()->format('Ymd_His');
                        $fileName = "{$nameWithoutExt}_{$timestamp}.{$extension}";
                        $newPath = "{$opportunityFolder}/{$fileName}";
                    }

                    try {
                        // 1. Mover físicamente
                        Storage::disk('public')->move($doc->path, $newPath);
                        
                        $movedFiles[] = [
                            'original' => $doc->path,
                            'new' => $newPath
                        ];

                        // 2. Eliminar registro del Buzón (PersonDocument)
                        $doc->delete();

                        Log::info('Archivo movido de Buzón a Oportunidad', [
                            'from' => $doc->path,
                            'to' => $newPath
                        ]);
                    } catch (\Exception $e) {
                        Log::error('Error moviendo archivo individual', [
                            'file' => $doc->path,
                            'error' => $e->getMessage()
                        ]);
                    }
                } else {
                    // Si el archivo físico no existe pero el registro sí, eliminamos el registro huérfano
                    Log::warning('Archivo físico no encontrado, eliminando registro huérfano', ['path' => $doc->path]);
                    $doc->delete();
                }
            }

            return [
                'success' => true,
                'message' => 'Archivos movidos al expediente correctamente',
                'files_count' => count($movedFiles),
                'files' => $movedFiles
            ];

        } catch (\Exception $e) {
            Log::error('Error general moviendo archivos a oportunidad', [
                'cedula' => $cedula,
                'opportunity_id' => $opportunityId,
                'error' => $e->getMessage()
            ]);

            return [
                'success' => false,
                'message' => 'Error al mover archivos: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Endpoint para mover archivos manualmente a una oportunidad existente.
     * POST /api/opportunities/{id}/move-files
     *
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function moveFiles(string $id)
    {
        $opportunity = Opportunity::findOrFail($id);

        if (empty($opportunity->lead_cedula)) {
            return response()->json([
                'success' => false,
                'message' => 'La oportunidad no tiene cédula asociada'
            ], 422);
        }

        $result = $this->moveFilesToOpportunityFolder(
            $opportunity->lead_cedula,
            $opportunity->id
        );

        $statusCode = $result['success'] ? 200 : 500;

        return response()->json($result, $statusCode);
    }

    /**
     * Obtener los archivos de una oportunidad.
     * GET /api/opportunities/{id}/files
     *
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function getFiles(string $id)
    {
        $opportunity = Opportunity::findOrFail($id);

        if (empty($opportunity->lead_cedula)) {
            return response()->json([
                'success' => true,
                'files' => [],
                'message' => 'La oportunidad no tiene cédula asociada'
            ]);
        }

        $cedula = preg_replace('/[^0-9]/', '', $opportunity->lead_cedula);
        $opportunityFolder = "documentos/{$cedula}/{$opportunity->id}";

        if (!Storage::disk('public')->exists($opportunityFolder)) {
            return response()->json([
                'success' => true,
                'files' => [],
            ]);
        }

        $files = Storage::disk('public')->files($opportunityFolder);
        $fileList = [];

        foreach ($files as $file) {
            $fileList[] = [
                'name' => basename($file),
                'path' => $file,
                'url' => asset("storage/{$file}"),
                'size' => Storage::disk('public')->size($file),
                'last_modified' => Storage::disk('public')->lastModified($file),
            ];
        }

        return response()->json([
            'success' => true,
            'opportunity_id' => $opportunity->id,
            'folder' => $opportunityFolder,
            'files' => $fileList,
        ]);
    }
}
