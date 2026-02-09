<?php

namespace Database\Seeders;

use App\Models\LoanConfiguration;
use App\Models\Tasa;
use Illuminate\Database\Seeder;
use Carbon\Carbon;

class LoanConfigurationSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Buscar o crear tasa para Crédito Regular (36%)
        $tasaRegular = Tasa::firstOrCreate(
            ['nombre' => 'Tasa Regular'],
            [
                'tasa' => 36,
                'inicio' => Carbon::now()->subYear(),
                'fin' => null,
                'activo' => true,
            ]
        );

        // Buscar o crear tasa para Micro-crédito (54%)
        $tasaMicro = Tasa::firstOrCreate(
            ['nombre' => 'Tasa Micro Crédito'],
            [
                'tasa' => 54,
                'inicio' => Carbon::now()->subYear(),
                'fin' => null,
                'activo' => true,
            ]
        );

        // Crédito Regular
        LoanConfiguration::updateOrCreate(
            ['tipo' => 'regular'],
            [
                'nombre' => 'Crédito Regular',
                'descripcion' => 'Parámetros para los créditos regulares de deducción de planilla.',
                'monto_minimo' => 500000,
                'monto_maximo' => 10000000,
                'tasa_id' => $tasaRegular->id,
                'plazo_minimo' => 12,
                'plazo_maximo' => 72,
                'activo' => true,
            ]
        );

        // Micro-crédito
        LoanConfiguration::updateOrCreate(
            ['tipo' => 'microcredito'],
            [
                'nombre' => 'Micro-crédito',
                'descripcion' => 'Parámetros para micro-créditos de rápida aprobación.',
                'monto_minimo' => 100000,
                'monto_maximo' => 1000000,
                'tasa_id' => $tasaMicro->id,
                'plazo_minimo' => 6,
                'plazo_maximo' => 24,
                'activo' => true,
            ]
        );
    }
}
