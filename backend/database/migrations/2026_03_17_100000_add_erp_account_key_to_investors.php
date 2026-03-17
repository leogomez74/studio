<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('investors', function (Blueprint $table) {
            $table->string('erp_account_key')->nullable()->after('moneda_preferida')
                ->comment('Key de la cuenta contable ERP asociada a este inversionista (ej: inv_jairo_interes)');
        });
    }

    public function down(): void
    {
        Schema::table('investors', function (Blueprint $table) {
            $table->dropColumn('erp_account_key');
        });
    }
};
