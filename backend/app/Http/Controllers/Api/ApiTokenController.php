<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;

class ApiTokenController extends Controller
{
    use LogsActivity;

    public function index(Request $request)
    {
        $tokens = $request->user()->tokens()
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($token) => [
                'id' => $token->id,
                'name' => $token->name,
                'abilities' => $token->abilities,
                'last_used_at' => $token->last_used_at,
                'created_at' => $token->created_at,
                'expires_at' => $token->expires_at,
            ]);

        return response()->json($tokens);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $token = $request->user()->createToken($validated['name'], ['*']);

        $this->logActivity('create', 'API Token', null, "Token: {$validated['name']}", [], $request);

        return response()->json([
            'token' => $token->plainTextToken,
            'name' => $validated['name'],
            'id' => $token->accessToken->id,
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        $token = $request->user()->tokens()->findOrFail($id);
        $name = $token->name;
        $token->delete();

        $this->logActivity('delete', 'API Token', null, "Token: {$name}", [], $request);

        return response()->json(['message' => 'Token revocado correctamente.']);
    }
}
