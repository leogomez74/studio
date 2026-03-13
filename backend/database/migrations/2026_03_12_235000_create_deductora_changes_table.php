<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deductora_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('credit_id')->constrained('credits')->cascadeOnDelete();
            $table->string('reference')->nullable();
            $table->foreignId('lead_id')->nullable()->constrained('persons')->nullOnDelete();
            $table->string('cedula', 20)->nullable();
            $table->string('cliente')->nullable();
            $table->foreignId('deductora_anterior_id')->nullable()->constrained('deductoras')->nullOnDelete();
            $table->string('deductora_anterior_nombre')->nullable();
            $table->foreignId('deductora_nueva_id')->nullable()->constrained('deductoras')->nullOnDelete();
            $table->string('deductora_nueva_nombre')->nullable();
            $table->string('tipo_movimiento'); // inclusion, exclusion, traslado, refundicion
            $table->string('motivo')->nullable();
            $table->decimal('cuota', 15, 2)->default(0);
            $table->decimal('saldo', 15, 2)->default(0);
            $table->decimal('tasa_anual', 5, 2)->default(0);
            $table->integer('plazo')->default(0);
            $table->date('fecha_formalizacion')->nullable();
            $table->date('fecha_movimiento');
            $table->string('periodo', 7); // YYYY-MM format for monthly grouping
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['deductora_anterior_id', 'periodo']);
            $table->index(['deductora_nueva_id', 'periodo']);
            $table->index(['credit_id', 'periodo']);
            $table->index('periodo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deductora_changes');
    }
};
