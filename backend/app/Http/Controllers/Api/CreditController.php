<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Credit;
use App\Models\CreditDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;

class CreditController extends Controller
{
    public function index(Request $request)
    {
        $query = Credit::with(['lead', 'opportunity', 'documents']);

        if ($request->has('lead_id')) {
            $query->where('lead_id', $request->lead_id);
        }

        return response()->json($query->latest()->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'reference' => 'required|unique:credits,reference',
            'title' => 'required|string',
            'status' => 'required|string',
            'category' => 'nullable|string',
            'progress' => 'integer|min:0|max:100',
            'lead_id' => 'required|exists:persons,id',
            'opportunity_id' => 'nullable|exists:opportunities,id',
            'assigned_to' => 'nullable|string',
            'opened_at' => 'nullable|date',
            'description' => 'nullable|string',
            'tipo_credito' => 'nullable|string',
            'numero_operacion' => 'nullable|string|unique:credits,numero_operacion',
            'monto_credito' => 'nullable|numeric',
            'cuota' => 'nullable|numeric',
            'fecha_ultimo_pago' => 'nullable|date',
            'garantia' => 'nullable|string',
            'fecha_culminacion_credito' => 'nullable|date',
            'tasa_anual' => 'nullable|numeric',
            'plazo' => 'nullable|integer',
            'cuotas_atrasadas' => 'nullable|integer',
            'deductora_id' => 'nullable|exists:deductoras,id',
        ]);

        $credit = Credit::create($validated);

        return response()->json($credit, 201);
    }

    public function show($id)
    {
        $credit = Credit::with(['lead', 'opportunity', 'documents'])->findOrFail($id);
        return response()->json($credit);
    }

    public function update(Request $request, $id)
    {
        $credit = Credit::findOrFail($id);

        $validated = $request->validate([
            'reference' => 'sometimes|required|unique:credits,reference,' . $id,
            'title' => 'sometimes|required|string',
            'status' => 'sometimes|required|string',
            'category' => 'nullable|string',
            'progress' => 'integer|min:0|max:100',
            'lead_id' => 'sometimes|required|exists:persons,id',
            'opportunity_id' => 'nullable|exists:opportunities,id',
            'assigned_to' => 'nullable|string',
            'opened_at' => 'nullable|date',
            'description' => 'nullable|string',
            'tipo_credito' => 'nullable|string',
            'numero_operacion' => 'nullable|string|unique:credits,numero_operacion,' . $id,
            'monto_credito' => 'nullable|numeric',
            'cuota' => 'nullable|numeric',
            'fecha_ultimo_pago' => 'nullable|date',
            'garantia' => 'nullable|string',
            'fecha_culminacion_credito' => 'nullable|date',
            'tasa_anual' => 'nullable|numeric',
            'plazo' => 'nullable|integer',
            'cuotas_atrasadas' => 'nullable|integer',
            'deductora_id' => 'nullable|exists:deductoras,id',
        ]);

        $credit->update($validated);

        return response()->json($credit);
    }

    public function destroy($id)
    {
        $credit = Credit::findOrFail($id);
        $credit->delete();
        return response()->json(null, 204);
    }

    public function documents($id)
    {
        $credit = Credit::findOrFail($id);
        return response()->json($credit->documents);
    }

    public function storeDocument(Request $request, $id)
    {
        $credit = Credit::findOrFail($id);

        $request->validate([
            'file' => 'required|file|max:10240', // 10MB max
            'name' => 'required|string',
            'notes' => 'nullable|string',
        ]);

        $file = $request->file('file');
        $path = $file->store('credit-documents/' . $credit->id, 'public');

        $document = $credit->documents()->create([
            'name' => $request->name,
            'notes' => $request->notes,
            'path' => $path,
            'url' => Storage::url($path),
            'mime_type' => $file->getClientMimeType(),
            'size' => $file->getSize(),
        ]);

        return response()->json($document, 201);
    }

    public function destroyDocument($id, $documentId)
    {
        $document = CreditDocument::where('credit_id', $id)->findOrFail($documentId);

        if (Storage::disk('public')->exists($document->path)) {
            Storage::disk('public')->delete($document->path);
        }

        $document->delete();

        return response()->json(null, 204);
    }
}
