<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tasa;
use Illuminate\Http\Request;
use Carbon\Carbon;

class TasaController extends Controller
{
    /**
     * Listar todas las tasas
     */
    public function index()
    {
        $tasas = Tasa::orderBy('nombre')->orderBy('inicio', 'desc')->get();
        return response()->json($tasas);
    }

    /**
     * Obtener tasa vigente actual por nombre
     */
    public function porNombre(string $nombre)
    {
        $tasa = Tasa::obtenerPorNombre($nombre);

        if (!$tasa) {
            return response()->json([
                'message' => "No hay tasa vigente configurada para '{$nombre}'"
            ], 404);
        }

        return response()->json($tasa);
    }

    /**
     * Crear nueva tasa
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:255|unique:tasas,nombre',
            'tasa' => 'required|numeric|min:0|max:100',
            'inicio' => 'required|date',
            'fin' => 'nullable|date|after_or_equal:inicio',
            'activo' => 'boolean',
        ]);

        // Si se crea desactivada sin fecha fin, establecer fin al día actual
        if (isset($validated['activo']) && $validated['activo'] === false) {
            if (!isset($validated['fin']) || $validated['fin'] === null) {
                $validated['fin'] = now()->toDateString();
            }
        }

        $tasa = Tasa::create($validated);

        return response()->json([
            'message' => 'Tasa creada exitosamente',
            'tasa' => $tasa
        ], 201);
    }

    /**
     * Mostrar tasa específica
     */
    public function show(string $id)
    {
        $tasa = Tasa::findOrFail($id);
        return response()->json($tasa);
    }

    /**
     * Actualizar tasa
     */
    public function update(Request $request, string $id)
    {
        $tasa = Tasa::findOrFail($id);

        $validated = $request->validate([
            'nombre' => 'sometimes|string|max:255|unique:tasas,nombre,' . $id,
            'tasa' => 'sometimes|numeric|min:0|max:100',
        ]);

        $tasa->update($validated);

        return response()->json([
            'message' => 'Tasa actualizada exitosamente',
            'tasa' => $tasa
        ]);
    }

    /**
     * Eliminar tasa (solo si no tiene créditos asociados)
     */
    public function destroy(string $id)
    {
        $tasa = Tasa::findOrFail($id);

        // Verificar que no tenga créditos asociados
        if ($tasa->credits()->count() > 0) {
            return response()->json([
                'message' => 'No se puede eliminar una tasa con créditos asociados'
            ], 422);
        }

        $tasa->delete();

        return response()->json([
            'message' => 'Tasa eliminada exitosamente'
        ], 200);
    }

    /**
     * Activar/Desactivar tasa
     */
    public function toggleActivo(string $id)
    {
        $tasa = Tasa::findOrFail($id);
        $tasa->activo = !$tasa->activo;

        // Si se desactiva, establecer fecha fin al día actual
        if (!$tasa->activo) {
            $tasa->fin = now()->toDateString();
        } else {
            // Si se reactiva, limpiar fecha fin (vuelve a ser indefinido)
            $tasa->fin = null;
        }

        $tasa->save();

        return response()->json([
            'message' => 'Tasa ' . ($tasa->activo ? 'activada' : 'desactivada') . ' exitosamente',
            'tasa' => $tasa
        ]);
    }
}
