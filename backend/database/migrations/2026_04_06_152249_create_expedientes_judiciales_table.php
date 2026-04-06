<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expedientes_judiciales', function (Blueprint $table) {
            $table->id();
            $table->string('numero_expediente')->unique()->nullable();
            $table->foreignId('credit_id')->constrained('credits')->onDelete('restrict');
            $table->string('cedula_deudor', 20);
            $table->string('nombre_deudor');
            $table->decimal('monto_demanda', 15, 2)->default(0);

            // Estado principal del caso
            $table->enum('estado', [
                'posible',      // Candidato: 4+ meses de atraso, pendiente aprobación
                'propuesto',    // Carlos lo propone, esperando aprobación de Leo
                'rechazado',    // Leo rechazó con razón
                'activo',       // Aprobado y en proceso judicial
                'cerrado',      // Caso cerrado (cobrado, prescrito, desistido)
            ])->default('posible');

            // Sub-estado (solo cuando estado = 'activo')
            $table->enum('sub_estado', [
                'curso',
                'embargo_salario',
                'retencion',
                'notificado',
            ])->nullable();

            // Flujo de aprobación
            $table->foreignId('propuesto_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('propuesto_at')->nullable();
            $table->foreignId('aprobado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('aprobado_at')->nullable();
            $table->text('razon_rechazo')->nullable();

            // Datos del abogado / juzgado
            $table->string('abogado')->nullable();
            $table->string('juzgado')->nullable();
            $table->date('fecha_presentacion')->nullable();
            $table->date('fecha_ultima_actuacion')->nullable();

            // Control de prescripción e impulso procesal
            $table->boolean('alerta_impulso')->default(false);  // 90 días sin actuación
            $table->boolean('alerta_prescripcion')->default(false);  // 3 años sin actuación

            $table->text('notas')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('cedula_deudor');
            $table->index(['estado', 'sub_estado']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expedientes_judiciales');
    }
};
