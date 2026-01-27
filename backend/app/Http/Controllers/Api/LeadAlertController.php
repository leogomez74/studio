<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeadAlert;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeadAlertController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = LeadAlert::with('assignedUser:id,name')->latest();

        if ($request->has('is_read')) {
            $query->where('is_read', filter_var($request->input('is_read'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->has('alert_type')) {
            $query->where('alert_type', $request->input('alert_type'));
        }

        if ($request->has('assigned_to_id')) {
            $query->where('assigned_to_id', $request->input('assigned_to_id'));
        }

        $perPage = min((int) $request->input('per_page', 20), 100);

        return response()->json($query->paginate($perPage));
    }

    public function count(Request $request): JsonResponse
    {
        $query = LeadAlert::unread();

        if ($request->has('assigned_to_id')) {
            $query->where('assigned_to_id', $request->input('assigned_to_id'));
        }

        return response()->json([
            'unread_count' => $query->count(),
        ]);
    }

    public function markAsRead(int $id): JsonResponse
    {
        $alert = LeadAlert::findOrFail($id);
        $alert->update(['is_read' => true]);

        return response()->json($alert);
    }
}
