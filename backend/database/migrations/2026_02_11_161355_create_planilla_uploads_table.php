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
        Schema::create('planilla_uploads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deductora_id')->constrained('deductoras');
            $table->foreignId('user_id')->constrained('users'); // Quién cargó
            $table->date('fecha_planilla'); // Fecha de la planilla (mes que se paga)
            $table->timestamp('uploaded_at'); // Cuándo se cargó
            $table->string('nombre_archivo')->nullable();
            $table->integer('cantidad_pagos')->default(0); // Cuántos pagos se procesaron
            $table->decimal('monto_total', 15, 2)->default(0); // Suma de todos los pagos
            $table->enum('estado', ['activa', 'anulada'])->default('activa');
            $table->timestamp('anulada_at')->nullable();
            $table->foreignId('anulada_por')->nullable()->constrained('users');
            $table->text('motivo_anulacion')->nullable();
            $table->timestamps();

            // Índices
            $table->index(['deductora_id', 'fecha_planilla']);
            $table->index('estado');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('planilla_uploads');
    }
};
