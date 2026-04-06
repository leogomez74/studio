<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bugs', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();         // BUG-0001
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('status', ['abierto', 'en_progreso', 'en_revision', 'cerrado'])->default('abierto');
            $table->enum('priority', ['baja', 'media', 'alta', 'critica'])->default('media');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('bug_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bug_id')->constrained('bugs')->cascadeOnDelete();
            $table->string('path');
            $table->string('original_name');
            $table->integer('size')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bug_images');
        Schema::dropIfExists('bugs');
    }
};
