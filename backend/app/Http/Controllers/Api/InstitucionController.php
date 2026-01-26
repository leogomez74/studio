<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Institucion;
use Illuminate\Http\Request;

class InstitucionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Institucion::query();

        // Filtrar solo activas si se solicita
        if ($request->has('activas_only') && $request->input('activas_only') === 'true') {
            $query->where('activa', true);
        }

        // Ordenar alfabéticamente por nombre
        $query->orderBy('nombre', 'asc');

        // Soporte para paginación opcional
        if ($request->has('per_page')) {
            $perPage = min((int) $request->input('per_page', 100), 500);
            return response()->json($query->paginate($perPage));
        }

        // Sin paginación, devolver todas
        return response()->json($query->get());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:255|unique:instituciones,nombre',
            'activa' => 'sometimes|boolean',
        ]);

        $institucion = Institucion::create($validated);

        return response()->json($institucion, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(int $id)
    {
        $institucion = Institucion::findOrFail($id);
        return response()->json($institucion);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, int $id)
    {
        $institucion = Institucion::findOrFail($id);

        $validated = $request->validate([
            'nombre' => 'sometimes|required|string|max:255|unique:instituciones,nombre,' . $id,
            'activa' => 'sometimes|boolean',
        ]);

        $institucion->update($validated);

        return response()->json($institucion);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(int $id)
    {
        $institucion = Institucion::findOrFail($id);
        $institucion->delete();

        return response()->json(null, 204);
    }
}
