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
            $table->date('periodo')->nullable()->after('comentarios')->comment('Fecha del cupón al que corresponde este pago');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('investment_payments', function (Blueprint $table) {
            $table->dropColumn('periodo');
        });
    }
};
