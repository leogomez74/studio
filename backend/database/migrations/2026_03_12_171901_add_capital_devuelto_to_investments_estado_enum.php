<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE investments MODIFY COLUMN estado ENUM('Activa','Finalizada','Liquidada','Cancelada','Renovada','Capital Devuelto') DEFAULT 'Activa'");

        // Corregir inversiones canceladas sin_intereses que tienen cupones pendientes
        DB::statement("
            UPDATE investments
            SET estado = 'Capital Devuelto'
            WHERE tipo_cancelacion_total = 'sin_intereses'
              AND estado = 'Finalizada'
              AND id IN (
                  SELECT investment_id FROM investment_coupons
                  WHERE estado IN ('Pendiente', 'Reservado')
                  GROUP BY investment_id
              )
        ");
    }

    public function down(): void
    {
        DB::statement("
            UPDATE investments SET estado = 'Finalizada' WHERE estado = 'Capital Devuelto'
        ");
        DB::statement("ALTER TABLE investments MODIFY COLUMN estado ENUM('Activa','Finalizada','Liquidada','Cancelada','Renovada') DEFAULT 'Activa'");
    }
};
