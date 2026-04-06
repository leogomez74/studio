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
        Schema::create('expediente_actuaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('expediente_id')->constrained('expedientes_judiciales')->onDelete('cascade');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('notificacion_id')->nullable()->constrained('notificaciones_judiciales')->nullOnDelete();

            $table->enum('tipo', [
                'cambio_estado',        // cambio de estado/sub-estado
                'notificacion_recibida',// PDF recibido por n8n
                'actuacion_manual',     // Carlos registra actuación manual
                'aprobacion',           // Leo aprueba
                'rechazo',              // Leo rechaza
                'alerta_inactividad',   // job de 90 días
                'nota',                 // comentario libre
            ]);

            $table->string('descripcion');
            $table->json('metadata')->nullable(); // datos adicionales (estado_anterior, estado_nuevo, etc.)
            $table->timestamps();

            $table->index('expediente_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('expediente_actuaciones');
    }
};
