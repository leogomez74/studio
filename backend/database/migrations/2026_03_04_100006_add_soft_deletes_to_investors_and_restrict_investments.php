<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('investors', function (Blueprint $table) {
            $table->softDeletes();
        });

        Schema::table('investments', function (Blueprint $table) {
            $table->dropForeign(['investor_id']);
            $table->foreignId('investor_id')->change()->constrained('investors')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('investments', function (Blueprint $table) {
            $table->dropForeign(['investor_id']);
            $table->foreignId('investor_id')->change()->constrained('investors')->cascadeOnDelete();
        });

        Schema::table('investors', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
