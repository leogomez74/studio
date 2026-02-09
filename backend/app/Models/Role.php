<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    protected $fillable = [
        'name',
        'description',
        'full_access',
    ];

    protected $casts = [
        'full_access' => 'boolean',
    ];

    /**
     * Relación con usuarios que tienen este rol
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Relación con permisos de este rol
     */
    public function permissions(): HasMany
    {
        return $this->hasMany(RolePermission::class);
    }

    /**
     * Obtener permisos en formato estructurado
     */
    public function getFormattedPermissions()
    {
        if ($this->full_access) {
            // Si tiene acceso total, retornar todos los permisos como true
            $modules = [
                'reportes', 'kpis', 'crm', 'oportunidades', 'analizados', 'creditos',
                'calculos', 'cobros', 'cobro_judicial', 'ventas', 'inversiones',
                'rutas', 'proyectos', 'comunicaciones', 'staff', 'entrenamiento',
                'recompensas', 'configuracion', 'tareas'
            ];

            $permissions = [];
            foreach ($modules as $module) {
                $permissions[$module] = [
                    'view' => true,
                    'create' => true,
                    'edit' => true,
                    'delete' => true,
                    'archive' => true,
                    'assign' => true,
                ];
            }
            return $permissions;
        }

        // Si no tiene acceso total, obtener permisos específicos de la relación
        $permissions = [];
        $rolePermissions = $this->permissions()->get();
        foreach ($rolePermissions as $perm) {
            $permissions[$perm->module_key] = [
                'view' => $perm->can_view,
                'create' => $perm->can_create,
                'edit' => $perm->can_edit,
                'delete' => $perm->can_delete,
                'archive' => $perm->can_archive ?? false,
                'assign' => $perm->can_assign ?? false,
            ];
        }
        return $permissions;
    }
}
