<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PersonDocument;
use App\Models\Person;
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

        $folder = "documents/{$strippedCedula}"; 
        $legacyFolder = "documentos/{$strippedCedula}";

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

        // Crear carpeta de cédula si no existe
        $cedulaFolder = "documents/{$strippedCedula}";
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

        return response()->json($document, 201);
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
}