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
        Schema::table('plan_de_pagos', function (Blueprint $table) {
            $table->decimal('movimiento_int_corriente_vencido', 15, 2)->default(0)->after('movimiento_interes_corriente');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('plan_de_pagos', function (Blueprint $table) {
            $table->dropColumn('movimiento_int_corriente_vencido');
        });
    }
};
