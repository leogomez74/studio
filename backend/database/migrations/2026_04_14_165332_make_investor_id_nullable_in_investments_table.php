<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('investments', function (Blueprint $table) {
            $table->dropForeign(['investor_id']);
            $table->unsignedBigInteger('investor_id')->nullable()->change();
            $table->foreign('investor_id')->references('id')->on('investors')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('investments', function (Blueprint $table) {
            $table->dropForeign(['investor_id']);
            $table->unsignedBigInteger('investor_id')->nullable(false)->change();
            $table->foreign('investor_id')->references('id')->on('investors')->restrictOnDelete();
        });
    }
};
