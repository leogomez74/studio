<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Primero, agregar el campo role_id (nullable temporalmente)
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('role_id')->nullable()->after('email')->constrained('roles')->onDelete('set null');
        });

        // Migrar datos existentes del campo role (enum) al nuevo role_id
        $adminRoleId = DB::table('roles')->where('name', 'Administrador')->value('id');
        $colaboradorRoleId = DB::table('roles')->where('name', 'Colaborador')->value('id');

        // Mapear roles antiguos a nuevos IDs
        DB::table('users')->where('role', 'Administrador')->update(['role_id' => $adminRoleId]);
        DB::table('users')->where('role', 'Colaborador')->update(['role_id' => $colaboradorRoleId]);
        DB::table('users')->where('role', 'Sin Rol Asignado')->update(['role_id' => null]);

        // Eliminar el campo role (enum) antiguo
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Restaurar el campo role (enum)
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['Sin Rol Asignado', 'Administrador', 'Colaborador'])->default('Sin Rol Asignado')->after('email');
        });

        // Migrar datos de vuelta
        $adminRoleId = DB::table('roles')->where('name', 'Administrador')->value('id');
        $colaboradorRoleId = DB::table('roles')->where('name', 'Colaborador')->value('id');

        DB::table('users')->where('role_id', $adminRoleId)->update(['role' => 'Administrador']);
        DB::table('users')->where('role_id', $colaboradorRoleId)->update(['role' => 'Colaborador']);
        DB::table('users')->whereNull('role_id')->update(['role' => 'Sin Rol Asignado']);

        // Eliminar el campo role_id
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['role_id']);
            $table->dropColumn('role_id');
        });
    }
};
