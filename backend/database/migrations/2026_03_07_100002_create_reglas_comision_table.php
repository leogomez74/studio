<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reglas_comision', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->enum('tipo', ['credito', 'inversion']);
            $table->decimal('monto_minimo', 15, 2)->default(0);
            $table->decimal('monto_maximo', 15, 2)->nullable(); // null = sin tope
            $table->decimal('porcentaje', 5, 4); // ej: 0.0050 = 0.5%
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reglas_comision');
    }
};
