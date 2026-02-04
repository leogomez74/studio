<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Actualizar todos los análisis existentes con los datos del lead
        DB::statement("
            UPDATE analisis a
            INNER JOIN persons p ON a.lead_id = p.id
            SET
                a.cargo = p.puesto,
                a.nombramiento = p.estado_puesto
            WHERE a.lead_id IS NOT NULL
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No necesitamos revertir esto, pero por completitud:
        DB::statement("
            UPDATE analisis
            SET cargo = NULL, nombramiento = NULL
        ");
    }
};
