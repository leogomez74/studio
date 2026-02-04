<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaskAutomation;
use Illuminate\Http\Request;

class TaskAutomationController extends Controller
{
    public function index()
    {
        return TaskAutomation::with('assignee:id,name')->get();
    }

    public function upsert(Request $request)
    {
        $validated = $request->validate([
            'event_type' => 'required|string|max:50',
            'title' => 'required|string|max:255',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'priority' => 'nullable|string|in:alta,media,baja',
            'is_active' => 'required|boolean',
        ]);

        $automation = TaskAutomation::updateOrCreate(
            ['event_type' => $validated['event_type']],
            $validated
        );

        return response()->json($automation->load('assignee:id,name'));
    }
}
