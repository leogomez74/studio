<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('analisis', function (Blueprint $table) {
            // Renombrar monto_credito a monto_sugerido (el monto calculado/sugerido)
            $table->renameColumn('monto_credito', 'monto_sugerido');

            // Agregar nuevos campos
            $table->decimal('monto_solicitado', 15, 2)->nullable()->after('category'); // Monto que viene del cliente
            $table->decimal('cuota', 15, 2)->nullable()->after('monto_sugerido'); // Cuota calculada
            $table->integer('numero_manchas')->default(0)->after('propuesta'); // Número de manchas
            $table->integer('numero_juicios')->default(0)->after('numero_manchas'); // Número de juicios
            $table->integer('numero_embargos')->default(0)->after('numero_juicios'); // Número de embargos
        });
    }

    public function down(): void
    {
        Schema::table('analisis', function (Blueprint $table) {
            // Revertir cambios
            $table->renameColumn('monto_sugerido', 'monto_credito');
            $table->dropColumn(['monto_solicitado', 'cuota', 'numero_manchas', 'numero_juicios', 'numero_embargos']);
        });
    }
};
