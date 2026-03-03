<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('credit_payments', function (Blueprint $table) {
            $table->string('referencia', 100)
                ->nullable()
                ->after('source')
                ->comment('Referencia del pago: Nº de recibo, cheque, transferencia, etc.');
        });
    }

    public function down(): void
    {
        Schema::table('credit_payments', function (Blueprint $table) {
            $table->dropColumn('referencia');
        });
    }
};
