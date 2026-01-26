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
        Schema::table('analisis', function (Blueprint $table) {
            $table->index('opportunity_id');
            $table->index('lead_id');
            $table->index('estado_pep');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('analisis', function (Blueprint $table) {
            $table->dropIndex(['opportunity_id']);
            $table->dropIndex(['lead_id']);
            $table->dropIndex(['estado_pep']);
        });
    }
};
