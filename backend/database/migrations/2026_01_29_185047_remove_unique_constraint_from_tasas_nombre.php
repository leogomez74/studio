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
        Schema::table('tasas', function (Blueprint $table) {
            // Eliminar constraint UNIQUE de nombre para permitir histórico de tasas
            $table->dropUnique(['nombre']);

            // Agregar índice normal (no único) para mantener performance de búsquedas
            $table->index('nombre');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tasas', function (Blueprint $table) {
            // Revertir: eliminar índice normal y restaurar UNIQUE
            $table->dropIndex(['nombre']);
            $table->unique('nombre');
        });
    }
};
