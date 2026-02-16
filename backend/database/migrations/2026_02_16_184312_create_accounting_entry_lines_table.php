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
        Schema::create('accounting_entry_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('accounting_entry_config_id')->constrained('accounting_entry_configs')->onDelete('cascade');

            // Orden de la línea
            $table->integer('line_order')->default(0)->comment('Orden de aparición');

            // Tipo de movimiento
            $table->enum('movement_type', ['debit', 'credit'])->comment('Débito o Crédito');

            // Tipo de cuenta
            $table->enum('account_type', ['fixed', 'deductora'])->comment('fixed = cuenta fija, deductora = cuenta por deductora');
            $table->string('account_key', 50)->nullable()->comment('Key de erp_accounting_accounts (si account_type=fixed)');

            // Descripción
            $table->string('description', 255)->nullable()->comment('Descripción de la línea');

            $table->timestamps();

            $table->index(['accounting_entry_config_id', 'line_order'], 'idx_config_line_order');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('accounting_entry_lines');
    }
};
