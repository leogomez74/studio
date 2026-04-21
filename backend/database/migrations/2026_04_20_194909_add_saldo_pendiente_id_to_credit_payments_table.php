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
        Schema::table('credit_payments', function (Blueprint $table) {
            $table->unsignedBigInteger('saldo_pendiente_id')->nullable()->after('planilla_upload_id');
        });
    }

    public function down(): void
    {
        Schema::table('credit_payments', function (Blueprint $table) {
            $table->dropColumn('saldo_pendiente_id');
        });
    }
};
