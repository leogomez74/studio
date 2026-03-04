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
            ['name' => 'Ted Chepman', 'tipo_persona' => 'Persona Física'],
            ['name' => 'Roberto Mora', 'tipo_persona' => 'Persona Física'],
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
            ['investor' => 'Janis, Christopher James', 'monto' => 50000, 'plazo' => 96, 'tasa' => 0.06, 'forma_pago' => 'RESERVA', 'moneda' => 'USD'],
            ['investor' => 'Frank Brown', 'monto' => 100000, 'plazo' => 96, 'tasa' => 0.06, 'forma_pago' => 'SEMESTRAL', 'moneda' => 'USD'],
            // CRC
            ['investor' => 'Jairo (Joshua)', 'monto' => 60000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['investor' => 'Jairo (Reychel y Rasea)', 'monto' => 120000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['investor' => 'Alysa Gottlieb', 'monto' => 11500000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['investor' => 'Alysa Gottlieb', 'monto' => 12000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['investor' => 'Alysa Gottlieb', 'monto' => 6000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['investor' => 'Jairo', 'monto' => 42784534, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['investor' => 'Jairo', 'monto' => 192000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['investor' => 'Jairo', 'monto' => 162000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['investor' => 'Leonardo Gómez', 'monto' => 38340050, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['investor' => 'Gomez Salazar, Leonardo (David)', 'monto' => 38175000, 'plazo' => 96, 'tasa' => 0.0705, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['investor' => 'Gomez Salazar, Leonardo (David)', 'monto' => 203600000, 'plazo' => 96, 'tasa' => 0.0705, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['investor' => 'Gomez Salazar, Leonardo (David)', 'monto' => 50900000, 'plazo' => 96, 'tasa' => 0.0705, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['investor' => 'Gomez Salazar, Leonardo', 'monto' => 2835961.08, 'plazo' => 96, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['investor' => 'Gomez Salazar, Leonardo', 'monto' => 7635000, 'plazo' => 96, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['investor' => 'Gomez Salazar, Leonardo (David)', 'monto' => 152700000, 'plazo' => 96, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['investor' => 'Leonardo Gómez', 'monto' => 4206152.04, 'plazo' => 96, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['investor' => 'Leonardo Gómez', 'monto' => 5090000, 'plazo' => 96, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['investor' => 'Leonardo Gómez', 'monto' => 18328983.11, 'plazo' => 96, 'tasa' => 0.07, 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['investor' => 'Fundación DSF', 'monto' => 5000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['investor' => 'Fundación DSF', 'monto' => 5000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['investor' => 'Fundación DSF', 'monto' => 5000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['investor' => 'Fundación DSF', 'monto' => 26200000, 'plazo' => 120, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['investor' => 'Fundación DSF', 'monto' => 50000000, 'plazo' => 60, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['investor' => 'Fundación DSF', 'monto' => 10000000, 'plazo' => 96, 'tasa' => 0.10, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['investor' => 'Fundación DSF', 'monto' => 15625000, 'plazo' => 96, 'tasa' => 0.10, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['investor' => 'Fundación DSF', 'monto' => 4500000, 'plazo' => 96, 'tasa' => 0.10, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            // Inversiones adicionales de hojas individuales del Excel
            ['investor' => 'Ted Chepman', 'monto' => 20000, 'plazo' => 96, 'tasa' => 0.06, 'forma_pago' => 'RESERVA', 'moneda' => 'USD'],
            ['investor' => 'Roberto Mora', 'monto' => 80000, 'plazo' => 96, 'tasa' => 0.07, 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'USD'],
        ];

        $today = Carbon::today();

        foreach ($investments as $data) {
            $fechaInicio = $today->copy()->subMonths(rand(6, 24));
            $fechaVencimiento = $fechaInicio->copy()->addMonths($data['plazo']);

            $investment = Investment::create([
                'numero_desembolso' => 'TMP',
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

            $suffix = $investment->moneda === 'USD' ? 'D' : 'C';
            $investment->update(['numero_desembolso' => $investment->id . '-' . $suffix]);

            $service->generateCoupons($investment);
        }

        $this->command->info('Investment seeder completed: ' . count($investments) . ' investments created with coupons.');
    }
}
