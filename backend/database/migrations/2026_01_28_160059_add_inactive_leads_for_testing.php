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
     * Inserta 10 leads con inactividad entre 11-22 días para testing de alertas
     */
    public function up(): void
    {
        $leads = [
            ['name' => 'María', 'apellido1' => 'González', 'apellido2' => 'Ramírez', 'cedula' => '101110001', 'email' => 'maria.gonzalez.test@test.com', 'phone' => '88881111', 'dias_inactivo' => 11],
            ['name' => 'José', 'apellido1' => 'Pérez', 'apellido2' => 'Castro', 'cedula' => '102220002', 'email' => 'jose.perez.test@test.com', 'phone' => '88882222', 'dias_inactivo' => 13],
            ['name' => 'Ana', 'apellido1' => 'Rodríguez', 'apellido2' => 'Mora', 'cedula' => '103330003', 'email' => 'ana.rodriguez.test@test.com', 'phone' => '88883333', 'dias_inactivo' => 15],
            ['name' => 'Carlos', 'apellido1' => 'Hernández', 'apellido2' => 'Solís', 'cedula' => '104440004', 'email' => 'carlos.hernandez.test@test.com', 'phone' => '88884444', 'dias_inactivo' => 17],
            ['name' => 'Laura', 'apellido1' => 'Jiménez', 'apellido2' => 'Vargas', 'cedula' => '105550005', 'email' => 'laura.jimenez.test@test.com', 'phone' => '88885555', 'dias_inactivo' => 18],
            ['name' => 'Roberto', 'apellido1' => 'Méndez', 'apellido2' => 'Arias', 'cedula' => '106660006', 'email' => 'roberto.mendez.test@test.com', 'phone' => '88886666', 'dias_inactivo' => 19],
            ['name' => 'Patricia', 'apellido1' => 'Sánchez', 'apellido2' => 'Campos', 'cedula' => '107770007', 'email' => 'patricia.sanchez.test@test.com', 'phone' => '88887777', 'dias_inactivo' => 20],
            ['name' => 'Diego', 'apellido1' => 'Morales', 'apellido2' => 'Blanco', 'cedula' => '108880008', 'email' => 'diego.morales.test@test.com', 'phone' => '88888888', 'dias_inactivo' => 21],
            ['name' => 'Sofía', 'apellido1' => 'Rojas', 'apellido2' => 'Vega', 'cedula' => '109990009', 'email' => 'sofia.rojas.test@test.com', 'phone' => '88889999', 'dias_inactivo' => 22],
            ['name' => 'Fernando', 'apellido1' => 'Castro', 'apellido2' => 'López', 'cedula' => '101000010', 'email' => 'fernando.castro.test@test.com', 'phone' => '88880000', 'dias_inactivo' => 14],
        ];

        foreach ($leads as $leadData) {
            $diasInactivo = $leadData['dias_inactivo'];
            $updatedAt = Carbon::now()->subDays($diasInactivo);

            // Verificar si el lead ya existe
            $exists = DB::table('persons')
                ->where('cedula', $leadData['cedula'])
                ->where('person_type_id', 1)
                ->exists();

            if (!$exists) {
                DB::table('persons')->insert([
                    'name' => $leadData['name'],
                    'apellido1' => $leadData['apellido1'],
                    'apellido2' => $leadData['apellido2'],
                    'cedula' => $leadData['cedula'],
                    'email' => $leadData['email'],
                    'phone' => $leadData['phone'],
                    'person_type_id' => 1, // Lead
                    'is_active' => true,
                    'status' => 'Activo',
                    'created_at' => $updatedAt,
                    'updated_at' => $updatedAt,
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $cedulas = [
            '101110001', '102220002', '103330003', '104440004', '105550005',
            '106660006', '107770007', '108880008', '109990009', '101000010'
        ];

        DB::table('persons')
            ->whereIn('cedula', $cedulas)
            ->where('person_type_id', 1)
            ->delete();
    }
};
