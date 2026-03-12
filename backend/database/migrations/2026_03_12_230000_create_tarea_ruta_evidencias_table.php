<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tarea_ruta_evidencias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tarea_ruta_id')->constrained('tareas_ruta')->cascadeOnDelete();
            $table->foreignId('uploaded_by')->constrained('users');
            $table->string('name');
            $table->string('path');
            $table->string('mime_type', 100);
            $table->unsignedInteger('size');
            $table->string('notes', 500)->nullable();
            $table->timestamps();

            $table->index('tarea_ruta_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tarea_ruta_evidencias');
    }
};
