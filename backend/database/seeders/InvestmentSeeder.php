<?php

namespace Database\Seeders;

use App\Models\Investor;
use App\Models\Investment;
use App\Services\InvestmentService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class InvestmentSeeder extends Seeder
{
    public function run(): void
    {
        $service = app(InvestmentService::class);

        // Create investors
        $investors = [
            ['name' => 'Janis, Christopher James', 'tipo_persona' => 'Persona Física'],
            ['name' => 'Frank Brown', 'tipo_persona' => 'Persona Física'],
            ['name' => 'Jairo (Joshua)', 'tipo_persona' => 'Persona Física'],
            ['name' => 'Jairo (Reychel y Rasea)', 'tipo_persona' => 'Persona Física'],
            ['name' => 'Alysa Gottlieb', 'tipo_persona' => 'Persona Física'],
            ['name' => 'Jairo', 'tipo_persona' => 'Persona Física'],
            ['name' => 'Leonardo Gómez', 'tipo_persona' => 'Persona Física'],
            ['name' => 'Gomez Salazar, Leonardo (David)', 'tipo_persona' => 'Persona Física'],
            ['name' => 'Gomez Salazar, Leonardo', 'tipo_persona' => 'Persona Física'],
            ['name' => 'Fundacion Derecho sin Fronteras', 'tipo_persona' => 'Fundación'],
        ];

        $investorMap = [];
        foreach ($investors as $data) {
            $inv = Investor::create(array_merge($data, ['status' => 'Activo', 'joined_at' => now()]));
            $investorMap[$data['name']] = $inv->id;
        }

        // Alias for Fundación DSF
        $investorMap['Fundación DSF'] = $investorMap['Fundacion Derecho sin Fronteras'];

        // Investment data from Excel
        $investments = [
            // USD
            ['numero_desembolso' => '36-D', 'investor' => 'Janis, Christopher James', 'monto' => 50000, 'plazo' => 96, 'tasa' => 0.06, 'forma_pago' => 'RESERVA', 'moneda' => 'USD'],
            ['numero_desembolso' => '48-D', 'investor' => 'Frank Brown', 'monto' => 100000, 'plazo' => 96, 'tasa' => 0.06, 'forma_pago' => 'SEMESTRAL', 'moneda' => 'USD'],
            // CRC
            ['numero_desembolso' => '6-C', 'investor' => 'Jairo (Joshua)', 'monto' => 60000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '7-C', 'investor' => 'Jairo (Reychel y Rasea)', 'monto' => 120000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '8-C', 'investor' => 'Alysa Gottlieb', 'monto' => 11500000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '9-C', 'investor' => 'Alysa Gottlieb', 'monto' => 12000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '10-C', 'investor' => 'Alysa Gottlieb', 'monto' => 6000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '16-C', 'investor' => 'Jairo', 'monto' => 42784534, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '17-C', 'investor' => 'Jairo', 'monto' => 192000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '20-C', 'investor' => 'Jairo', 'monto' => 162000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '18-C', 'investor' => 'Leonardo Gómez', 'monto' => 38340050, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '3-D', 'investor' => 'Gomez Salazar, Leonardo (David)', 'monto' => 38175000, 'plazo' => 96, 'tasa' => 0.0705, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '4-D', 'investor' => 'Gomez Salazar, Leonardo (David)', 'monto' => 203600000, 'plazo' => 96, 'tasa' => 0.0705, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '5-D', 'investor' => 'Gomez Salazar, Leonardo (David)', 'monto' => 50900000, 'plazo' => 96, 'tasa' => 0.0705, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '6-D', 'investor' => 'Gomez Salazar, Leonardo', 'monto' => 2835961.08, 'plazo' => 96, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '9-D', 'investor' => 'Gomez Salazar, Leonardo', 'monto' => 7635000, 'plazo' => 96, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '29-D', 'investor' => 'Gomez Salazar, Leonardo (David)', 'monto' => 152700000, 'plazo' => 96, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '57-D', 'investor' => 'Leonardo Gómez', 'monto' => 4206152.04, 'plazo' => 96, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '58-D', 'investor' => 'Leonardo Gómez', 'monto' => 5090000, 'plazo' => 96, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '59-D', 'investor' => 'Leonardo Gómez', 'monto' => 18328983.11, 'plazo' => 96, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '21-C', 'investor' => 'Fundación DSF', 'monto' => 5000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '22-C', 'investor' => 'Fundación DSF', 'monto' => 5000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '23-C', 'investor' => 'Fundación DSF', 'monto' => 5000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '24-C', 'investor' => 'Fundación DSF', 'monto' => 26200000, 'plazo' => 120, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '19-C', 'investor' => 'Fundación DSF', 'monto' => 50000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '30-D', 'investor' => 'Fundación DSF', 'monto' => 10000000, 'plazo' => 96, 'tasa' => 0.10, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '32-D', 'investor' => 'Fundación DSF', 'monto' => 15625000, 'plazo' => 96, 'tasa' => 0.10, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '55-D', 'investor' => 'Fundación DSF', 'monto' => 4500000, 'plazo' => 96, 'tasa' => 0.10, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
        ];

        $today = Carbon::today();

        foreach ($investments as $data) {
            $fechaInicio = $today->copy()->subMonths(rand(6, 24));
            $fechaVencimiento = $fechaInicio->copy()->addMonths($data['plazo']);

            $investment = Investment::create([
                'numero_desembolso' => $data['numero_desembolso'],
                'investor_id' => $investorMap[$data['investor']],
                'monto_capital' => $data['monto'],
                'plazo_meses' => $data['plazo'],
                'fecha_inicio' => $fechaInicio,
                'fecha_vencimiento' => $fechaVencimiento,
                'tasa_anual' => $data['tasa'],
                'moneda' => $data['moneda'],
                'forma_pago' => $data['forma_pago'],
                'estado' => 'Activa',
            ]);

            $service->generateCoupons($investment);
        }

        $this->command->info('Investment seeder completed: ' . count($investments) . ' investments created with coupons.');
    }
}
