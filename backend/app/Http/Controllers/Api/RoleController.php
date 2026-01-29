<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\RolePermission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $roles = Role::with('permissions')->get();

        // Formatear respuesta con permisos estructurados
        $rolesFormatted = $roles->map(function ($role) {
            return [
                'id' => $role->id,
                'name' => $role->name,
                'description' => $role->description,
                'full_access' => $role->full_access,
                'permissions' => $role->permissions_attribute ?? [],
                'created_at' => $role->created_at,
                'updated_at' => $role->updated_at,
            ];
        });

        return response()->json($rolesFormatted);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:roles,name',
            'description' => 'nullable|string',
            'full_access' => 'boolean',
            'permissions' => 'required|array',
        ]);

        DB::beginTransaction();
        try {
            // Crear el rol
            $role = Role::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'full_access' => $validated['full_access'] ?? false,
            ]);

            // Crear permisos si no tiene acceso total
            if (!$role->full_access) {
                foreach ($validated['permissions'] as $moduleKey => $perms) {
                    RolePermission::create([
                        'role_id' => $role->id,
                        'module_key' => $moduleKey,
                        'can_view' => $perms['view'] ?? false,
                        'can_create' => $perms['create'] ?? false,
                        'can_edit' => $perms['edit'] ?? false,
                        'can_delete' => $perms['delete'] ?? false,
                    ]);
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'Rol creado exitosamente',
                'data' => $role->load('permissions')
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error al crear el rol',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $role = Role::with('permissions')->findOrFail($id);

        return response()->json([
            'id' => $role->id,
            'name' => $role->name,
            'description' => $role->description,
            'full_access' => $role->full_access,
            'permissions' => $role->permissions_attribute ?? [],
            'created_at' => $role->created_at,
            'updated_at' => $role->updated_at,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $role = Role::findOrFail($id);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('roles', 'name')->ignore($role->id),
            ],
            'description' => 'nullable|string',
            'full_access' => 'boolean',
            'permissions' => 'required|array',
        ]);

        DB::beginTransaction();
        try {
            // Actualizar el rol
            $role->update([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'full_access' => $validated['full_access'] ?? false,
            ]);

            // Eliminar permisos existentes
            RolePermission::where('role_id', $role->id)->delete();

            // Crear nuevos permisos si no tiene acceso total
            if (!$role->full_access) {
                foreach ($validated['permissions'] as $moduleKey => $perms) {
                    RolePermission::create([
                        'role_id' => $role->id,
                        'module_key' => $moduleKey,
                        'can_view' => $perms['view'] ?? false,
                        'can_create' => $perms['create'] ?? false,
                        'can_edit' => $perms['edit'] ?? false,
                        'can_delete' => $perms['delete'] ?? false,
                    ]);
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'Rol actualizado exitosamente',
                'data' => $role->load('permissions')
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error al actualizar el rol',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $role = Role::findOrFail($id);

        // Verificar si hay usuarios con este rol
        if ($role->users()->count() > 0) {
            return response()->json([
                'message' => 'No se puede eliminar el rol porque tiene usuarios asignados'
            ], 422);
        }

        // Eliminar permisos asociados
        RolePermission::where('role_id', $role->id)->delete();

        // Eliminar el rol
        $role->delete();

        return response()->json([
            'message' => 'Rol eliminado exitosamente'
        ]);
    }
}
