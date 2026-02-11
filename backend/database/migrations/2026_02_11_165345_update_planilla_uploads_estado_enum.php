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
        // 1. Primero agregar 'procesada' al enum (manteniendo 'activa' temporalmente)
        DB::statement("ALTER TABLE planilla_uploads MODIFY COLUMN estado ENUM('activa', 'procesada', 'anulada') NOT NULL DEFAULT 'activa'");

        // 2. Actualizar registros existentes de 'activa' a 'procesada'
        DB::table('planilla_uploads')
            ->where('estado', 'activa')
            ->update(['estado' => 'procesada']);

        // 3. Finalmente remover 'activa' del enum y cambiar default
        DB::statement("ALTER TABLE planilla_uploads MODIFY COLUMN estado ENUM('procesada', 'anulada') NOT NULL DEFAULT 'procesada'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revertir: actualizar 'procesada' a 'activa'
        DB::table('planilla_uploads')
            ->where('estado', 'procesada')
            ->update(['estado' => 'activa']);

        // Restaurar enum original
        DB::statement("ALTER TABLE planilla_uploads MODIFY COLUMN estado ENUM('activa', 'anulada') NOT NULL DEFAULT 'activa'");
    }
};
