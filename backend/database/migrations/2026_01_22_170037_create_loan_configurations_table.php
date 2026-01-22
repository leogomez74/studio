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
        Schema::create('loan_configurations', function (Blueprint $table) {
            $table->id();
            $table->string('tipo')->unique(); // 'regular' o 'microcredito'
            $table->string('nombre'); // 'Crédito Regular' o 'Micro-crédito'
            $table->text('descripcion')->nullable();
            $table->decimal('monto_minimo', 15, 2)->default(0);
            $table->decimal('monto_maximo', 15, 2)->default(0);
            $table->decimal('tasa_anual', 5, 2)->default(0); // Tasa de interés anual %
            $table->integer('plazo_minimo')->default(6); // Meses
            $table->integer('plazo_maximo')->default(72); // Meses
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('loan_configurations');
    }
};
