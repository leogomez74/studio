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
        Schema::table('enterprises_requirements', function (Blueprint $table) {
            $table->integer('quantity')->default(1)->after('file_extension');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('enterprises_requirements', function (Blueprint $table) {
            $table->dropColumn('quantity');
        });
    }
};
