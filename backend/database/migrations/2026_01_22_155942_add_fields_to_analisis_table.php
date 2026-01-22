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
            $table->decimal('ingreso_bruto', 15, 2)->nullable()->after('monto_credito');
            $table->decimal('ingreso_neto', 15, 2)->nullable()->after('ingreso_bruto');
            $table->text('propuesta')->nullable()->after('description');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('analisis', function (Blueprint $table) {
            $table->dropColumn(['ingreso_bruto', 'ingreso_neto', 'propuesta']);
        });
    }
};
