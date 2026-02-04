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
        // Primero, actualizar lead_id para análisis que tienen opportunity_id pero no lead_id
        DB::statement("
            UPDATE analisis a
            INNER JOIN opportunities o ON a.opportunity_id = o.id
            INNER JOIN persons p ON o.lead_cedula = p.cedula
            SET a.lead_id = p.id
            WHERE a.lead_id IS NULL
              AND a.opportunity_id IS NOT NULL
        ");

        // Luego, actualizar cargo y nombramiento desde el lead para todos los que ahora tienen lead_id
        DB::statement("
            UPDATE analisis a
            INNER JOIN persons p ON a.lead_id = p.id
            SET
                a.cargo = p.puesto,
                a.nombramiento = p.estado_puesto
            WHERE a.lead_id IS NOT NULL
              AND (a.cargo IS NULL OR a.nombramiento IS NULL)
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No necesitamos revertir
    }
};
