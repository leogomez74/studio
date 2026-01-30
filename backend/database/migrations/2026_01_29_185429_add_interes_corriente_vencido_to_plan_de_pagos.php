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
            $table->decimal('int_corriente_vencido', 15, 2)->default(0)->after('interes_corriente');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('plan_de_pagos', function (Blueprint $table) {
            $table->dropColumn('int_corriente_vencido');
        });
    }
};
