<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('embargo_configuracion', function (Blueprint $table) {
            $table->id();
            $table->decimal('salario_minimo_inembargable', 15, 2)
                ->comment('Salario mínimo mensual más bajo del decreto (base inembargable)');
            $table->decimal('tasa_ccss', 5, 4)->default(0.1083)
                ->comment('Tasa de cargas sociales del trabajador (ej: 0.1083 = 10.83%)');
            $table->decimal('tasa_tramo1', 5, 4)->default(0.125)
                ->comment('Tasa del primer tramo de embargo (1/8)');
            $table->decimal('tasa_tramo2', 5, 4)->default(0.25)
                ->comment('Tasa del segundo tramo de embargo (1/4)');
            $table->integer('multiplicador_tramo1')->default(3)
                ->comment('Multiplicador del SMI para límite del tramo 1 (3 = hasta 3xSMI)');
            $table->json('tramos_renta')->nullable()
                ->comment('Tramos del impuesto sobre la renta [{limite, tasa}, ...]');
            $table->string('fuente')->default('manual')
                ->comment('Origen del dato: manual, pdf_mtss');
            $table->string('decreto')->nullable()
                ->comment('Número de decreto de referencia');
            $table->integer('anio')->comment('Año de vigencia');
            $table->boolean('activo')->default(true);
            $table->timestamp('ultima_verificacion')->nullable()
                ->comment('Última vez que se verificó el PDF del MTSS');
            $table->timestamps();

            $table->index(['activo', 'anio']);
        });

        // Seed con datos actuales verificados contra el MTSS (2026)
        DB::table('embargo_configuracion')->insert([
            'salario_minimo_inembargable' => 268731.31,
            'tasa_ccss' => 0.1083,
            'tasa_tramo1' => 0.125,
            'tasa_tramo2' => 0.25,
            'multiplicador_tramo1' => 3,
            'tramos_renta' => json_encode([
                ['limite' => 918000, 'tasa' => 0],
                ['limite' => 1347000, 'tasa' => 0.10],
                ['limite' => 2364000, 'tasa' => 0.15],
                ['limite' => null, 'tasa' => 0.20],
            ]),
            'fuente' => 'pdf_mtss',
            'decreto' => '45303-MTSS',
            'anio' => 2026,
            'activo' => true,
            'ultima_verificacion' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('embargo_configuracion');
    }
};
