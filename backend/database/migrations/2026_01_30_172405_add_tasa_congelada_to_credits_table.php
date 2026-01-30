<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('credits', function (Blueprint $table) {
            $table->decimal('tasa_anual', 5, 2)->nullable()->after('tasa_id');
            $table->decimal('tasa_maxima', 5, 2)->nullable()->after('tasa_anual');
        });

        // Copiar valores actuales de la tabla tasas a los créditos existentes
        DB::statement('
            UPDATE credits c
            INNER JOIN tasas t ON c.tasa_id = t.id
            SET c.tasa_anual = t.tasa,
                c.tasa_maxima = t.tasa_maxima
        ');
    }

    public function down(): void
    {
        Schema::table('credits', function (Blueprint $table) {
            $table->dropColumn(['tasa_anual', 'tasa_maxima']);
        });
    }
};
