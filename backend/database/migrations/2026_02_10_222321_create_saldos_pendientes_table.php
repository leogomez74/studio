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
        Schema::create('saldos_pendientes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('credit_id')->constrained('credits')->cascadeOnDelete();
            $table->foreignId('credit_payment_id')->constrained('credit_payments')->cascadeOnDelete();
            $table->decimal('monto', 15, 2);
            $table->string('origen')->default('Planilla');
            $table->date('fecha_origen');
            $table->string('estado')->default('pendiente'); // pendiente, asignado_cuota, asignado_capital
            $table->timestamp('asignado_at')->nullable();
            $table->text('notas')->nullable();
            $table->string('cedula')->nullable();
            $table->timestamps();

            $table->index(['estado']);
            $table->index(['credit_id', 'estado']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('saldos_pendientes');
    }
};
