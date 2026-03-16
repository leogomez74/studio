<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('persons', function (Blueprint $table) {
            // Cache completo del reporte Credid
            $table->json('credid_data')->nullable()->after('estado_puesto');
            $table->timestamp('credid_consultado_at')->nullable()->after('credid_data');

            // Campos resumen queryables (extraídos del JSON)
            $table->unsignedSmallInteger('indice_desarrollo_social')->nullable()->after('credid_consultado_at');
            $table->string('nivel_desarrollo_social', 20)->nullable()->after('indice_desarrollo_social');
            $table->unsignedSmallInteger('total_vehiculos')->default(0)->after('nivel_desarrollo_social');
            $table->unsignedSmallInteger('total_propiedades')->default(0)->after('total_vehiculos');
            $table->decimal('patrimonio_vehiculos', 14, 2)->nullable()->after('total_propiedades');
            $table->decimal('patrimonio_propiedades', 14, 2)->nullable()->after('patrimonio_vehiculos');
            $table->decimal('total_hipotecas', 14, 2)->nullable()->after('patrimonio_propiedades');
            $table->decimal('total_prendas', 14, 2)->nullable()->after('total_hipotecas');
            $table->boolean('es_pep')->default(false)->after('total_prendas');
            $table->boolean('en_listas_internacionales')->default(false)->after('es_pep');
            $table->unsignedSmallInteger('total_hijos')->nullable()->after('en_listas_internacionales');
        });
    }

    public function down(): void
    {
        Schema::table('persons', function (Blueprint $table) {
            $table->dropColumn([
                'credid_data',
                'credid_consultado_at',
                'indice_desarrollo_social',
                'nivel_desarrollo_social',
                'total_vehiculos',
                'total_propiedades',
                'patrimonio_vehiculos',
                'patrimonio_propiedades',
                'total_hipotecas',
                'total_prendas',
                'es_pep',
                'en_listas_internacionales',
                'total_hijos',
            ]);
        });
    }
};
