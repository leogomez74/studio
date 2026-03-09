<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rutas_diarias', function (Blueprint $table) {
            $table->id();
            $table->date('fecha');
            $table->foreignId('mensajero_id')->constrained('users');
            $table->enum('status', ['borrador', 'confirmada', 'en_progreso', 'completada'])->default('borrador');
            $table->unsignedInteger('total_tareas')->default(0);
            $table->unsignedInteger('completadas')->default(0);
            $table->text('notas')->nullable();
            $table->foreignId('confirmada_por')->nullable()->constrained('users');
            $table->timestamp('confirmada_at')->nullable();
            $table->timestamps();

            $table->unique(['fecha', 'mensajero_id']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rutas_diarias');
    }
};
