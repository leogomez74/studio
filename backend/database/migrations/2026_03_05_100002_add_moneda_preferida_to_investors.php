<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('investors', function (Blueprint $table) {
            $table->enum('moneda_preferida', ['CRC', 'USD'])->default('CRC')->after('banco');
        });
    }

    public function down(): void
    {
        Schema::table('investors', function (Blueprint $table) {
            $table->dropColumn('moneda_preferida');
        });
    }
};
