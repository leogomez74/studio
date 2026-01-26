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
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            $table->string('conversation_id'); // ID de la conversación (puede ser lead_id, credit_id, etc.)
            $table->enum('sender_type', ['client', 'agent', 'system'])->default('system'); // Tipo de remitente
            $table->string('sender_name')->nullable(); // Nombre del remitente
            $table->text('text'); // Contenido del mensaje
            $table->string('message_type')->default('text'); // Tipo: text, quote, notification, etc.
            $table->json('metadata')->nullable(); // Datos adicionales (ej: datos de cotización)
            $table->timestamps();

            // Índices para búsquedas rápidas
            $table->index('conversation_id');
            $table->index('sender_type');
            $table->index(['conversation_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chat_messages');
    }
};
