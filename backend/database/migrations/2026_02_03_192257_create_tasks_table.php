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
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->string('project_code', 255)->nullable();
            $table->string('project_name', 255)->nullable();
            $table->string('title', 255);
            $table->text('details')->nullable();
            $table->enum('status', ['pendiente', 'en_progreso', 'completada', 'archivada', 'deleted'])->default('pendiente');
            $table->enum('priority', ['alta', 'media', 'baja'])->default('media');
            $table->unsignedBigInteger('assigned_to')->nullable();
            $table->date('start_date')->nullable();
            $table->date('due_date')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->index('project_code', 'idx_project_code');
            $table->foreign('assigned_to')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
