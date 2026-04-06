<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $colaboradorId = DB::table('roles')->where('name', 'Colaborador')->value('id');
        $finanzasId    = DB::table('roles')->where('name', 'Finanzas')->value('id');

        // --- 1. Eliminar módulos obsoletos ---
        // 'proyectos' nunca tuvo página, 'configuracion' se divide en sub-módulos
        foreach ([$colaboradorId, $finanzasId] as $roleId) {
            DB::table('role_permissions')
                ->where('role_id', $roleId)
                ->whereIn('module_key', ['proyectos', 'configuracion'])
                ->delete();
        }

        // --- 2. Nuevos módulos para Colaborador ---
        // Permisos existentes NO se tocan. Solo se insertan módulos que no existen aún.
        $colaboradorNew = [
            // Módulos completamente nuevos:
            ['module_key' => 'tareas',            'can_view' => true,  'can_create' => true,  'can_edit' => true,  'can_delete' => true,  'can_archive' => true,  'can_assign' => false],
            ['module_key' => 'incidencias',       'can_view' => true,  'can_create' => true,  'can_edit' => true,  'can_delete' => false, 'can_archive' => false, 'can_assign' => false],
            ['module_key' => 'auditoria',          'can_view' => false, 'can_create' => false, 'can_edit' => false, 'can_delete' => false, 'can_archive' => false, 'can_assign' => false],
            ['module_key' => 'config_general',     'can_view' => false, 'can_create' => false, 'can_edit' => false, 'can_delete' => false, 'can_archive' => false, 'can_assign' => false],
            ['module_key' => 'config_personas',    'can_view' => false, 'can_create' => false, 'can_edit' => false, 'can_delete' => false, 'can_archive' => false, 'can_assign' => false],
            ['module_key' => 'config_usuarios',    'can_view' => false, 'can_create' => false, 'can_edit' => false, 'can_delete' => false, 'can_archive' => false, 'can_assign' => false],
            ['module_key' => 'config_contabilidad','can_view' => false, 'can_create' => false, 'can_edit' => false, 'can_delete' => false, 'can_archive' => false, 'can_assign' => false],
            ['module_key' => 'config_sistema',     'can_view' => false, 'can_create' => false, 'can_edit' => false, 'can_delete' => false, 'can_archive' => false, 'can_assign' => false],
        ];

        foreach ($colaboradorNew as $perm) {
            DB::table('role_permissions')->insertOrIgnore([
                'role_id'      => $colaboradorId,
                'module_key'   => $perm['module_key'],
                'can_view'     => $perm['can_view'],
                'can_create'   => $perm['can_create'],
                'can_edit'     => $perm['can_edit'],
                'can_delete'   => $perm['can_delete'],
                'can_archive'  => $perm['can_archive'],
                'can_assign'   => $perm['can_assign'],
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);
        }

        // --- 3. Nuevos módulos para Finanzas ---
        $finanzasNew = [
            ['module_key' => 'tareas',            'can_view' => true,  'can_create' => false, 'can_edit' => false, 'can_delete' => false, 'can_archive' => false, 'can_assign' => false],
            ['module_key' => 'incidencias',       'can_view' => true,  'can_create' => true,  'can_edit' => true,  'can_delete' => false, 'can_archive' => false, 'can_assign' => false],
            ['module_key' => 'auditoria',          'can_view' => false, 'can_create' => false, 'can_edit' => false, 'can_delete' => false, 'can_archive' => false, 'can_assign' => false],
            ['module_key' => 'config_general',     'can_view' => false, 'can_create' => false, 'can_edit' => false, 'can_delete' => false, 'can_archive' => false, 'can_assign' => false],
            ['module_key' => 'config_personas',    'can_view' => false, 'can_create' => false, 'can_edit' => false, 'can_delete' => false, 'can_archive' => false, 'can_assign' => false],
            ['module_key' => 'config_usuarios',    'can_view' => false, 'can_create' => false, 'can_edit' => false, 'can_delete' => false, 'can_archive' => false, 'can_assign' => false],
            ['module_key' => 'config_contabilidad','can_view' => true,  'can_create' => true,  'can_edit' => true,  'can_delete' => false, 'can_archive' => false, 'can_assign' => false],
            ['module_key' => 'config_sistema',     'can_view' => false, 'can_create' => false, 'can_edit' => false, 'can_delete' => false, 'can_archive' => false, 'can_assign' => false],
        ];

        foreach ($finanzasNew as $perm) {
            DB::table('role_permissions')->insertOrIgnore([
                'role_id'      => $finanzasId,
                'module_key'   => $perm['module_key'],
                'can_view'     => $perm['can_view'],
                'can_create'   => $perm['can_create'],
                'can_edit'     => $perm['can_edit'],
                'can_delete'   => $perm['can_delete'],
                'can_archive'  => $perm['can_archive'],
                'can_assign'   => $perm['can_assign'],
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);
        }
    }

    public function down(): void
    {
        $colaboradorId = DB::table('roles')->where('name', 'Colaborador')->value('id');
        $finanzasId    = DB::table('roles')->where('name', 'Finanzas')->value('id');

        $newModules = ['tareas', 'incidencias', 'auditoria', 'config_general', 'config_personas', 'config_usuarios', 'config_contabilidad', 'config_sistema'];

        foreach ([$colaboradorId, $finanzasId] as $roleId) {
            DB::table('role_permissions')
                ->where('role_id', $roleId)
                ->whereIn('module_key', $newModules)
                ->delete();
        }
    }
};
