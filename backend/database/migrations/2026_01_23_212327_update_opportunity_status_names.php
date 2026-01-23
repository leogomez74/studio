<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Actualizar los nombres de estados existentes
        DB::table('opportunities')
            ->where('status', 'Abierta')
            ->update(['status' => 'Pendiente']);

        DB::table('opportunities')
            ->where('status', 'Ganada')
            ->update(['status' => 'Analizada']);

        DB::table('opportunities')
            ->where('status', 'Nueva')
            ->update(['status' => 'Pendiente']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revertir los cambios si es necesario
        DB::table('opportunities')
            ->where('status', 'Pendiente')
            ->update(['status' => 'Abierta']);

        DB::table('opportunities')
            ->where('status', 'Analizada')
            ->update(['status' => 'Ganada']);
    }
};
