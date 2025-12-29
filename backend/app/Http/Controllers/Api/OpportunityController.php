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
            'amount' => 'required|numeric|min:0',
            'status' => 'required|string',
            'expected_close_date' => 'nullable|date',
            'comments' => 'nullable|string',
            'assigned_to_id' => 'nullable|exists:users,id',
        ]);

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
        $opportunity = Opportunity::with(['lead', 'user'])->findOrFail($id);
        return response()->json($opportunity, 200);
    }

    public function update(Request $request, string $id)
    {
        $opportunity = Opportunity::findOrFail($id);

        $validated = $request->validate([
            'lead_cedula' => 'sometimes|required|string|exists:persons,cedula',
            'opportunity_type' => 'sometimes|nullable|string',
            'vertical' => 'sometimes|nullable|string',
            'amount' => 'sometimes|required|numeric|min:0',
            'status' => 'sometimes|required|string',
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
