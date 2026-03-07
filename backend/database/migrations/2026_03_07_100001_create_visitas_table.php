<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visitas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('institucion_id')->nullable()->constrained('instituciones')->nullOnDelete();
            $table->string('institucion_nombre')->nullable(); // para instituciones no registradas
            $table->date('fecha_planificada');
            $table->date('fecha_realizada')->nullable();
            $table->enum('status', ['Planificada', 'Completada', 'Cancelada', 'Reprogramada'])->default('Planificada');
            $table->text('notas')->nullable();
            $table->text('resultado')->nullable();
            $table->string('contacto_nombre')->nullable();
            $table->string('contacto_telefono')->nullable();
            $table->string('contacto_email')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'fecha_planificada']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visitas');
    }
};
