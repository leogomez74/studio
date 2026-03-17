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
        Schema::table('investment_payments', function (Blueprint $table) {
            $table->after('fecha_pago', function (Blueprint $table) {
                $table->decimal('monto_capital', 15, 2)->default(0);
                $table->decimal('monto_interes', 15, 2)->default(0);
            });
            //
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('investment_payments', function (Blueprint $table) {
            $table->dropColumn(['monto_capital', 'monto_interes']);
            //
        });
    }
};
