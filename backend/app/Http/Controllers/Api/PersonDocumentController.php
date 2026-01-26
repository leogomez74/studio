<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PersonDocument;
use App\Models\Person;
use App\Models\Opportunity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class PersonDocumentController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'person_id' => 'required|integer|exists:persons,id',
        ]);

        $documents = PersonDocument::where('person_id', $request->person_id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($documents);
    }

    public function checkCedulaFolder(Request $request)
    {
        $request->validate([
            'cedula' => 'required|string',
        ]);

        $rawCedula = $request->cedula;
        $strippedCedula = preg_replace('/[^0-9]/', '', $request->cedula);
        
        Log::info("Checking cedula folder/records for: {$rawCedula} (Stripped: {$strippedCedula})");

        if (empty($strippedCedula)) {
            return response()->json(['exists' => false]);
        }

        // Carpeta unificada: documentos/{cedula}/buzon/
        $folder = "documentos/{$strippedCedula}/buzon";
        $legacyFolder = "documents/{$strippedCedula}"; // Legacy para compatibilidad

        $exists = Storage::disk('public')->exists($folder) || Storage::disk('public')->exists($legacyFolder);
        
        $hasRecords = PersonDocument::whereHas('person', function($q) use ($strippedCedula, $rawCedula) {
            $q->where('cedula', $strippedCedula)
              ->orWhere('cedula', $rawCedula);
        })->exists();

        Log::info("Result - Folder: " . ($exists ? 'Yes' : 'No') . ", DB Records: " . ($hasRecords ? 'Yes' : 'No'));

        return response()->json(['exists' => $exists || $hasRecords]);
    }
    
    // ...


    public function store(Request $request)
    {
        $validated = $request->validate([
            'person_id' => 'required|exists:persons,id',
            'file' => 'required|file|max:10240', // 10MB max
        ]);

        // Validar que la persona tenga cédula
        $person = Person::findOrFail($validated['person_id']);

        if (empty($person->cedula)) {
            Log::warning("Intento de subir documento para persona sin cédula", [
                'person_id' => $person->id,
                'person_name' => $person->name
            ]);

            return response()->json([
                'error' => 'La persona debe tener una cédula asignada para subir documentos.',
                'code' => 'PERSON_WITHOUT_CEDULA',
                'person_id' => $person->id,
                'person_name' => $person->name
            ], 422);
        }

        // Normalizar cédula para uso en filesystem
        $strippedCedula = preg_replace('/[^0-9]/', '', $person->cedula);
        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();

        // Crear carpeta de buzón del lead: documentos/{cedula}/buzon/
        $cedulaFolder = "documentos/{$strippedCedula}/buzon";
        if (!Storage::disk('public')->exists($cedulaFolder)) {
            Storage::disk('public')->makeDirectory($cedulaFolder);
        }

        // Manejar colisión de nombres de archivo
        $targetPath = "{$cedulaFolder}/{$fileName}";
        if (Storage::disk('public')->exists($targetPath)) {
            $extension = $file->getClientOriginalExtension();
            $nameWithoutExt = pathinfo($fileName, PATHINFO_FILENAME);
            $timestamp = now()->format('Ymd_His');
            $fileName = "{$nameWithoutExt}_{$timestamp}.{$extension}";
            $targetPath = "{$cedulaFolder}/{$fileName}";
        }

        // Guardar archivo en la carpeta organizada por cédula
        $path = $file->storeAs($cedulaFolder, $fileName, 'public');

        Log::info("Documento subido exitosamente", [
            'person_id' => $person->id,
            'cedula' => $person->cedula,
            'stripped_cedula' => $strippedCedula,
            'file_name' => $fileName,
            'path' => $path
        ]);

        $document = PersonDocument::create([
            'person_id' => $validated['person_id'],
            'name' => $file->getClientOriginalName(),
            'path' => $path,
            'url' => asset(Storage::url($path)),
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
        ]);

        // Auto-sync: copiar archivo a oportunidades existentes del lead
        $syncResult = $this->syncFileToOpportunities($person->cedula, $path, $fileName);

        return response()->json([
            'document' => $document,
            'synced_to_opportunities' => $syncResult['count'] ?? 0,
        ], 201);
    }

    /**
     * Sincronizar un archivo del lead a todas sus oportunidades existentes.
     * El archivo se copia a: documentos/{cedula}/{opportunityId}/heredados/
     *
     * @param string $cedula
     * @param string $sourcePath
     * @param string $fileName
     * @return array
     */
    private function syncFileToOpportunities(string $cedula, string $sourcePath, string $fileName): array
    {
        $strippedCedula = preg_replace('/[^0-9]/', '', $cedula);

        // Buscar oportunidades del lead por cédula
        $opportunities = Opportunity::where('lead_cedula', $cedula)
            ->orWhere('lead_cedula', $strippedCedula)
            ->get();

        if ($opportunities->isEmpty()) {
            Log::info("No hay oportunidades para sincronizar", ['cedula' => $cedula]);
            return ['count' => 0, 'opportunities' => []];
        }

        $synced = [];

        foreach ($opportunities as $opportunity) {
            $targetFolder = "documentos/{$strippedCedula}/{$opportunity->id}/heredados";

            try {
                // Crear carpeta si no existe
                if (!Storage::disk('public')->exists($targetFolder)) {
                    Storage::disk('public')->makeDirectory($targetFolder);
                }

                $targetPath = "{$targetFolder}/{$fileName}";

                // Manejar colisión de nombres
                if (Storage::disk('public')->exists($targetPath)) {
                    $extension = pathinfo($fileName, PATHINFO_EXTENSION);
                    $nameWithoutExt = pathinfo($fileName, PATHINFO_FILENAME);
                    $timestamp = now()->format('Ymd_His');
                    $newFileName = "{$nameWithoutExt}_{$timestamp}.{$extension}";
                    $targetPath = "{$targetFolder}/{$newFileName}";
                }

                // Copiar archivo
                Storage::disk('public')->copy($sourcePath, $targetPath);
                $synced[] = $opportunity->id;

                Log::info("Archivo sincronizado a oportunidad", [
                    'opportunity_id' => $opportunity->id,
                    'source' => $sourcePath,
                    'target' => $targetPath,
                ]);
            } catch (\Exception $e) {
                Log::error("Error sincronizando archivo a oportunidad", [
                    'opportunity_id' => $opportunity->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return ['count' => count($synced), 'opportunities' => $synced];
    }

    public function destroy($id)
    {
        $document = PersonDocument::findOrFail($id);

        if (Storage::disk('public')->exists($document->path)) {
            Storage::disk('public')->delete($document->path);
        }

        $document->delete();

        return response()->json(['message' => 'Document deleted successfully']);
    }

    /**
     * Sincronizar todos los documentos del buzón de un lead a una oportunidad específica.
     * POST /api/person-documents/sync-to-opportunity
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function syncToOpportunity(Request $request)
    {
        $validated = $request->validate([
            'cedula' => 'required|string',
            'opportunity_id' => 'required|string',
        ]);

        $strippedCedula = preg_replace('/[^0-9]/', '', $validated['cedula']);
        $opportunityId = $validated['opportunity_id'];

        // Verificar que la oportunidad existe
        $opportunity = Opportunity::find($opportunityId);
        if (!$opportunity) {
            return response()->json([
                'success' => false,
                'message' => 'Oportunidad no encontrada',
            ], 404);
        }

        // Carpeta fuente (buzón del lead)
        $sourceFolder = "documentos/{$strippedCedula}/buzon";
        $targetFolder = "documentos/{$strippedCedula}/{$opportunityId}/heredados";

        if (!Storage::disk('public')->exists($sourceFolder)) {
            return response()->json([
                'success' => true,
                'message' => 'No hay archivos en el buzón del lead',
                'files_synced' => 0,
            ]);
        }

        // Crear carpeta destino si no existe
        if (!Storage::disk('public')->exists($targetFolder)) {
            Storage::disk('public')->makeDirectory($targetFolder);
        }

        $files = Storage::disk('public')->files($sourceFolder);
        $synced = [];

        foreach ($files as $file) {
            $fileName = basename($file);
            $targetPath = "{$targetFolder}/{$fileName}";

            try {
                // Verificar si ya existe (evitar duplicados)
                if (Storage::disk('public')->exists($targetPath)) {
                    continue; // Skip si ya existe
                }

                Storage::disk('public')->copy($file, $targetPath);
                $synced[] = $fileName;
            } catch (\Exception $e) {
                Log::error("Error sincronizando archivo", [
                    'file' => $file,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        Log::info("Sincronización manual completada", [
            'cedula' => $strippedCedula,
            'opportunity_id' => $opportunityId,
            'files_synced' => count($synced),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Archivos sincronizados correctamente',
            'files_synced' => count($synced),
            'files' => $synced,
        ]);
    }
}