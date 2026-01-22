<?php

namespace Database\Seeders;

use App\Models\LoanConfiguration;
use Illuminate\Database\Seeder;

class LoanConfigurationSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Crédito Regular
        LoanConfiguration::updateOrCreate(
            ['tipo' => 'regular'],
            [
                'nombre' => 'Crédito Regular',
                'descripcion' => 'Parámetros para los créditos regulares de deducción de planilla.',
                'monto_minimo' => 500000,
                'monto_maximo' => 10000000,
                'tasa_anual' => 36,
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
                'tasa_anual' => 54,
                'plazo_minimo' => 6,
                'plazo_maximo' => 24,
                'activo' => true,
            ]
        );
    }
}
