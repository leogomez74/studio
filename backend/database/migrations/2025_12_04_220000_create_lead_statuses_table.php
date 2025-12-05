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
        if (!Schema::hasTable('lead_statuses')) {
            Schema::create('lead_statuses', function (Blueprint $table) {
                $table->id();
                $table->string('name', 150)->unique();
                $table->string('slug')->index();
                $table->string('description')->nullable();
                $table->boolean('is_default')->default(false);
                $table->integer('order_column')->default(0);
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lead_statuses');
    }
};
