<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('investment_coupons', function (Blueprint $table) {
            $table->decimal('monto_pagado_real', 15, 2)->nullable()->after('interes_neto');
            $table->string('motivo_correccion')->nullable()->after('comprobante');
        });
    }

    public function down(): void
    {
        Schema::table('investment_coupons', function (Blueprint $table) {
            $table->dropColumn(['monto_pagado_real', 'motivo_correccion']);
        });
    }
};
