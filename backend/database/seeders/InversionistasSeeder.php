<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Investor;

class InversionistasSeeder extends Seeder
{
    public function run(): void
    {
        $investors = [
            ['name' => 'Jairo',                            'tipo_persona' => 'fisica',   'status' => 'Activo'],
            ['name' => 'Alysa Gottlieb',                   'tipo_persona' => 'fisica',   'status' => 'Activo'],
            ['name' => 'Leonardo Gómez',                   'tipo_persona' => 'fisica',   'status' => 'Activo'],
            ['name' => 'Fundacion Derecho sin Fronteras',  'tipo_persona' => 'juridica', 'status' => 'Activo'],
            ['name' => 'Janis, Christopher James',         'tipo_persona' => 'fisica',   'status' => 'Activo'],
            ['name' => 'Frank Brown',                      'tipo_persona' => 'fisica',   'status' => 'Activo'],
        ];

        foreach ($investors as $data) {
            Investor::firstOrCreate(['name' => $data['name']], $data);
        }
    }
}
