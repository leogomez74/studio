<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PersonDocument;
use App\Models\Investor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Traits\LogsActivity;

class InvestorDocumentController extends Controller
{
    use LogsActivity;

    public function index(Request $request)
    {
        $request->validate([
            'investor_id' => 'required|integer|exists:investors,id',
        ]);

        $documents = PersonDocument::where('investor_id', $request->investor_id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($documents);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'investor_id' => 'required|exists:investors,id',
            'file'        => 'required|file|mimes:jpg,jpeg,png,gif,webp,pdf|max:10240',
            'category'    => 'nullable|in:cedula_pasaporte,contrato_inversion,otro',
        ]);

        $investor = Investor::findOrFail($validated['investor_id']);
        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();

        // Carpeta: documentos/inversionistas/{investor_id}/
        $folder = "documentos/inversionistas/{$investor->id}";
        if (!Storage::disk('public')->exists($folder)) {
            Storage::disk('public')->makeDirectory($folder);
        }

        // Manejar colisión de nombres
        $targetPath = "{$folder}/{$fileName}";
        if (Storage::disk('public')->exists($targetPath)) {
            $extension = $file->getClientOriginalExtension();
            $nameWithoutExt = pathinfo($fileName, PATHINFO_FILENAME);
            $timestamp = now()->format('Ymd_His');
            $fileName = "{$nameWithoutExt}_{$timestamp}.{$extension}";
            $targetPath = "{$folder}/{$fileName}";
        }

        $path = $file->storeAs($folder, $fileName, 'public');

        $document = PersonDocument::create([
            'investor_id' => $investor->id,
            'person_id'   => null,
            'category'    => $validated['category'] ?? 'otro',
            'name'        => $file->getClientOriginalName(),
            'path'        => $path,
            'url'         => asset(Storage::url($path)),
            'mime_type'   => $file->getMimeType(),
            'size'        => $file->getSize(),
        ]);

        $this->logActivity('create', 'InvestorDocumentos', $document, $document->name, [], $request);

        return response()->json(['document' => $document], 201);
    }

    public function destroy($id)
    {
        $document = PersonDocument::whereNotNull('investor_id')->findOrFail($id);

        $this->logActivity('delete', 'InvestorDocumentos', $document, 'Doc #' . $document->id);

        if (Storage::disk('public')->exists($document->path)) {
            Storage::disk('public')->delete($document->path);
        }

        $document->delete();

        return response()->json(['message' => 'Documento eliminado correctamente']);
    }
}
