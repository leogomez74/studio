<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_automations', function (Blueprint $table) {
            $table->id();
            $table->string('event_type', 50);
            $table->string('title', 255);
            $table->unsignedBigInteger('assigned_to')->nullable();
            $table->enum('priority', ['alta', 'media', 'baja'])->default('media');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('assigned_to')->references('id')->on('users')->onDelete('set null');
            $table->unique('event_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_automations');
    }
};
