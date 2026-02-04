<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('analisis', function (Blueprint $table) {
            // Agregar campos adicionales de ingresos para múltiples meses
            $table->decimal('ingreso_bruto_2', 15, 2)->nullable()->after('ingreso_neto');
            $table->decimal('ingreso_neto_2', 15, 2)->nullable()->after('ingreso_bruto_2');
            $table->decimal('ingreso_bruto_3', 15, 2)->nullable()->after('ingreso_neto_2');
            $table->decimal('ingreso_neto_3', 15, 2)->nullable()->after('ingreso_bruto_3');
        });
    }

    public function down(): void
    {
        Schema::table('analisis', function (Blueprint $table) {
            $table->dropColumn(['ingreso_bruto_2', 'ingreso_neto_2', 'ingreso_bruto_3', 'ingreso_neto_3']);
        });
    }
};
