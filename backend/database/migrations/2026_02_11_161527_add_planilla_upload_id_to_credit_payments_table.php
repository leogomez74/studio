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
            $table->foreignId('planilla_upload_id')->nullable()->after('credit_id')->constrained('planilla_uploads');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('credit_payments', function (Blueprint $table) {
            $table->dropForeign(['planilla_upload_id']);
            $table->dropColumn('planilla_upload_id');
        });
    }
};
