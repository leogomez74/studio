<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('analisis', function (Blueprint $table) {
            // Detalles de manchas: [{ descripcion: string, monto: number }]
            $table->json('manchas_detalle')->nullable()->after('numero_manchas');

            // Detalles de juicios: [{ fecha: date, estado: string, expediente: string, monto: number }]
            $table->json('juicios_detalle')->nullable()->after('numero_juicios');

            // Detalles de embargos: [{ fecha: date, motivo: string, monto: number }]
            $table->json('embargos_detalle')->nullable()->after('numero_embargos');

            // Deducciones mensuales: [{ mes: number, monto: number }]
            $table->json('deducciones_mensuales')->nullable()->after('ingreso_neto_6');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('analisis', function (Blueprint $table) {
            $table->dropColumn(['manchas_detalle', 'juicios_detalle', 'embargos_detalle', 'deducciones_mensuales']);
        });
    }
};
