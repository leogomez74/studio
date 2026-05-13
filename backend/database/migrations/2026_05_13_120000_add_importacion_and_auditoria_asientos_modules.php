<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $newModules = ['importacion', 'auditoria_asientos'];

        $roleIds = DB::table('roles')
            ->where('full_access', false)
            ->pluck('id');

        foreach ($roleIds as $roleId) {
            foreach ($newModules as $module) {
                DB::table('role_permissions')->insertOrIgnore([
                    'role_id'      => $roleId,
                    'module_key'   => $module,
                    'can_view'     => false,
                    'can_create'   => false,
                    'can_edit'     => false,
                    'can_delete'   => false,
                    'can_archive'  => false,
                    'can_assign'   => false,
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('role_permissions')
            ->whereIn('module_key', ['importacion', 'auditoria_asientos'])
            ->delete();
    }
};
