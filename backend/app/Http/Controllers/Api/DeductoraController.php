<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Deductora;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;

class DeductoraController extends Controller
{
    use LogsActivity;
    public function index()
    {
        return response()->json(Deductora::all());
    }

    public function show(string $id)
    {
        $deductora = Deductora::find($id);

        if (!$deductora) {
            return response()->json(['message' => 'Deductora no encontrada'], 404);
        }

        return response()->json($deductora);
    }

    public function update(Request $request, string $id)
    {
        $deductora = Deductora::findOrFail($id);
        $oldData = $deductora->toArray();

        $validated = $request->validate([
            'erp_account_key' => 'nullable|string|max:50',
        ]);

        $deductora->update($validated);

        $this->logActivity('update', 'Deductoras', $deductora, $deductora->nombre ?? $id, $this->getChanges($oldData, $deductora->fresh()->toArray()), $request);

        return response()->json([
            'message' => 'Deductora actualizada exitosamente',
            'deductora' => $deductora,
        ]);
    }
}
