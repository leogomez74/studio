<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tareas_ruta', function (Blueprint $table) {
            $table->id();
            $table->string('titulo');
            $table->text('descripcion')->nullable();
            $table->enum('tipo', ['entrega', 'recoleccion', 'tramite', 'deposito', 'otro'])->default('entrega');
            $table->enum('prioridad', ['normal', 'urgente', 'critica'])->default('normal');
            $table->enum('status', ['pendiente', 'asignada', 'en_transito', 'completada', 'fallida', 'cancelada'])->default('pendiente');

            $table->foreignId('solicitado_por')->constrained('users');
            $table->foreignId('asignado_a')->nullable()->constrained('users');
            $table->foreignId('ruta_diaria_id')->nullable()->constrained('rutas_diarias')->nullOnDelete();

            $table->string('empresa_destino')->nullable();
            $table->text('direccion_destino')->nullable();
            $table->string('provincia')->nullable();
            $table->string('canton')->nullable();
            $table->string('contacto_nombre')->nullable();
            $table->string('contacto_telefono')->nullable();

            $table->date('fecha_limite')->nullable();
            $table->date('fecha_asignada')->nullable();
            $table->unsignedInteger('posicion')->nullable();

            $table->boolean('prioridad_override')->default(false);
            $table->foreignId('prioridad_por')->nullable()->constrained('users');

            $table->timestamp('completada_at')->nullable();
            $table->text('notas_completado')->nullable();
            $table->string('motivo_fallo')->nullable();

            $table->string('referencia_tipo')->nullable();
            $table->unsignedBigInteger('referencia_id')->nullable();

            $table->timestamps();

            $table->index(['status', 'prioridad']);
            $table->index(['ruta_diaria_id', 'posicion']);
            $table->index(['solicitado_por', 'created_at']);
            $table->index(['referencia_tipo', 'referencia_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tareas_ruta');
    }
};
