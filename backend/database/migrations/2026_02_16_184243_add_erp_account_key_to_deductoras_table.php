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
        Schema::table('deductoras', function (Blueprint $table) {
            $table->string('erp_account_key', 50)->nullable()->after('comision')
                ->comment('Key de cuenta en erp_accounting_accounts (ej: deductora_coopenacional)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('deductoras', function (Blueprint $table) {
            $table->dropColumn('erp_account_key');
        });
    }
};
