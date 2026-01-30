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
            // Índice en created_at para ordenamiento (latest())
            $table->index('created_at');

            // Índice en status para filtros
            $table->index('status');

            // Índice compuesto para queries que filtran por status y ordenan por fecha
            $table->index(['status', 'created_at']);

            // Índice en lead_id ya existe por foreign key, pero verificamos
            // Índice en deductora_id para filtros por deductora
            if (Schema::hasColumn('credits', 'deductora_id')) {
                $table->index('deductora_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('credits', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
            $table->dropIndex(['status']);
            $table->dropIndex(['status', 'created_at']);

            if (Schema::hasColumn('credits', 'deductora_id')) {
                $table->dropIndex(['deductora_id']);
            }
        });
    }
};
