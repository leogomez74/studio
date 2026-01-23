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
        Schema::table('persons', function (Blueprint $table) {
            // Campos del cuestionario - Interés general
            $table->string('interes')->nullable()->after('source'); // credito, servicios_legales, ambos

            // Campos de crédito
            $table->string('tipo_credito')->nullable()->after('interes'); // microcredito, regular
            $table->string('monto')->nullable()->after('tipo_credito'); // rango de monto
            $table->string('uso_credito')->nullable()->after('monto'); // para qué usará el crédito
            $table->string('tiene_deudas')->nullable()->after('uso_credito'); // si/no

            // Campos financieros
            $table->string('ingreso')->nullable()->after('tiene_deudas'); // rango de ingreso
            $table->decimal('salario_exacto', 12, 2)->nullable()->after('ingreso'); // salario exacto
            $table->string('experiencia_crediticia')->nullable()->after('salario_exacto'); // historial crediticio
            $table->string('historial_mora')->nullable()->after('experiencia_crediticia'); // historial de pagos
            $table->string('tipo_vivienda')->nullable()->after('historial_mora'); // tipo de vivienda
            $table->string('dependientes')->nullable()->after('tipo_vivienda'); // número de dependientes

            // Campos de servicios legales
            $table->json('tramites')->nullable()->after('dependientes'); // array de trámites
            $table->string('urgencia')->nullable()->after('tramites'); // urgencia del trámite
            $table->text('detalle_legal')->nullable()->after('urgencia'); // detalles del trámite legal
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('persons', function (Blueprint $table) {
            $table->dropColumn([
                'interes',
                'tipo_credito',
                'monto',
                'uso_credito',
                'tiene_deudas',
                'ingreso',
                'salario_exacto',
                'experiencia_crediticia',
                'historial_mora',
                'tipo_vivienda',
                'dependientes',
                'tramites',
                'urgencia',
                'detalle_legal',
            ]);
        });
    }
};
