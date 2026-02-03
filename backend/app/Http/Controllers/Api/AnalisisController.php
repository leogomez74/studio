<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAnalisisRequest;
use App\Http\Requests\UpdateAnalisisRequest;
use App\Models\Analisis;
use App\Models\Lead;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class AnalisisController extends Controller
{
    /**
     * Limpiar cédula removiendo caracteres no numéricos.
     */
    private function cleanCedula(?string $cedula): string
    {
        return preg_replace('/[^0-9]/', '', $cedula ?? '');
    }

    /**
     * Obtener la cédula limpia desde un análisis (vía lead u oportunidad).
     */
    private function getCedulaFromAnalisis(Analisis $analisis): ?string
    {
        if ($analisis->lead && !empty($analisis->lead->cedula)) {
            return $this->cleanCedula($analisis->lead->cedula);
        }
        if ($analisis->opportunity && !empty($analisis->opportunity->lead_cedula)) {
            return $this->cleanCedula($analisis->opportunity->lead_cedula);
        }
        return null;
    }

    public function index(Request $request)
    {
        $perPage = min((int) $request->input('per_page', 10), 100);

        $query = Analisis::with(['opportunity', 'lead', 'propuestas']);

        // Filtro de búsqueda (referencia, nombre del lead, cédula)
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('reference', 'like', "%{$search}%")
                  ->orWhereHas('lead', function ($leadQuery) use ($search) {
                      $leadQuery->where('name', 'like', "%{$search}%")
                                ->orWhere('cedula', 'like', "%{$search}%");
                  });
            });
        }

        // Filtro por estado PEP
        if ($estadoPep = $request->input('estado_pep')) {
            $query->where('estado_pep', $estadoPep);
        }

        // Filtro por estado Cliente
        if ($estadoCliente = $request->input('estado_cliente')) {
            $query->where('estado_cliente', $estadoCliente);
        }

        // Filtro por categoría/producto
        if ($category = $request->input('category')) {
            $query->where('category', $category);
        }

        // Filtro por rango de fechas
        if ($dateFrom = $request->input('date_from')) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo = $request->input('date_to')) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $analisis = $query->orderBy('created_at', 'desc')->paginate($perPage);

        // Agregar información de si tiene crédito asociado y su ID
        $analisis->getCollection()->transform(function ($item) {
            $item->has_credit = $item->has_credit;
            $item->credit_id = $item->credit_id;
            return $item;
        });

        return response()->json($analisis);
    }

    public function store(StoreAnalisisRequest $request)
    {
        $validated = $request->validated();

        // Verificar si ya existe un análisis para esta oportunidad
        if (!empty($validated['opportunity_id'])) {
            $existingAnalisis = Analisis::where('opportunity_id', $validated['opportunity_id'])->first();
            if ($existingAnalisis) {
                return response()->json([
                    'message' => 'Ya existe un análisis para esta oportunidad',
                    'analisis' => $existingAnalisis,
                    'redirect_to' => $existingAnalisis->id,
                ], 409); // 409 Conflict
            }
        }

        // Valor por defecto para estado_pep
        if (!isset($validated['estado_pep'])) {
            $validated['estado_pep'] = 'Pendiente';
        }

        // Auto-mapear category basado en la oportunidad o el lead
        if (!isset($validated['category'])) {
            $validated['category'] = $this->determineCategoryFromData($validated);
        }

        // Si no se especificó assigned_to, asignar al responsable default de leads
        if (empty($validated['assigned_to'])) {
            $defaultAssignee = \App\Models\User::where('is_default_lead_assignee', true)->first();
            if ($defaultAssignee) {
                $validated['assigned_to'] = $defaultAssignee->id;
            }
        }

        $analisis = Analisis::create($validated);

        // Copiar archivos de la oportunidad al análisis si existe opportunity_id
        if (!empty($validated['opportunity_id'])) {
            Log::info('Analisis store - opportunity_id received', [
                'opportunity_id' => $validated['opportunity_id'],
                'type' => gettype($validated['opportunity_id']),
            ]);
            $copyResult = $this->copyFilesFromOpportunity($validated['opportunity_id'], $analisis->id);
            Log::info('Archivos copiados de oportunidad a análisis', $copyResult);
        }

        return response()->json($analisis, 201);
    }

    public function show(int $id)
    {
        $analisis = Analisis::with(['opportunity', 'lead', 'propuestas.aceptadaPorUser:id,name'])->findOrFail($id);

        // Agregar información de si tiene crédito asociado y su ID
        $analisis->has_credit = $analisis->has_credit;
        $analisis->credit_id = $analisis->credit_id;

        return response()->json($analisis);
    }

    public function update(UpdateAnalisisRequest $request, $id)
    {
        $analisis = Analisis::findOrFail($id);
        $validated = $request->validated();

        // Validar monto máximo de aprobación para acciones de decisión (aceptar, rechazar, aprobar)
        $user = $request->user();
        $montoMaximo = $user->monto_max_aprobacion ?? -1;

        // Verificar si se está tomando una decisión sobre el análisis
        $isAceptandoPep = isset($validated['estado_pep']) && $validated['estado_pep'] === 'Aceptado';
        $isRechazandoPep = isset($validated['estado_pep']) && $validated['estado_pep'] === 'Rechazado';
        $isAprobandoCliente = isset($validated['estado_cliente']) && $validated['estado_cliente'] === 'Aprobado';
        $isRechazandoCliente = isset($validated['estado_cliente']) && $validated['estado_cliente'] === 'Rechazado';

        // Requiere autorización para: aceptar, rechazar, aprobar
        $requiereAutorizacion = $isAceptandoPep || $isRechazandoPep || $isAprobandoCliente || $isRechazandoCliente;

        if ($requiereAutorizacion) {
            // Si el usuario tiene un límite (no es -1), validar el monto
            $montoAnalisis = $analisis->monto_sugerido ?? 0;
            if ($montoMaximo != -1 && $montoAnalisis > $montoMaximo) {
                $accion = ($isAceptandoPep || $isAprobandoCliente) ? 'aprobar' : 'rechazar';
                return response()->json([
                    'message' => 'No tiene autorización para ' . $accion . ' este análisis. Su usuario (' . $user->name . ') solo puede tomar decisiones sobre análisis hasta ₡' . number_format((float)$montoMaximo, 2) . '. El monto de este análisis es ₡' . number_format((float)$montoAnalisis, 2) . '.',
                    'monto_sugerido' => $montoAnalisis,
                    'monto_max_aprobacion' => $montoMaximo,
                    'usuario' => $user->name,
                ], 403);
            }
        }

        // Si estado_pep no es "Aceptado", limpiar estado_cliente
        if (isset($validated['estado_pep']) && $validated['estado_pep'] !== 'Aceptado') {
            $validated['estado_cliente'] = null;
        }

        $analisis->update($validated);

        // Si estado_cliente cambia a "Aprobado", convertir Lead a Cliente
        if (isset($validated['estado_cliente']) && $validated['estado_cliente'] === 'Aprobado') {
            // Buscar el Lead asociado (sin el Global Scope)
            if ($analisis->lead_id) {
                $lead = Lead::withoutGlobalScopes()->find($analisis->lead_id);
                if ($lead && $lead->person_type_id === 1) {
                    $lead->person_type_id = 2; // Convertir a Cliente
                    $lead->save();
                    Log::info('Lead convertido a Cliente', ['lead_id' => $lead->id, 'analisis_id' => $analisis->id]);
                }
            }
        }

        return response()->json($analisis);
    }

    public function destroy($id)
    {
        $analisis = Analisis::findOrFail($id);
        $analisis->delete();
        return response()->json(null, 204);
    }

    /**
     * Determinar la categoría del análisis basado en la oportunidad o el lead.
     *
     * @param array $data
     * @return string
     */
    private function determineCategoryFromData(array $data): string
    {
        // Si hay opportunity_id, buscar la oportunidad y usar su tipo
        if (!empty($data['opportunity_id'])) {
            $opportunity = \App\Models\Opportunity::find($data['opportunity_id']);
            if ($opportunity) {
                return $this->mapOpportunityTypeToCategory($opportunity->opportunity_type);
            }
        }

        // Si hay lead_id, buscar el lead y usar su interes
        if (!empty($data['lead_id'])) {
            $lead = \App\Models\Lead::find($data['lead_id']);
            if ($lead) {
                return $this->mapInteresToCategory($lead->interes);
            }
        }

        // Default
        return 'General';
    }

    /**
     * Mapear el tipo de oportunidad a una categoría de análisis.
     *
     * @param string|null $opportunityType
     * @return string
     */
    private function mapOpportunityTypeToCategory(?string $opportunityType): string
    {
        if (!$opportunityType) {
            return 'General';
        }

        $creditTypes = ['Crédito', 'Micro Crédito'];
        $legalTypes = ['Divorcio', 'Notariado', 'Testamentos', 'Descuento de Facturas', 'Poder', 'Escritura', 'Declaratoria de Herederos'];

        if (in_array($opportunityType, $creditTypes)) {
            return 'Crédito';
        }

        if (in_array($opportunityType, $legalTypes)) {
            return 'Servicios Legales';
        }

        return 'General';
    }

    /**
     * Mapear el interes del lead a una categoría de análisis.
     *
     * @param string|null $interes
     * @return string
     */
    private function mapInteresToCategory(?string $interes): string
    {
        if ($interes === 'credito') {
            return 'Crédito';
        }

        if ($interes === 'servicios_legales') {
            return 'Servicios Legales';
        }

        if ($interes === 'ambos') {
            return 'Crédito'; // Priorizar crédito
        }

        return 'General';
    }

    // =====================================================================
    // MANEJO DE DOCUMENTOS DEL ANÁLISIS
    // =====================================================================

    /**
     * Copiar archivos de la oportunidad al análisis.
     * Los archivos se copian a: documentos/{cedula}/analisis/{analisisId}/heredados/
     * Se copian tanto los archivos heredados como los específicos de la oportunidad.
     *
     * @param int|string $opportunityId
     * @param int $analisisId
     * @return array
     */
    private function copyFilesFromOpportunity($opportunityId, int $analisisId): array
    {
        Log::info('copyFilesFromOpportunity called', [
            'opportunity_id' => $opportunityId,
            'analisis_id' => $analisisId,
        ]);

        $opportunity = \App\Models\Opportunity::find($opportunityId);

        if (!$opportunity || empty($opportunity->lead_cedula)) {
            Log::warning('Opportunity not found or missing cedula', [
                'opportunity_id' => $opportunityId,
                'opportunity_exists' => $opportunity ? true : false,
                'lead_cedula' => $opportunity?->lead_cedula,
            ]);
            return ['success' => false, 'message' => 'Oportunidad no encontrada o sin cédula'];
        }

        $cedula = $this->cleanCedula($opportunity->lead_cedula);
        $baseFolder = "documentos/{$cedula}/{$opportunityId}";
        $targetFolder = "documentos/{$cedula}/analisis/{$analisisId}/heredados";

        // Carpetas fuente: heredados y específicos de la oportunidad
        $sourceFolders = [
            "{$baseFolder}/heredados",
            "{$baseFolder}/especificos",
        ];

        $copiedFiles = [];

        try {
            // Crear carpeta de análisis si no existe
            if (!Storage::disk('public')->exists($targetFolder)) {
                Storage::disk('public')->makeDirectory($targetFolder);
            }

            // Copiar archivos de ambas subcarpetas
            foreach ($sourceFolders as $sourceFolder) {
                if (!Storage::disk('public')->exists($sourceFolder)) {
                    continue;
                }

                $files = Storage::disk('public')->files($sourceFolder);

                foreach ($files as $file) {
                    $fileName = basename($file);
                    $newPath = "{$targetFolder}/{$fileName}";

                    // Manejo de colisiones
                    if (Storage::disk('public')->exists($newPath)) {
                        $extension = pathinfo($fileName, PATHINFO_EXTENSION);
                        $nameWithoutExt = pathinfo($fileName, PATHINFO_FILENAME);
                        $timestamp = now()->format('Ymd_His');
                        $fileName = "{$nameWithoutExt}_{$timestamp}.{$extension}";
                        $newPath = "{$targetFolder}/{$fileName}";
                    }

                    Storage::disk('public')->copy($file, $newPath);
                    $copiedFiles[] = ['original' => $file, 'copy' => $newPath];
                }
            }

            return [
                'success' => true,
                'message' => 'Archivos copiados correctamente',
                'files_count' => count($copiedFiles),
                'files' => $copiedFiles
            ];
        } catch (\Exception $e) {
            Log::error('Error copiando archivos a análisis', [
                'opportunity_id' => $opportunityId,
                'analisis_id' => $analisisId,
                'error' => $e->getMessage()
            ]);

            return ['success' => false, 'message' => 'Error: ' . $e->getMessage()];
        }
    }

    /**
     * Obtener los archivos de un análisis (heredados + específicos).
     * GET /api/analisis/{id}/files
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function getFiles(int $id)
    {
        $analisis = Analisis::with(['lead', 'opportunity'])->findOrFail($id);
        $cedula = $this->getCedulaFromAnalisis($analisis);

        if (empty($cedula)) {
            return response()->json([
                'success' => true,
                'heredados' => [],
                'especificos' => [],
                'message' => 'No se pudo determinar la cédula'
            ]);
        }

        $baseFolder = "documentos/{$cedula}/analisis/{$id}";
        $heredadosFolder = "{$baseFolder}/heredados";
        $especificosFolder = "{$baseFolder}/especificos";

        $heredados = $this->listFilesInFolder($heredadosFolder);
        $especificos = $this->listFilesInFolder($especificosFolder);

        return response()->json([
            'success' => true,
            'analisis_id' => $id,
            'cedula' => $cedula,
            'heredados' => $heredados,
            'especificos' => $especificos,
        ]);
    }

    /**
     * Subir un archivo específico al análisis.
     * POST /api/analisis/{id}/files
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function uploadFile(Request $request, int $id)
    {
        $request->validate([
            'file' => 'required|file|max:10240', // 10MB max
        ]);

        $analisis = Analisis::with(['lead', 'opportunity'])->findOrFail($id);
        $cedula = $this->getCedulaFromAnalisis($analisis);

        if (empty($cedula)) {
            return response()->json([
                'success' => false,
                'message' => 'No se pudo determinar la cédula'
            ], 422);
        }

        $especificosFolder = "documentos/{$cedula}/analisis/{$id}/especificos";

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
            Log::error('Error subiendo archivo a análisis', [
                'analisis_id' => $id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al subir archivo: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar un archivo del análisis.
     * DELETE /api/analisis/{id}/files/{filename}
     *
     * @param int $id
     * @param string $filename
     * @return \Illuminate\Http\JsonResponse
     */
    public function deleteFile(int $id, string $filename)
    {
        $analisis = Analisis::with(['lead', 'opportunity'])->findOrFail($id);
        $cedula = $this->getCedulaFromAnalisis($analisis);

        if (empty($cedula)) {
            return response()->json([
                'success' => false,
                'message' => 'No se pudo determinar la cédula'
            ], 422);
        }

        $baseFolder = "documentos/{$cedula}/analisis/{$id}";

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
}
