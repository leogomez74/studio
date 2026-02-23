<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounting_entry_logs', function (Blueprint $table) {
            $table->id();

            // Identificación del asiento
            $table->string('entry_type', 50)->comment('FORMALIZACION, PAGO_PLANILLA, PAGO_VENTANILLA, etc.');
            $table->string('reference', 100)->comment('Referencia del asiento');

            // Estado del envío
            $table->enum('status', ['pending', 'success', 'error', 'skipped'])
                  ->default('pending')
                  ->comment('Resultado del envío al ERP');

            // Datos financieros
            $table->decimal('amount', 15, 2)->comment('Monto total del asiento');
            $table->decimal('total_debit', 15, 2)->nullable()->comment('Total débitos confirmado por ERP');
            $table->decimal('total_credit', 15, 2)->nullable()->comment('Total créditos confirmado por ERP');

            // Respuesta del ERP
            $table->string('erp_journal_entry_id', 100)->nullable()->comment('ID del asiento en el ERP');
            $table->string('erp_message', 500)->nullable()->comment('Mensaje de respuesta del ERP');
            $table->string('error_message', 1000)->nullable()->comment('Mensaje de error si falló');
            $table->unsignedSmallInteger('http_status')->nullable()->comment('Código HTTP de la respuesta');

            // Payload y respuesta completos para auditoría
            $table->json('payload_sent')->nullable()->comment('Payload completo enviado al ERP');
            $table->json('erp_response')->nullable()->comment('Respuesta completa del ERP');

            // Datos de contexto
            $table->json('context')->nullable()->comment('credit_id, cedula, lead_nombre, deductora, breakdown');

            // Origen
            $table->string('source_method', 50)->nullable()->comment('configurable o legacy');

            $table->timestamps();

            // Índices para consultas comunes
            $table->index('entry_type');
            $table->index('status');
            $table->index('reference');
            $table->index('erp_journal_entry_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_entry_logs');
    }
};
