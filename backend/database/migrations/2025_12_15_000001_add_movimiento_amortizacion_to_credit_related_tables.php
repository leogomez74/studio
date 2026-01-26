<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('credit_payments', function (Blueprint $table) {
            $table->decimal('movimiento_amortizacion', 15, 2)->nullable()->after('movimiento_total');
        });
        Schema::table('credits', function (Blueprint $table) {
            $table->decimal('movimiento_amortizacion', 15, 2)->nullable()->after('cuota');
        });
        Schema::table('plan_de_pagos', function (Blueprint $table) {
            $table->decimal('movimiento_amortizacion', 15, 2)->nullable()->after('movimiento_principal');
        });
    }

    public function down(): void
    {
        Schema::table('credit_payments', function (Blueprint $table) {
            $table->dropColumn('movimiento_amortizacion');
        });
        Schema::table('credits', function (Blueprint $table) {
            $table->dropColumn('movimiento_amortizacion');
        });
        Schema::table('plan_de_pagos', function (Blueprint $table) {
            $table->dropColumn('movimiento_amortizacion');
        });
    }
};
