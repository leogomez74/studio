<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckModulePermission
{
    /**
     * Usage in routes: ->middleware('permission:crm,delete')
     *
     * @param string $module  Module key (crm, oportunidades, creditos, etc.)
     * @param string $action  Permission action (view, create, edit, delete, archive, assign)
     */
    public function handle(Request $request, Closure $next, string $module, string $action = 'view'): Response
    {
        $user = $request->user();

        if (!$user || !$user->role) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        // full_access bypasses all permission checks
        if ($user->role->full_access) {
            return $next($request);
        }

        $permissions = $user->role->getFormattedPermissions();
        $actionKey = "can_{$action}";

        // Map action names to permission keys
        $actionMap = [
            'view' => 'view',
            'create' => 'create',
            'edit' => 'edit',
            'delete' => 'delete',
            'archive' => 'archive',
            'assign' => 'assign',
        ];

        $permKey = $actionMap[$action] ?? $action;

        if (!isset($permissions[$module]) || !($permissions[$module][$permKey] ?? false)) {
            return response()->json([
                'message' => 'No tiene permisos para esta acción.',
            ], 403);
        }

        return $next($request);
    }
}
