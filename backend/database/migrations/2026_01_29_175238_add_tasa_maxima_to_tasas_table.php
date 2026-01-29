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
        Schema::table('tasas', function (Blueprint $table) {
            $table->decimal('tasa_maxima', 5, 2)->nullable()->after('tasa')->comment('Tasa máxima permitida (TMP) en porcentaje');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tasas', function (Blueprint $table) {
            $table->dropColumn('tasa_maxima');
        });
    }
};
