<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Analisis;
use App\Models\Propuesta;
use App\Models\Task;
use App\Models\TaskAutomation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class PropuestaController extends Controller
{
    /**
     * Listar propuestas de un análisis.
     */
    public function index(string $reference): JsonResponse
    {
        $analisis = Analisis::where('reference', $reference)->firstOrFail();

        $propuestas = $analisis->propuestas()
            ->with('aceptadaPorUser:id,name')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($propuestas);
    }

    /**
     * Crear una propuesta para un análisis.
     * Solo permitido cuando estado_pep === 'Pendiente de cambios'.
     */
    public function store(Request $request, string $reference): JsonResponse
    {
        $analisis = Analisis::where('reference', $reference)->firstOrFail();

        if ($analisis->estado_pep !== 'Pendiente de cambios') {
            return response()->json([
                'message' => 'Solo se pueden crear propuestas cuando el análisis está en estado "Pendiente de cambios".',
                'estado_actual' => $analisis->estado_pep,
            ], 422);
        }

        $validated = $request->validate([
            'monto' => 'required|numeric|min:0.01',
            'plazo' => 'required|integer|min:1',
            // 'cuota' => 'required|numeric|min:0.01',
            // 'interes' => 'required|numeric|min:0.0001',
            // 'categoria' => 'nullable|string|max:255',
        ]);

        $propuesta = Propuesta::create([
            'analisis_reference' => $reference,
            'monto' => $validated['monto'],
            'plazo' => $validated['plazo'],
            // 'cuota' => $validated['cuota'],
            // 'interes' => $validated['interes'],
            // 'categoria' => $validated['categoria'] ?? null,
            'estado' => Propuesta::ESTADO_PENDIENTE,
        ]);

        $propuesta->load('aceptadaPorUser:id,name');

        return response()->json($propuesta, 201);
    }

    /**
     * Actualizar una propuesta.
     * Solo permitido si la propuesta está en estado Pendiente
     * y el análisis está en estado "Pendiente de cambios".
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $propuesta = Propuesta::findOrFail($id);

        if ($propuesta->estado !== Propuesta::ESTADO_PENDIENTE) {
            return response()->json([
                'message' => 'Solo se pueden editar propuestas en estado "Pendiente".',
                'estado_actual' => $propuesta->estado,
            ], 422);
        }

        $analisis = Analisis::where('reference', $propuesta->analisis_reference)->firstOrFail();

        if ($analisis->estado_pep !== 'Pendiente de cambios') {
            return response()->json([
                'message' => 'Solo se pueden editar propuestas cuando el análisis está en estado "Pendiente de cambios".',
                'estado_actual' => $analisis->estado_pep,
            ], 422);
        }

        $validated = $request->validate([
            'monto' => 'sometimes|numeric|min:0.01',
            'plazo' => 'sometimes|integer|min:1',
            'cuota' => 'sometimes|numeric|min:0.01',
            'interes' => 'sometimes|numeric|min:0.0001',
            'categoria' => 'nullable|string|max:255',
        ]);

        $propuesta->update($validated);
        $propuesta->load('aceptadaPorUser:id,name');

        return response()->json($propuesta);
    }

    /**
     * Eliminar una propuesta.
     * Solo permitido si está en estado Pendiente
     * y el análisis está en estado "Pendiente de cambios".
     */
    public function destroy(int $id): JsonResponse
    {
        $propuesta = Propuesta::findOrFail($id);

        if ($propuesta->estado !== Propuesta::ESTADO_PENDIENTE) {
            return response()->json([
                'message' => 'Solo se pueden eliminar propuestas en estado "Pendiente".',
            ], 422);
        }

        $analisis = Analisis::where('reference', $propuesta->analisis_reference)->firstOrFail();

        if ($analisis->estado_pep !== 'Pendiente de cambios') {
            return response()->json([
                'message' => 'Solo se pueden eliminar propuestas cuando el análisis está en estado "Pendiente de cambios".',
            ], 422);
        }

        $propuesta->delete();

        return response()->json(['message' => 'Propuesta eliminada.']);
    }

    /**
     * Aceptar una propuesta.
     * Deniega automáticamente las demás propuestas del mismo análisis.
     */
    public function aceptar(int $id): JsonResponse
    {
        $propuesta = Propuesta::findOrFail($id);

        if ($propuesta->estado !== Propuesta::ESTADO_PENDIENTE) {
            return response()->json([
                'message' => 'Solo se pueden aceptar propuestas en estado "Pendiente".',
            ], 422);
        }

        $analisis = Analisis::where('reference', $propuesta->analisis_reference)->firstOrFail();

        $userId = Auth::id();
        $now = now();

        // Denegar las demás propuestas pendientes o previamente aceptadas del mismo análisis
        Propuesta::where('analisis_reference', $propuesta->analisis_reference)
            ->where('id', '!=', $propuesta->id)
            ->whereIn('estado', [Propuesta::ESTADO_PENDIENTE, Propuesta::ESTADO_ACEPTADA])
            ->update([
                'estado' => Propuesta::ESTADO_DENEGADA,
                'aceptada_por' => $userId,
                'aceptada_at' => $now,
            ]);

        // Aceptar esta propuesta
        $propuesta->update([
            'estado' => Propuesta::ESTADO_ACEPTADA,
            'aceptada_por' => $userId,
            'aceptada_at' => $now,
        ]);

        // Sincronizar datos de la propuesta aceptada al análisis y cambiar estado_pep a Aceptado
        $analisis->update([
            'monto_sugerido' => $propuesta->monto,
            'plazo' => $propuesta->plazo,
            'estado_pep' => 'Aceptado',
            'estado_cliente' => 'Pendiente',
        ]);

        // Crear tarea automática al aprobar propuesta
        try {
            $automation = TaskAutomation::where('event_type', 'propuesta_aprobada')
                ->where('is_active', true)
                ->first();

            if ($automation && $automation->assigned_to) {
                Task::create([
                    'project_code' => $propuesta->analisis_reference,
                    'title' => $automation->title,
                    'status' => 'pendiente',
                    'priority' => $automation->priority ?? 'media',
                    'assigned_to' => $automation->assigned_to,
                    'start_date' => now()->toDateString(),
                    'due_date' => now()->toDateString(),
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Error creando tarea automática para propuesta aprobada', ['error' => $e->getMessage()]);
        }

        $propuesta->load('aceptadaPorUser:id,name');

        return response()->json($propuesta);
    }

    /**
     * Denegar una propuesta.
     */
    public function denegar(Request $request, int $id): JsonResponse
    {
        $propuesta = Propuesta::findOrFail($id);

        if ($propuesta->estado !== Propuesta::ESTADO_PENDIENTE) {
            return response()->json([
                'message' => 'Solo se pueden denegar propuestas en estado "Pendiente".',
            ], 422);
        }

        $validated = $request->validate([
            'motivo_rechazo' => 'required|string|max:1000',
        ]);

        $propuesta->update([
            'estado' => Propuesta::ESTADO_DENEGADA,
            'aceptada_por' => Auth::id(),
            'aceptada_at' => now(),
            'motivo_rechazo' => $validated['motivo_rechazo'],
        ]);

        $propuesta->load('aceptadaPorUser:id,name');

        return response()->json($propuesta);
    }
}
