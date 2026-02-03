<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('analisis', function (Blueprint $table) {
            // Agregar campos adicionales de ingresos para meses 4, 5 y 6
            $table->decimal('ingreso_bruto_4', 15, 2)->nullable()->after('ingreso_neto_3');
            $table->decimal('ingreso_neto_4', 15, 2)->nullable()->after('ingreso_bruto_4');
            $table->decimal('ingreso_bruto_5', 15, 2)->nullable()->after('ingreso_neto_4');
            $table->decimal('ingreso_neto_5', 15, 2)->nullable()->after('ingreso_bruto_5');
            $table->decimal('ingreso_bruto_6', 15, 2)->nullable()->after('ingreso_neto_5');
            $table->decimal('ingreso_neto_6', 15, 2)->nullable()->after('ingreso_bruto_6');
        });
    }

    public function down(): void
    {
        Schema::table('analisis', function (Blueprint $table) {
            $table->dropColumn(['ingreso_bruto_4', 'ingreso_neto_4', 'ingreso_bruto_5', 'ingreso_neto_5', 'ingreso_bruto_6', 'ingreso_neto_6']);
        });
    }
};
