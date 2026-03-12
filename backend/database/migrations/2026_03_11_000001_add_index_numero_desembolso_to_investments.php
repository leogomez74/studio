<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('investments', function (Blueprint $table) {
            $table->index('numero_desembolso');
        });
    }

    public function down(): void
    {
        Schema::table('investments', function (Blueprint $table) {
            $table->dropIndex(['numero_desembolso']);
        });
    }
};
