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
        Schema::table('accounting_entry_lines', function (Blueprint $table) {
            $table->string('amount_component', 50)
                ->default('total')
                ->after('description')
                ->comment('Componente del monto: total, interes_corriente, interes_moratorio, poliza, capital, cargo_adicional');

            $table->string('cargo_adicional_key', 50)
                ->nullable()
                ->after('amount_component')
                ->comment('Key del cargo adicional específico (cargo_tramite, cargo_documento, etc.)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('accounting_entry_lines', function (Blueprint $table) {
            $table->dropColumn(['amount_component', 'cargo_adicional_key']);
        });
    }
};
