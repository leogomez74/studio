<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('investment_coupons', function (Blueprint $table) {
            $table->decimal('capital_acumulado', 15, 2)->nullable()->after('monto_reservado');
        });
    }

    public function down(): void
    {
        Schema::table('investment_coupons', function (Blueprint $table) {
            $table->dropColumn('capital_acumulado');
        });
    }
};
