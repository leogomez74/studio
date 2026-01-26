<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Opportunity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use App\Models\Lead;
use App\Models\Person;
class OpportunityController extends Controller
{
    /**
     * Limpiar cédula removiendo caracteres no numéricos.
     */
    private function cleanCedula(?string $cedula): string
    {
        return preg_replace('/[^0-9]/', '', $cedula ?? '');
    }

    /**
     * Obtener la cédula limpia de una oportunidad o null si no existe.
     */
    private function getCleanCedulaFromOpportunity(Opportunity $opportunity): ?string
    {
        if (empty($opportunity->lead_cedula)) {
            return null;
        }
        return $this->cleanCedula($opportunity->lead_cedula);
    }

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

        if ($request->has('vertical')) {
            $query->where('vertical', $request->input('vertical'));
        }

        if ($request->filled('opportunity_type')) {
            $query->where('opportunity_type', $request->input('opportunity_type'));
        }

        $perPage = min((int) $request->input('per_page', 10), 100);
        $opportunities = $query->latest()->paginate($perPage);

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

        // Buscar el lead para obtener los datos del cuestionario
        $lead = Lead::where('cedula', $validated['lead_cedula'])->first();

        // DEBUG LOG
        Log::info('=== OPPORTUNITY CREATE DEBUG ===', [
            'opportunity_type_recibido' => $validated['opportunity_type'] ?? 'NO EXISTE',
            'vertical_recibido' => $validated['vertical'] ?? 'NO EXISTE',
            'amount_recibido' => $validated['amount'] ?? 'NO EXISTE',
            'lead_encontrado' => $lead ? 'SI' : 'NO',
            'lead_interes' => $lead->interes ?? 'NULL',
            'lead_tipo_credito' => $lead->tipo_credito ?? 'NULL',
        ]);

        // Valores por defecto
        $validated['status'] = $validated['status'] ?? 'Pendiente';

        // Auto-mapear vertical desde institucion_labora del lead
        if ((empty($validated['vertical']) || $validated['vertical'] === 'General') && $lead && !empty($lead->institucion_labora)) {
            $validated['vertical'] = $lead->institucion_labora;
        } else {
            $validated['vertical'] = $validated['vertical'] ?? 'General';
        }

        // Actualizar institucion_labora del lead si se seleccionó una institución en la oportunidad
        if ($lead && !empty($validated['vertical']) && $validated['vertical'] !== 'General') {
            $lead->institucion_labora = $validated['vertical'];
            $lead->save();
        }

        // Auto-mapear opportunity_type basado en el interes del cuestionario
        if ((empty($validated['opportunity_type']) || $validated['opportunity_type'] === 'Estándar') && $lead) {
            $validated['opportunity_type'] = $this->determineOpportunityType($lead);
        } else {
            $validated['opportunity_type'] = $validated['opportunity_type'] ?? 'Estándar';
        }

        // Auto-mapear amount desde el monto del cuestionario si no viene en el request
        if ((empty($validated['amount']) || $validated['amount'] == 0) && $lead && !empty($lead->monto)) {
            $validated['amount'] = $this->extractAmountFromRange($lead->monto);
        }

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

