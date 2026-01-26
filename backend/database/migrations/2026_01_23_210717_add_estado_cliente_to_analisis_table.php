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
            // Renombrar status a estado_pep
            $table->renameColumn('status', 'estado_pep');
        });

        Schema::table('analisis', function (Blueprint $table) {
            // Agregar estado_cliente (nullable, solo aplica cuando estado_pep es Aceptado)
            $table->string('estado_cliente')->nullable()->after('estado_pep');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('analisis', function (Blueprint $table) {
            $table->dropColumn('estado_cliente');
        });

        Schema::table('analisis', function (Blueprint $table) {
            $table->renameColumn('estado_pep', 'status');
        });
    }
};
