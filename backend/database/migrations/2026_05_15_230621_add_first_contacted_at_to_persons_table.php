<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('persons', function (Blueprint $table) {
            // Primer contacto comercial del lead (primer comentario en el lead o primera asignación).
            // Permite calcular el KPI real de "Tiempo de Respuesta" en lugar de usar updated_at.
            $table->timestamp('first_contacted_at')->nullable()->after('is_active');
            $table->index('first_contacted_at');
        });
    }

    public function down(): void
    {
        Schema::table('persons', function (Blueprint $table) {
            $table->dropIndex(['first_contacted_at']);
            $table->dropColumn('first_contacted_at');
        });
    }
};
