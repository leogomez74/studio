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
        Schema::create('role_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_id')->constrained('roles')->onDelete('cascade');
            $table->string('module_key'); // reportes, kpis, crm, oportunidades, etc.
            $table->boolean('can_view')->default(false);
            $table->boolean('can_create')->default(false);
            $table->boolean('can_edit')->default(false);
            $table->boolean('can_delete')->default(false);
            $table->timestamps();

            $table->unique(['role_id', 'module_key']);
        });

        // Obtener IDs de los roles
        $adminRoleId = DB::table('roles')->where('name', 'Administrador')->value('id');
        $colaboradorRoleId = DB::table('roles')->where('name', 'Colaborador')->value('id');
        $finanzasRoleId = DB::table('roles')->where('name', 'Finanzas')->value('id');

        // Permisos para rol Colaborador
        $colaboradorPermissions = [
            ['module_key' => 'reportes', 'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
            ['module_key' => 'kpis', 'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
            ['module_key' => 'crm', 'can_view' => true, 'can_create' => true, 'can_edit' => true, 'can_delete' => false],
            ['module_key' => 'oportunidades', 'can_view' => true, 'can_create' => true, 'can_edit' => true, 'can_delete' => false],
            ['module_key' => 'analizados', 'can_view' => true, 'can_create' => false, 'can_edit' => true, 'can_delete' => false],
            ['module_key' => 'creditos', 'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
            ['module_key' => 'calculos', 'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
            ['module_key' => 'ventas', 'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
            ['module_key' => 'rutas', 'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
            ['module_key' => 'entrenamiento', 'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
            ['module_key' => 'recompensas', 'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
        ];

        foreach ($colaboradorPermissions as $perm) {
            DB::table('role_permissions')->insert([
                'role_id' => $colaboradorRoleId,
                'module_key' => $perm['module_key'],
                'can_view' => $perm['can_view'],
                'can_create' => $perm['can_create'],
                'can_edit' => $perm['can_edit'],
                'can_delete' => $perm['can_delete'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Permisos para rol Finanzas
        $finanzasPermissions = [
            ['module_key' => 'reportes', 'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
            ['module_key' => 'kpis', 'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
            ['module_key' => 'crm', 'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
            ['module_key' => 'oportunidades', 'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
            ['module_key' => 'analizados', 'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
            ['module_key' => 'creditos', 'can_view' => true, 'can_create' => true, 'can_edit' => true, 'can_delete' => true],
            ['module_key' => 'calculos', 'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
            ['module_key' => 'cobros', 'can_view' => true, 'can_create' => true, 'can_edit' => true, 'can_delete' => false],
            ['module_key' => 'cobro_judicial', 'can_view' => true, 'can_create' => true, 'can_edit' => true, 'can_delete' => true],
            ['module_key' => 'ventas', 'can_view' => true, 'can_create' => false, 'can_edit' => false, 'can_delete' => false],
            ['module_key' => 'inversiones', 'can_view' => true, 'can_create' => true, 'can_edit' => true, 'can_delete' => true],
            ['module_key' => 'comunicaciones', 'can_view' => true, 'can_create' => true, 'can_edit' => false, 'can_delete' => false],
        ];

        foreach ($finanzasPermissions as $perm) {
            DB::table('role_permissions')->insert([
                'role_id' => $finanzasRoleId,
                'module_key' => $perm['module_key'],
                'can_view' => $perm['can_view'],
                'can_create' => $perm['can_create'],
                'can_edit' => $perm['can_edit'],
                'can_delete' => $perm['can_delete'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Nota: El rol Administrador tiene full_access = true,
        // por lo que no necesita registros en role_permissions
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_permissions');
    }
};
