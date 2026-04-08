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
        Schema::table('evolution_instances', function (Blueprint $table) {
            $table->string('alias')->default('')->after('api_key');
        });
    }

    public function down(): void
    {
        Schema::table('evolution_instances', function (Blueprint $table) {
            $table->dropColumn('alias');
        });
    }
};
