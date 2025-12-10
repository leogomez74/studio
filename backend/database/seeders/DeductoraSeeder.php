<?php

namespace Database\Seeders;

use App\Models\Deductora;
use Illuminate\Database\Seeder;

class DeductoraSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $deductorasData = [
            ['nombre' => 'Banco Nacional de Costa Rica', 'fecha_reporte_pago' => '2025-01-15', 'comision' => 1.50],
            ['nombre' => 'Banco de Costa Rica', 'fecha_reporte_pago' => '2025-01-20', 'comision' => 1.75],
            ['nombre' => 'BAC Credomatic', 'fecha_reporte_pago' => '2025-01-10', 'comision' => 2.00],
            ['nombre' => 'Banco Popular', 'fecha_reporte_pago' => '2025-01-25', 'comision' => 1.25],
            ['nombre' => 'Scotiabank Costa Rica', 'fecha_reporte_pago' => '2025-01-18', 'comision' => 1.80],
            ['nombre' => 'Davivienda Costa Rica', 'fecha_reporte_pago' => '2025-01-12', 'comision' => 1.60],
            ['nombre' => 'CoopeAnde', 'fecha_reporte_pago' => '2025-01-22', 'comision' => 1.00],
            ['nombre' => 'CoopeAhorro', 'fecha_reporte_pago' => '2025-01-28', 'comision' => 0.75],
            ['nombre' => 'CoopeSoliDar R.L.', 'fecha_reporte_pago' => '2025-01-14', 'comision' => 1.20],
            ['nombre' => 'CoopeAlajuela R.L.', 'fecha_reporte_pago' => '2025-01-16', 'comision' => 1.10],
            ['nombre' => 'CoopeGranada R.L.', 'fecha_reporte_pago' => '2025-01-30', 'comision' => 0.90],
            ['nombre' => 'CoopeMepe R.L.', 'fecha_reporte_pago' => '2025-01-08', 'comision' => 1.30],
            ['nombre' => 'CoopeSur R.L.', 'fecha_reporte_pago' => '2025-01-24', 'comision' => 1.15],
            ['nombre' => 'CoopeCoco R.L.', 'fecha_reporte_pago' => '2025-01-26', 'comision' => 1.05],
            ['nombre' => 'Banco BCT', 'fecha_reporte_pago' => '2025-01-19', 'comision' => 1.85],
        ];

        foreach ($deductorasData as $data) {
            Deductora::firstOrCreate(
                ['nombre' => $data['nombre']],
                [
                    'fecha_reporte_pago' => $data['fecha_reporte_pago'],
                    'comision' => $data['comision'],
                ]
            );
        }
    }
}
