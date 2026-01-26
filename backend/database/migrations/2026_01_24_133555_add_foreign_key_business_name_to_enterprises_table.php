<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Obtener business_names que no existen en instituciones
        $missing = DB::table('enterprises')
            ->select('business_name')
            ->whereNotIn('business_name', function ($query) {
                $query->select('nombre')->from('instituciones');
            })
            ->distinct()
            ->pluck('business_name');

        // 2. Insertar los faltantes en instituciones
        foreach ($missing as $nombre) {
            DB::table('instituciones')->insert([
                'nombre' => $nombre,
                'activa' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // 3. Crear la FK
        Schema::table('enterprises', function (Blueprint $table) {
            $table->foreign('business_name')
                ->references('nombre')
                ->on('instituciones')
                ->onUpdate('cascade')
                ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('enterprises', function (Blueprint $table) {
            $table->dropForeign(['business_name']);
        });
    }
};
