<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Analisis;
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

    public function index()
    {
        $analisis = Analisis::with(['opportunity', 'lead'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($analisis);
    }

    /**
     * Obtener la próxima referencia que se generará (preview).
     * GET /api/analisis/next-reference
     */
    public function nextReference()
    {
        $reference = Analisis::generateReference(1, 1);
        return response()->json(['reference' => $reference]);
    }
    public function store(Request $request)
    {
        $validated = $request->validate([
            'reference' => 'nullable|unique:analisis,reference', // Auto-generado si no se provee
            'title' => 'required|string',
            'estado_pep' => 'nullable|string|in:Pendiente,Aceptado,Pendiente de cambios,Rechazado',
            'estado_cliente' => 'nullable|string|in:Aprobado,Rechazado',
            'category' => 'nullable|string',
            'monto_credito' => 'required|numeric|min:1',
            'lead_id' => 'nullable|integer',
            'opportunity_id' => 'nullable',
            'assigned_to' => 'nullable|string',
            'opened_at' => 'nullable|date',
            'description' => 'nullable|string',
            'divisa' => 'nullable|string',
            'plazo' => 'required|integer|min:1',
            'ingreso_bruto' => 'nullable|numeric',
            'ingreso_neto' => 'nullable|numeric',
            'propuesta' => 'nullable|string',
        ]);

        // Valor por defecto para estado_pep
        if (!isset($validated['estado_pep'])) {
            $validated['estado_pep'] = 'Pendiente';
        }

        // Auto-mapear category basado en la oportunidad o el lead
        if (!isset($validated['category'])) {
            $validated['category'] = $this->determineCategoryFromData($validated);
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
        $analisis = Analisis::with(['opportunity', 'lead'])->findOrFail($id);
        return response()->json($analisis);
    }

    public function update(Request $request, $id)
    {
        $analisis = Analisis::findOrFail($id);
        $validated = $request->validate([
            'reference' => 'sometimes|required|unique:analisis,reference,' . $id,
            'title' => 'sometimes|required|string',
            'estado_pep' => 'nullable|string|in:Pendiente,Aceptado,Pendiente de cambios,Rechazado',
            'estado_cliente' => 'nullable|string|in:Aprobado,Rechazado',
            'category' => 'nullable|string',
            'monto_credito' => 'nullable|numeric',
            'lead_id' => 'nullable|integer',
            'opportunity_id' => 'nullable',
            'assigned_to' => 'nullable|string',
            'opened_at' => 'nullable|date',
            'description' => 'nullable|string',
            'divisa' => 'nullable|string',
            'plazo' => 'nullable|integer',
            'ingreso_bruto' => 'nullable|numeric',
            'ingreso_neto' => 'nullable|numeric',
            'propuesta' => 'nullable|string',
        ]);

        // Si estado_pep no es "Aceptado", limpiar estado_cliente
        if (isset($validated['estado_pep']) && $validated['estado_pep'] !== 'Aceptado') {
            $validated['estado_cliente'] = null;
        }

        $analisis->update($validated);
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
