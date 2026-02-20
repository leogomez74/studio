<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Campos de reintento en accounting_entry_logs
        Schema::table('accounting_entry_logs', function (Blueprint $table) {
            $table->unsignedTinyInteger('retry_count')->default(0)->after('source_method')
                  ->comment('Número de reintentos realizados');
            $table->unsignedTinyInteger('max_retries')->default(3)->after('retry_count')
                  ->comment('Máximo de reintentos permitidos');
            $table->timestamp('next_retry_at')->nullable()->after('max_retries')
                  ->comment('Cuándo intentar el siguiente reintento');
            $table->timestamp('last_retry_at')->nullable()->after('next_retry_at')
                  ->comment('Cuándo fue el último reintento');

            $table->index(['status', 'retry_count', 'next_retry_at'], 'idx_retryable');
        });

        // Campo de validación en erp_accounting_accounts
        Schema::table('erp_accounting_accounts', function (Blueprint $table) {
            $table->timestamp('validated_at')->nullable()->after('active')
                  ->comment('Última vez que la cuenta fue validada exitosamente en el ERP');
        });
    }

    public function down(): void
    {
        Schema::table('accounting_entry_logs', function (Blueprint $table) {
            $table->dropIndex('idx_retryable');
            $table->dropColumn(['retry_count', 'max_retries', 'next_retry_at', 'last_retry_at']);
        });

        Schema::table('erp_accounting_accounts', function (Blueprint $table) {
            $table->dropColumn('validated_at');
        });
    }
};
