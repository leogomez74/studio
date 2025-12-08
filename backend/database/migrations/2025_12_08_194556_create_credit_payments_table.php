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
        Schema::create('credit_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('credit_id')->constrained('credits')->cascadeOnDelete();

            $table->integer('numero_cuota');
            $table->string('proceso')->nullable();
            $table->date('fecha_cuota')->nullable();
            $table->date('fecha_pago')->nullable();

            $table->decimal('cuota', 15, 2)->default(0);
            $table->decimal('cargos', 15, 2)->default(0);
            $table->decimal('poliza', 15, 2)->default(0);
            $table->decimal('interes_corriente', 15, 2)->default(0);
            $table->decimal('interes_moratorio', 15, 2)->default(0);
            $table->decimal('amortizacion', 15, 2)->default(0);
            $table->decimal('saldo_anterior', 15, 2)->default(0);
            $table->decimal('nuevo_saldo', 15, 2)->default(0);

            $table->string('estado')->default('Pendiente');
            $table->date('fecha_movimiento')->nullable();
            $table->decimal('movimiento_total', 15, 2)->default(0);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('credit_payments');
    }
};
