<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('erp_accounting_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('key', 50)->unique();          // Identificador interno: 'banco_credipep', 'cuentas_por_cobrar'
            $table->string('account_code', 20);            // Código en el ERP: '1-100', '1-200'
            $table->string('account_name', 100);           // Nombre descriptivo: 'Banco CREDIPEP'
            $table->string('description', 255)->nullable(); // Descripción de uso
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        // Insertar cuentas predeterminadas (sin código, el usuario debe configurarlos)
        DB::table('erp_accounting_accounts')->insert([
            [
                'key' => 'banco_credipep',
                'account_code' => '',
                'account_name' => 'Banco CREDIPEP',
                'description' => 'Cuenta bancaria principal donde entra y sale el dinero de los créditos',
                'active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key' => 'cuentas_por_cobrar',
                'account_code' => '',
                'account_name' => 'Cuentas por Cobrar',
                'description' => 'Cuenta que registra el dinero que los clientes deben a CREDIPEP',
                'active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('erp_accounting_accounts');
    }
};
