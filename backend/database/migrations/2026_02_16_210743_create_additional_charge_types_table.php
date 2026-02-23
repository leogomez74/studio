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
        Schema::create('additional_charge_types', function (Blueprint $table) {
            $table->id();
            $table->string('key', 50)->unique()->comment('Identificador único (ej: cargo_tramite)');
            $table->string('name', 100)->comment('Nombre descriptivo');
            $table->text('description')->nullable()->comment('Descripción del cargo');
            $table->decimal('default_amount', 10, 2)->nullable()->comment('Monto por defecto');
            $table->boolean('active')->default(true)->comment('Si está activo');
            $table->timestamps();

            $table->index('active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('additional_charge_types');
    }
};
