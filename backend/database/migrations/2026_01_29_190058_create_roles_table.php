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
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->boolean('full_access')->default(false);
            $table->timestamps();
        });

        // Insertar roles por defecto
        DB::table('roles')->insert([
            [
                'name' => 'Administrador',
                'description' => 'Acceso completo al sistema',
                'full_access' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Colaborador',
                'description' => 'Acceso limitado para colaboradores de ventas',
                'full_access' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Finanzas',
                'description' => 'Acceso completo a módulos financieros y de cobro',
                'full_access' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};
