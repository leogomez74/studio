<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Otorgar acceso de auditoría (solo view) al rol Finanzas y Colaborador
        // Los roles con full_access=true ya lo obtienen automáticamente desde Role::getFormattedPermissions()
        // Solo añadimos aquí para roles que explícitamente quieran ver la bitácora.
        // Por defecto, solo el Administrador tiene acceso (full_access=true).
        // Los demás roles pueden habilitarlo desde la UI de Configuración > Roles.
    }

    public function down(): void
    {
        DB::table('role_permissions')
            ->where('module_key', 'auditoria')
            ->delete();
    }
};
