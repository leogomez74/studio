<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('role_permissions', function (Blueprint $table) {
            $table->boolean('can_formalizar')->default(false)->after('can_assign');
            $table->boolean('can_formalizar_admin')->default(false)->after('can_formalizar');
        });

        // Dar can_formalizar + can_formalizar_admin al rol Administrador (full_access, no necesita filas)
        // Dar can_formalizar al rol Finanzas en módulo creditos
        $finanzasRoleId = DB::table('roles')->where('name', 'Finanzas')->value('id');
        if ($finanzasRoleId) {
            DB::table('role_permissions')
                ->where('role_id', $finanzasRoleId)
                ->where('module_key', 'creditos')
                ->update(['can_formalizar' => true]);
        }
    }

    public function down(): void
    {
        Schema::table('role_permissions', function (Blueprint $table) {
            $table->dropColumn(['can_formalizar', 'can_formalizar_admin']);
        });
    }
};
