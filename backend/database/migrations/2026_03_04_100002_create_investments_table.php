<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('investments', function (Blueprint $table) {
            $table->id();
            $table->string('numero_desembolso', 20)->unique();
            $table->foreignId('investor_id')->constrained('investors')->cascadeOnDelete();
            $table->decimal('monto_capital', 15, 2);
            $table->integer('plazo_meses');
            $table->date('fecha_inicio');
            $table->date('fecha_vencimiento');
            $table->decimal('tasa_anual', 8, 4);
            $table->enum('moneda', ['CRC', 'USD']);
            $table->enum('forma_pago', ['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'RESERVA']);
            $table->boolean('es_capitalizable')->default(false);
            $table->enum('estado', ['Activa', 'Finalizada', 'Liquidada'])->default('Activa');
            $table->text('notas')->nullable();
            $table->timestamps();

            $table->index('investor_id');
            $table->index('estado');
            $table->index('moneda');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('investments');
    }
};
