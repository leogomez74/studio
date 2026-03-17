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
            $table->decimal('ingreso_bruto_7', 15, 2)->nullable()->after('ingreso_neto_6');
            $table->decimal('ingreso_neto_7', 15, 2)->nullable()->after('ingreso_bruto_7');
            $table->decimal('ingreso_bruto_8', 15, 2)->nullable()->after('ingreso_neto_7');
            $table->decimal('ingreso_neto_8', 15, 2)->nullable()->after('ingreso_bruto_8');
            $table->decimal('ingreso_bruto_9', 15, 2)->nullable()->after('ingreso_neto_8');
            $table->decimal('ingreso_neto_9', 15, 2)->nullable()->after('ingreso_bruto_9');
            $table->decimal('ingreso_bruto_10', 15, 2)->nullable()->after('ingreso_neto_9');
            $table->decimal('ingreso_neto_10', 15, 2)->nullable()->after('ingreso_bruto_10');
            $table->decimal('ingreso_bruto_11', 15, 2)->nullable()->after('ingreso_neto_10');
            $table->decimal('ingreso_neto_11', 15, 2)->nullable()->after('ingreso_bruto_11');
            $table->decimal('ingreso_bruto_12', 15, 2)->nullable()->after('ingreso_neto_11');
            $table->decimal('ingreso_neto_12', 15, 2)->nullable()->after('ingreso_bruto_12');
        });
    }

    public function down(): void
    {
        Schema::table('analisis', function (Blueprint $table) {
            $table->dropColumn([
                'ingreso_bruto_7', 'ingreso_neto_7',
                'ingreso_bruto_8', 'ingreso_neto_8',
                'ingreso_bruto_9', 'ingreso_neto_9',
                'ingreso_bruto_10', 'ingreso_neto_10',
                'ingreso_bruto_11', 'ingreso_neto_11',
                'ingreso_bruto_12', 'ingreso_neto_12',
            ]);
        });
    }
};
