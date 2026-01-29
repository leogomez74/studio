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
     * Migra de credits.tasa_anual (decimal) a credits.tasa_id (FK)
     */
    public function up(): void
    {
        // Paso 1: Agregar columna tasa_id (nullable temporalmente)
        Schema::table('credits', function (Blueprint $table) {
            $table->unsignedBigInteger('tasa_id')->nullable()->after('tasa_anual');
        });

        // Paso 2: Migrar datos existentes
        $this->migrateExistingData();

        // Paso 3: Hacer tasa_id NOT NULL y agregar FK
        Schema::table('credits', function (Blueprint $table) {
            $table->unsignedBigInteger('tasa_id')->nullable(false)->change();
            $table->foreign('tasa_id')->references('id')->on('tasas')->onDelete('restrict');
        });

        // Paso 4: Eliminar columna tasa_anual antigua
        Schema::table('credits', function (Blueprint $table) {
            $table->dropColumn('tasa_anual');
        });
    }

    /**
     * Migrar datos existentes: crear tasas por defecto
     */
    private function migrateExistingData(): void
    {
        $now = Carbon::now();
        $inicioVigencia = Carbon::now()->subYear(); // Retroactivo 1 año

        // Crear tasas estándar del sistema
        $tasasEstandar = [
            ['nombre' => 'Tasa Regular', 'tasa' => 33.50],
            ['nombre' => 'Tasa Micro Crédito', 'tasa' => 52.30],
        ];

        $tasaMap = [];

        foreach ($tasasEstandar as $tasaData) {
            $tasaExistente = DB::table('tasas')
                ->where('nombre', $tasaData['nombre'])
                ->first();

            if (!$tasaExistente) {
                $tasaId = DB::table('tasas')->insertGetId([
                    'nombre' => $tasaData['nombre'],
                    'tasa' => $tasaData['tasa'],
                    'inicio' => $inicioVigencia,
                    'fin' => null,
                    'activo' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $tasaMap[$tasaData['tasa']] = $tasaId;
            } else {
                $tasaMap[$tasaData['tasa']] = $tasaExistente->id;
            }
        }

        // Obtener todas las tasas únicas de créditos existentes
        $tasasUnicas = DB::table('credits')
            ->select('tasa_anual', 'tipo_credito')
            ->distinct()
            ->whereNotNull('tasa_anual')
            ->get();

        // Mapear tasas existentes a las nuevas tasas con nombre
        foreach ($tasasUnicas as $item) {
            $tasaAnual = (float) $item->tasa_anual;

            // Determinar el nombre de la tasa según el valor de la tasa
            if ($tasaAnual >= 50) {
                // Micro crédito (tasas altas)
                $tasaId = $this->getTasaIdPorNombre('Tasa Micro Crédito', $tasaMap);
            } else {
                // Crédito regular
                $tasaId = $this->getTasaIdPorNombre('Tasa Regular', $tasaMap);
            }

            // Actualizar créditos con esta tasa
            DB::table('credits')
                ->where('tasa_anual', $tasaAnual)
                ->update(['tasa_id' => $tasaId]);
        }

        // Créditos sin tasa_anual → asignar Tasa Regular por defecto
        $tasaRegularId = $this->getTasaIdPorNombre('Tasa Regular', $tasaMap);

        DB::table('credits')
            ->whereNull('tasa_id')
            ->update(['tasa_id' => $tasaRegularId]);
    }

    /**
     * Obtener ID de tasa por nombre
     */
    private function getTasaIdPorNombre(string $nombre, array $tasaMap): int
    {
        $tasa = DB::table('tasas')->where('nombre', $nombre)->first();
        return $tasa ? $tasa->id : array_values($tasaMap)[0];
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Paso 1: Re-agregar columna tasa_anual
        Schema::table('credits', function (Blueprint $table) {
            $table->decimal('tasa_anual', 5, 2)->nullable()->after('plazo');
        });

        // Paso 2: Restaurar valores desde tasas
        $credits = DB::table('credits')->whereNotNull('tasa_id')->get();
        foreach ($credits as $credit) {
            $tasa = DB::table('tasas')->find($credit->tasa_id);
            if ($tasa) {
                DB::table('credits')
                    ->where('id', $credit->id)
                    ->update(['tasa_anual' => $tasa->tasa]);
            }
        }

        // Paso 3: Eliminar FK y columna tasa_id
        Schema::table('credits', function (Blueprint $table) {
            $table->dropForeign(['tasa_id']);
            $table->dropColumn('tasa_id');
        });
    }
};
