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
        Schema::create('tasas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre')->unique()->comment('Identificador de tipo de tasa (ej: "Tasa Regular", "Tasa Mora")');
            $table->decimal('tasa', 5, 2)->comment('Porcentaje de tasa anual (ej: 33.50)');
            $table->date('inicio')->comment('Fecha de inicio de vigencia');
            $table->date('fin')->nullable()->comment('Fecha de fin de vigencia (null = indefinido)');
            $table->boolean('activo')->default(true)->comment('Si la tasa está activa (1) o inactiva (0)');
            $table->timestamps();

            // Índices para mejorar búsquedas
            $table->index(['nombre', 'activo']);
            $table->index(['activo', 'inicio', 'fin']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tasas');
    }
};
