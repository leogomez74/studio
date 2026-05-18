<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Profesion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Traits\LogsActivity;

class ProfesionController extends Controller
{
    use LogsActivity;

    public function index(Request $request): JsonResponse
    {
        $query = Profesion::query()->orderBy('order_column')->orderBy('name');
        if ($request->boolean('active')) {
            $query->where('is_active', true);
        }
        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150|unique:profesiones,name',
            'is_active' => 'sometimes|boolean',
            'order_column' => 'sometimes|integer|min:0',
        ]);

        $validated['slug'] = Str::slug($validated['name']);
        $profesion = Profesion::create($validated);
        $this->logActivity('create', 'Profesiones', $profesion, $profesion->name, [], $request);

        return response()->json($profesion, 201);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json(Profesion::findOrFail($id));
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $profesion = Profesion::findOrFail($id);
        $oldData = $profesion->toArray();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:150|unique:profesiones,name,' . $id,
            'is_active' => 'sometimes|boolean',
            'order_column' => 'sometimes|integer|min:0',
        ]);

        if (isset($validated['name'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        $profesion->update($validated);
        $changes = $this->getChanges($oldData, $profesion->fresh()->toArray());
        $this->logActivity('update', 'Profesiones', $profesion, $profesion->name, $changes, $request);

        return response()->json($profesion);
    }

    public function destroy(string $id): JsonResponse
    {
        $profesion = Profesion::findOrFail($id);
        $this->logActivity('delete', 'Profesiones', $profesion, $profesion->name);
        $profesion->delete();

        return response()->json(['message' => 'Profesión eliminada exitosamente'], 200);
    }
}
