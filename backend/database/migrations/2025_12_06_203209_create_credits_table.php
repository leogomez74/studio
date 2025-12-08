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
        Schema::create('credits', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->string('title');
            $table->string('status')->default('Abierto');
            $table->string('category')->nullable();
            $table->string('assigned_to')->nullable();
            $table->integer('progress')->default(0);
            $table->timestamp('opened_at')->nullable();
            $table->text('description')->nullable();
            $table->foreignId('lead_id')->constrained('persons')->onDelete('cascade');
            $table->string('opportunity_id')->nullable();
            $table->foreign('opportunity_id')->references('id')->on('opportunities')->onDelete('set null');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('credits');
    }
};
