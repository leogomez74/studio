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
        Schema::table('investors', function (Blueprint $table) {
            $table->string('erp_account_key_prestamos')->nullable()->after('erp_account_key')
                ->comment('Cuenta ERP para asiento de capital recibido (Préstamos por Pagar)');
            $table->string('erp_account_key_intereses')->nullable()->after('erp_account_key_prestamos')
                ->comment('Cuenta ERP para asiento de intereses devengados (Intereses por Pagar)');
        });
    }

    public function down(): void
    {
        Schema::table('investors', function (Blueprint $table) {
            $table->dropColumn(['erp_account_key_prestamos', 'erp_account_key_intereses']);
        });
    }
};
