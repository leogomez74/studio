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
                'rutas', 'comunicaciones', 'staff', 'entrenamiento',
                'recompensas', 'tareas', 'auditoria', 'auditoria_asientos',
                'importacion', 'incidencias', 'profesiones',
                // Tabs individuales de configuración
                'config_prestamos', 'config_tasas', 'config_productos',
                'config_poliza', 'config_embargo',
                'config_usuarios', 'config_roles',
                'config_patronos', 'config_deductoras', 'config_empresas', 'config_instituciones',
                'config_contabilidad',
                'config_tareas_auto', 'config_workflows', 'config_labels',
                'config_integraciones', 'config_api_tokens', 'config_whatsapp',
                // Legacy (compatibilidad con roles existentes que tienen estos grupos)
                'config_general', 'config_personas', 'config_sistema',
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
                    'formalizar' => true,
                    'formalizar_admin' => true,
                    'autoaplicar_abono' => true,
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
                'formalizar' => $perm->can_formalizar ?? false,
                'formalizar_admin' => $perm->can_formalizar_admin ?? false,
                'autoaplicar_abono' => $perm->can_autoaplicar_abono ?? false,
            ];
        }
        return $permissions;
    }
}