        // Actualizar institucion_labora del lead si se cambió la vertical
        if (isset($validated['vertical']) && !empty($validated['vertical']) && $validated['vertical'] !== 'General') {
            $lead = Lead::where('cedula', $opportunity->lead_cedula)->first();
            if ($lead) {
                $lead->institucion_labora = $validated['vertical'];
                $lead->save();
            }
        }

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
     * - Por ID: { "id": "25-00001-OP", "status": "Analizada" }
     * - Por filtro: { "filter": { "lead_cedula": "1-2345-6789" }, "status": "Perdida" }
     * - Por status actual: { "filter": { "current_status": "Pendiente" }, "status": "En seguimiento" }
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
     * Copiar archivos del Buzón del Cliente (PersonDocument) al Expediente de la Oportunidad.
     * Los archivos originales del lead se MANTIENEN para futuras oportunidades.
     * Estructura: documentos/{cedula}/{opportunityId}/heredados/
     *
     * @param string $cedula
     * @param string $opportunityId
     * @return array
     */
    private function moveFilesToOpportunityFolder(string $cedula, string $opportunityId): array
    {
        if (empty($cedula)) {
            return ['success' => false, 'message' => 'Cédula vacía'];
        }

        $strippedCedula = $this->cleanCedula($cedula);

        // Buscar la Persona (Lead/Cliente) por cédula (con o sin guiones)
        $person = Person::where('cedula', $cedula)
            ->orWhere('cedula', $strippedCedula)
            ->first();

        if (!$person) {
            Log::info('Persona no encontrada para copiar archivos', [
                'cedula' => $cedula,
                'stripped_cedula' => $strippedCedula
            ]);
            return ['success' => true, 'message' => 'Persona no encontrada', 'files' => []];
        }

        $personDocuments = $person->documents;

        if ($personDocuments->isEmpty()) {
            Log::info('No hay documentos en el buzón para copiar', ['cedula' => $cedula]);
            return ['success' => true, 'message' => 'No hay documentos en el buzón', 'files' => []];
        }

        // Limpiar cédula solo para el nombre de la carpeta (sin guiones)
        $cedulaLimpia = $this->cleanCedula($cedula);
        // Usar subcarpeta 'heredados' para archivos copiados del lead
        $heredadosFolder = "documentos/{$cedulaLimpia}/{$opportunityId}/heredados";
        $copiedFiles = [];

        try {
            // Crear carpeta de heredados si no existe
            if (!Storage::disk('public')->exists($heredadosFolder)) {
                Storage::disk('public')->makeDirectory($heredadosFolder);
            }

            foreach ($personDocuments as $doc) {
                // Verificar existencia física
                if (Storage::disk('public')->exists($doc->path)) {
                    $fileName = basename($doc->path);
                    $newPath = "{$heredadosFolder}/{$fileName}";

                    // Manejo de colisiones de nombre
                    if (Storage::disk('public')->exists($newPath)) {
                        $extension = pathinfo($fileName, PATHINFO_EXTENSION);
                        $nameWithoutExt = pathinfo($fileName, PATHINFO_FILENAME);
                        $timestamp = now()->format('Ymd_His');
                        $fileName = "{$nameWithoutExt}_{$timestamp}.{$extension}";
                        $newPath = "{$heredadosFolder}/{$fileName}";
                    }

                    try {
                        // COPIAR en lugar de mover - mantener archivos originales del lead
                        Storage::disk('public')->copy($doc->path, $newPath);

                        $copiedFiles[] = [
                            'original' => $doc->path,
                            'copy' => $newPath
                        ];

                        Log::info('Archivo copiado de Buzón a Oportunidad', [
                            'from' => $doc->path,
                            'to' => $newPath
                        ]);
                    } catch (\Exception $e) {
                        Log::error('Error copiando archivo individual', [
                            'file' => $doc->path,
                            'error' => $e->getMessage()
                        ]);
                    }
                } else {
                    Log::warning('Archivo físico no encontrado en buzón', ['path' => $doc->path]);
                }
            }

            return [
                'success' => true,
                'message' => 'Archivos copiados al expediente correctamente',
                'files_count' => count($copiedFiles),
                'files' => $copiedFiles
            ];

        } catch (\Exception $e) {
            Log::error('Error general copiando archivos a oportunidad', [
                'cedula' => $cedula,
                'opportunity_id' => $opportunityId,
                'error' => $e->getMessage()
            ]);

            return [
                'success' => false,
                'message' => 'Error al copiar archivos: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Endpoint para copiar archivos manualmente a una oportunidad existente.
     * Los archivos originales del lead se mantienen.
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
     * Obtener los archivos de una oportunidad (heredados + específicos).
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
                'heredados' => [],
                'especificos' => [],
                'message' => 'La oportunidad no tiene cédula asociada'
            ]);
        }

