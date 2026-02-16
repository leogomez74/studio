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
        Schema::create('accounting_entry_configs', function (Blueprint $table) {
            $table->id();

            // Tipo de asiento contable
            $table->string('entry_type', 50)->unique()->comment('Tipo: PAGO_PLANILLA, PAGO_VENTANILLA, FORMALIZACION, etc.');
            $table->string('name', 100)->comment('Nombre descriptivo');
            $table->text('description')->nullable()->comment('Descripción del asiento');

            // Activación
            $table->boolean('active')->default(true);

            $table->timestamps();

            $table->index('entry_type');
            $table->index('active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('accounting_entry_configs');
    }
};
