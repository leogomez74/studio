<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comisiones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('tipo', ['credito', 'inversion']);
            // Referencia polimórfica al crédito o inversión
            $table->unsignedBigInteger('referencia_id');
            $table->string('referencia_tipo'); // App\Models\Credit o App\Models\Investment
            $table->decimal('monto_operacion', 15, 2);
            $table->decimal('porcentaje', 5, 4);
            $table->decimal('monto_comision', 15, 2);
            $table->enum('estado', ['Pendiente', 'Aprobada', 'Pagada'])->default('Pendiente');
            $table->date('fecha_operacion');
            $table->date('fecha_aprobacion')->nullable();
            $table->date('fecha_pago')->nullable();
            $table->foreignId('aprobada_por')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notas')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'estado']);
            $table->index(['referencia_id', 'referencia_tipo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comisiones');
    }
};
