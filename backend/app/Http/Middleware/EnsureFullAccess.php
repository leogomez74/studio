<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureFullAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || !$user->role || !$user->role->full_access) {
            return response()->json([
                'message' => 'No tiene permisos de administrador para esta acción.',
            ], 403);
        }

        return $next($request);
    }
}