        $cedula = $this->getCleanCedulaFromOpportunity($opportunity);
        $baseFolder = "documentos/{$cedula}/{$opportunity->id}";
        $heredadosFolder = "{$baseFolder}/heredados";
        $especificosFolder = "{$baseFolder}/especificos";

        $heredados = $this->listFilesInFolder($heredadosFolder);
        $especificos = $this->listFilesInFolder($especificosFolder);

        return response()->json([
            'success' => true,
            'opportunity_id' => $opportunity->id,
            'cedula' => $cedula,
            'heredados' => $heredados,
            'especificos' => $especificos,
        ]);
    }

    /**
     * Subir un archivo específico a la oportunidad.
     * POST /api/opportunities/{id}/files
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function uploadFile(Request $request, string $id)
    {
        $request->validate([
            'file' => 'required|file|max:10240', // 10MB max
        ]);

        $opportunity = Opportunity::findOrFail($id);

        if (empty($opportunity->lead_cedula)) {
            return response()->json([
                'success' => false,
                'message' => 'La oportunidad no tiene cédula asociada'
            ], 422);
        }

        $cedula = $this->getCleanCedulaFromOpportunity($opportunity);
        $especificosFolder = "documentos/{$cedula}/{$opportunity->id}/especificos";

        try {
            if (!Storage::disk('public')->exists($especificosFolder)) {
                Storage::disk('public')->makeDirectory($especificosFolder);
            }

            $file = $request->file('file');
            $originalName = $file->getClientOriginalName();
            $path = $file->storeAs($especificosFolder, $originalName, 'public');

            return response()->json([
                'success' => true,
                'message' => 'Archivo subido correctamente',
                'file' => [
                    'name' => $originalName,
                    'path' => $path,
                    'url' => asset("storage/{$path}"),
                    'size' => $file->getSize(),
                ]
            ], 201);
        } catch (\Exception $e) {
            Log::error('Error subiendo archivo a oportunidad', [
                'opportunity_id' => $id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al subir archivo: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar un archivo de la oportunidad.
     * DELETE /api/opportunities/{id}/files/{filename}
     *
     * @param string $id
     * @param string $filename
     * @return \Illuminate\Http\JsonResponse
     */
    public function deleteFile(string $id, string $filename)
    {
        $opportunity = Opportunity::findOrFail($id);

        if (empty($opportunity->lead_cedula)) {
            return response()->json([
                'success' => false,
                'message' => 'La oportunidad no tiene cédula asociada'
            ], 422);
        }

        $cedula = $this->getCleanCedulaFromOpportunity($opportunity);
        $baseFolder = "documentos/{$cedula}/{$opportunity->id}";

        // Buscar en ambas carpetas
        $possiblePaths = [
            "{$baseFolder}/heredados/{$filename}",
            "{$baseFolder}/especificos/{$filename}",
        ];

        foreach ($possiblePaths as $path) {
            if (Storage::disk('public')->exists($path)) {
                Storage::disk('public')->delete($path);
                return response()->json([
                    'success' => true,
                    'message' => 'Archivo eliminado correctamente'
                ]);
            }
        }

        return response()->json([
            'success' => false,
            'message' => 'Archivo no encontrado'
        ], 404);
    }

    /**
     * Listar archivos en una carpeta.
     *
     * @param string $folder
     * @return array
     */
    private function listFilesInFolder(string $folder): array
    {
        if (!Storage::disk('public')->exists($folder)) {
            return [];
        }

        $files = Storage::disk('public')->files($folder);
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

        return $fileList;
    }

    /**
     * Determinar el tipo de oportunidad basado en el interes del cuestionario.
     *
     * @param \App\Models\Lead $lead
     * @return string
     */
    private function determineOpportunityType(Lead $lead): string
    {
        $interes = $lead->interes;
        $tipoCreditoValue = $lead->tipo_credito;
        $tramites = $lead->tramites; // Array gracias al cast

        // Si el interés es en crédito
        if ($interes === 'credito') {
            if ($tipoCreditoValue === 'microcredito') {
                return 'Micro Crédito';
            } elseif ($tipoCreditoValue === 'regular') {
                return 'Crédito';
            }
            return 'Crédito'; // Default si no se especifica tipo
        }

        // Si el interés es en servicios legales
        if ($interes === 'servicios_legales') {
            if (is_array($tramites) && count($tramites) > 0) {
                // Mapear el primer trámite seleccionado al tipo de oportunidad
                $tramite = $tramites[0];
                return $this->mapTramiteToOpportunityType($tramite);
            }
            return 'Servicios Legales'; // Default
        }

        // Si el interés es en ambos (crédito y servicios legales)
        if ($interes === 'ambos') {
            // Priorizar crédito si está definido
            if (!empty($tipoCreditoValue)) {
                if ($tipoCreditoValue === 'microcredito') {
                    return 'Micro Crédito';
                } elseif ($tipoCreditoValue === 'regular') {
                    return 'Crédito';
                }
                return 'Crédito';
            }
            // Si no hay tipo de crédito, revisar servicios legales
            if (is_array($tramites) && count($tramites) > 0) {
                $tramite = $tramites[0];
                return $this->mapTramiteToOpportunityType($tramite);
            }
        }

        // Default si no hay interes definido
        return 'Estándar';
    }

    /**
     * Mapear un trámite específico a un tipo de oportunidad.
     *
     * @param string $tramite
     * @return string
     */
    private function mapTramiteToOpportunityType(string $tramite): string
    {
        $mapping = [
            'divorcio' => 'Divorcio',
            'notariado' => 'Notariado',
            'testamento' => 'Testamentos',
            'testamentos' => 'Testamentos',
            'descuento_facturas' => 'Descuento de Facturas',
            'poder' => 'Poder',
            'escritura' => 'Escritura',
            'declaratoria_herederos' => 'Declaratoria de Herederos',
        ];

        $tramiteLower = strtolower($tramite);

        return $mapping[$tramiteLower] ?? ucfirst($tramite);
    }

    /**
     * Extraer un monto numérico desde el rango de monto del cuestionario.
     * Ejemplos: "100k-250k" -> 175000, "1.7m-2.2m" -> 1950000
     *
     * @param string $rangoMonto
     * @return float
     */
    private function extractAmountFromRange(string $rangoMonto): float
    {
        // Mapping de rangos del cuestionario a valores numéricos (promedio del rango)
        $rangosMap = [
            '100k-250k' => 175000,
            '250k-450k' => 350000,
            '450k-690k' => 570000,
            '690k-1m' => 845000,
            '1m-1.7m' => 1350000,
            '1.7m-2.2m' => 1950000,
        ];

        // Buscar coincidencia exacta
        if (isset($rangosMap[$rangoMonto])) {
            return $rangosMap[$rangoMonto];
        }

        // Si no coincide, intentar parsear manualmente
        // Ejemplo: "300k-450k" o "100,000 - 250,000"
        $rangoMonto = strtolower(str_replace([' ', ',', '₡'], '', $rangoMonto));

        if (preg_match('/(\d+(?:\.\d+)?)(k|m)?-(\d+(?:\.\d+)?)(k|m)?/', $rangoMonto, $matches)) {
            $min = (float) $matches[1];
            $max = (float) $matches[3];

            // Convertir k (miles) y m (millones)
            if (isset($matches[2]) && $matches[2] === 'k') $min *= 1000;
            if (isset($matches[2]) && $matches[2] === 'm') $min *= 1000000;
            if (isset($matches[4]) && $matches[4] === 'k') $max *= 1000;
            if (isset($matches[4]) && $matches[4] === 'm') $max *= 1000000;

            // Retornar el promedio
            return ($min + $max) / 2;
        }

        // Default: retornar 0 si no se puede parsear
        return 0;
    }
}
