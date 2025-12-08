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
        Schema::table('credits', function (Blueprint $table) {
            // Dropping old columns if they conflict or are not needed, but for safety I'll just add new ones or modify.
            // Assuming 'reference' maps to 'numero_operacion' or we add a new one.
            // Let's add the specific fields requested.

            $table->string('tipo_credito')->nullable();
            $table->string('numero_operacion')->unique()->nullable(); // Can be same as reference
            $table->decimal('monto_credito', 15, 2)->default(0);
            $table->decimal('cuota', 15, 2)->default(0);
            $table->date('fecha_ultimo_pago')->nullable();
            $table->string('garantia')->nullable(); // pagare
            $table->date('fecha_culminacion_credito')->nullable();
            $table->decimal('tasa_anual', 5, 2)->default(0);
            $table->integer('plazo')->default(0); // months
            $table->integer('cuotas_atrasadas')->default(0);

            $table->foreignId('deductora_id')->nullable()->constrained('deductoras')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('credits', function (Blueprint $table) {
            $table->dropForeign(['deductora_id']);
            $table->dropColumn([
                'tipo_credito',
                'numero_operacion',
                'monto_credito',
                'cuota',
                'fecha_ultimo_pago',
                'garantia',
                'fecha_culminacion_credito',
                'tasa_anual',
                'plazo',
                'cuotas_atrasadas',
                'deductora_id'
            ]);
        });
    }
};
