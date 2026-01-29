<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Migra de loan_configurations.tasa_anual a loan_configurations.tasa_id (FK)
     */
    public function up(): void
    {
        // Paso 1: Agregar columna tasa_id (nullable temporalmente)
        Schema::table('loan_configurations', function (Blueprint $table) {
            $table->unsignedBigInteger('tasa_id')->nullable()->after('tasa_anual');
        });

        // Paso 2: Migrar datos existentes
        $this->migrateExistingData();

        // Paso 3: Hacer tasa_id NOT NULL y agregar FK
        Schema::table('loan_configurations', function (Blueprint $table) {
            $table->unsignedBigInteger('tasa_id')->nullable(false)->change();
            $table->foreign('tasa_id')->references('id')->on('tasas')->onDelete('restrict');
        });

        // Paso 4: Eliminar columna tasa_anual antigua
        Schema::table('loan_configurations', function (Blueprint $table) {
            $table->dropColumn('tasa_anual');
        });
    }

    /**
     * Migrar datos existentes
     */
    private function migrateExistingData(): void
    {
        $configs = DB::table('loan_configurations')->get();

        foreach ($configs as $config) {
            $tasaAnual = (float) $config->tasa_anual;

            // Determinar nombre de tasa según tipo
            if ($config->tipo === 'microcredito') {
                $nombreTasa = 'Tasa Micro Crédito';
            } else {
                $nombreTasa = 'Tasa Regular';
            }

            // Buscar o crear tasa con ese nombre y valor
            $tasa = DB::table('tasas')
                ->where('nombre', $nombreTasa)
                ->where('activo', true)
                ->first();

            if (!$tasa) {
                // Crear nueva tasa si no existe
                $tasaId = DB::table('tasas')->insertGetId([
                    'nombre' => $nombreTasa,
                    'tasa' => $tasaAnual,
                    'inicio' => Carbon::now()->subYear(),
                    'fin' => null,
                    'activo' => true,
                    'created_at' => Carbon::now(),
                    'updated_at' => Carbon::now(),
                ]);
            } else {
                $tasaId = $tasa->id;

                // Actualizar valor de tasa si es diferente
                if ((float) $tasa->tasa !== $tasaAnual) {
                    DB::table('tasas')
                        ->where('id', $tasaId)
                        ->update(['tasa' => $tasaAnual, 'updated_at' => Carbon::now()]);
                }
            }

            // Asignar tasa_id a loan_configuration
            DB::table('loan_configurations')
                ->where('id', $config->id)
                ->update(['tasa_id' => $tasaId]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Paso 1: Re-agregar columna tasa_anual
        Schema::table('loan_configurations', function (Blueprint $table) {
            $table->decimal('tasa_anual', 5, 2)->nullable()->after('monto_maximo');
        });

        // Paso 2: Restaurar valores desde tasas
        $configs = DB::table('loan_configurations')->whereNotNull('tasa_id')->get();
        foreach ($configs as $config) {
            $tasa = DB::table('tasas')->find($config->tasa_id);
            if ($tasa) {
                DB::table('loan_configurations')
                    ->where('id', $config->id)
                    ->update(['tasa_anual' => $tasa->tasa]);
            }
        }

        // Paso 3: Eliminar FK y columna tasa_id
        Schema::table('loan_configurations', function (Blueprint $table) {
            $table->dropForeign(['tasa_id']);
            $table->dropColumn('tasa_id');
        });
    }
};
