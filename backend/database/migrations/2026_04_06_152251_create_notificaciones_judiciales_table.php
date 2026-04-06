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
        Schema::create('notificaciones_judiciales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('expediente_id')->nullable()->constrained('expedientes_judiciales')->nullOnDelete();

            // Datos del correo/notificación
            $table->string('numero_expediente_pj')->nullable(); // extraído del PDF/correo
            $table->string('tipo_acto'); // sentencia, embargo, notificacion, resolución, etc.
            $table->date('fecha_acto')->nullable();
            $table->text('descripcion')->nullable();

            // Archivos
            $table->string('archivo_pdf')->nullable(); // ruta en storage
            $table->string('archivo_nombre_original')->nullable();

            // Estado de procesamiento por n8n
            $table->enum('estado_procesamiento', [
                'pendiente',    // recibido por n8n, no procesado
                'clasificado',  // IA clasificó el tipo de acto
                'vinculado',    // vinculado a un expediente
                'indefinido',   // no se pudo clasificar
            ])->default('pendiente');

            $table->decimal('confianza_clasificacion', 5, 2)->nullable(); // 0-100% IA confidence
            $table->string('correo_origen')->nullable();
            $table->timestamp('recibido_at')->nullable();

            $table->timestamps();

            $table->index(['numero_expediente_pj', 'estado_procesamiento'], 'nj_expediente_estado_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notificaciones_judiciales');
    }
};
