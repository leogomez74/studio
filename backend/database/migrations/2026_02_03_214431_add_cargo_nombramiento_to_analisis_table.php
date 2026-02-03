<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('analisis', function (Blueprint $table) {
            $table->string('cargo', 255)->nullable()->after('propuesta');
            $table->string('nombramiento', 255)->nullable()->after('cargo');
        });
    }

    public function down(): void
    {
        Schema::table('analisis', function (Blueprint $table) {
            $table->dropColumn(['cargo', 'nombramiento']);
        });
    }
};
