<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaskLabel;
use Illuminate\Http\Request;

class TaskLabelController extends Controller
{
    public function index()
    {
        return response()->json(TaskLabel::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:50',
            'color' => 'nullable|string|max:7',
        ]);

        $label = TaskLabel::create([
            'name' => $validated['name'],
            'color' => $validated['color'] ?? '#3b82f6',
        ]);

        return response()->json($label, 201);
    }

    public function update(Request $request, string $id)
    {
        $label = TaskLabel::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:50',
            'color' => 'nullable|string|max:7',
        ]);

        $label->update($validated);

        return response()->json($label);
    }

    public function destroy(string $id)
    {
        $label = TaskLabel::findOrFail($id);
        $label->delete();

        return response()->json(null, 204);
    }
}
