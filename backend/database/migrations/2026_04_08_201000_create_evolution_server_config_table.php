<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evolution_server_config', function (Blueprint $table) {
            $table->id();
            $table->string('base_url')->default('');
            $table->timestamps();
        });

        // Insertar la fila singleton al crear la tabla
        DB::table('evolution_server_config')->insert([
            'base_url'   => '',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('evolution_server_config');
    }
};
