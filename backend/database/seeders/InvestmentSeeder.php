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

        // Investment data from Excel "INVERSIONES Y RESERVAS VF.xlsx" - TABLA GENERAL
        $investments = [
            // === DOLARES (USD) ===
            ['numero_desembolso' => '36-D', 'investor' => 'Janis, Christopher James', 'monto' => 50000, 'plazo' => 96, 'tasa' => 0.06, 'fecha_inicio' => '2019-02-19', 'fecha_vencimiento' => '2027-02-19', 'forma_pago' => 'RESERVA', 'moneda' => 'USD'],
            ['numero_desembolso' => '48-D', 'investor' => 'Frank Brown', 'monto' => 100000, 'plazo' => 96, 'tasa' => 0.06, 'fecha_inicio' => '2021-01-21', 'fecha_vencimiento' => '2029-01-21', 'forma_pago' => 'SEMESTRAL', 'moneda' => 'USD'],

            // === COLONES (CRC) ===
            ['numero_desembolso' => '6-C', 'investor' => 'Jairo (Joshua)', 'monto' => 60000000, 'plazo' => 60, 'tasa' => 0.0705, 'fecha_inicio' => '2020-09-19', 'fecha_vencimiento' => '2035-09-19', 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '7-C', 'investor' => 'Jairo (Reychel y Rasea)', 'monto' => 120000000, 'plazo' => 60, 'tasa' => 0.0705, 'fecha_inicio' => '2021-01-22', 'fecha_vencimiento' => '2036-01-22', 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '8-C', 'investor' => 'Alysa Gottlieb', 'monto' => 11500000, 'plazo' => 60, 'tasa' => 0.0705, 'fecha_inicio' => '2021-01-27', 'fecha_vencimiento' => '2036-01-27', 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '9-C', 'investor' => 'Alysa Gottlieb', 'monto' => 12000000, 'plazo' => 60, 'tasa' => 0.0705, 'fecha_inicio' => '2021-02-15', 'fecha_vencimiento' => '2036-02-15', 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '10-C', 'investor' => 'Alysa Gottlieb', 'monto' => 6000000, 'plazo' => 60, 'tasa' => 0.0705, 'fecha_inicio' => '2021-04-23', 'fecha_vencimiento' => '2026-04-23', 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '16-C', 'investor' => 'Jairo', 'monto' => 42784534, 'plazo' => 60, 'tasa' => 0.0705, 'fecha_inicio' => '2022-02-01', 'fecha_vencimiento' => '2027-02-01', 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '17-C', 'investor' => 'Jairo', 'monto' => 192000000, 'plazo' => 60, 'tasa' => 0.0705, 'fecha_inicio' => '2022-06-01', 'fecha_vencimiento' => '2027-06-01', 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '20-C', 'investor' => 'Jairo', 'monto' => 162000000, 'plazo' => 60, 'tasa' => 0.0705, 'fecha_inicio' => '2023-03-06', 'fecha_vencimiento' => '2028-03-06', 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '18-C', 'investor' => 'Leonardo Gómez', 'monto' => 38340050, 'plazo' => 60, 'tasa' => 0.0705, 'fecha_inicio' => '2022-06-01', 'fecha_vencimiento' => '2027-06-01', 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '3-D', 'investor' => 'Gomez Salazar, Leonardo (David)', 'monto' => 38175000, 'plazo' => 96, 'tasa' => 0.0705, 'fecha_inicio' => '2016-10-15', 'fecha_vencimiento' => '2034-10-15', 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '4-D', 'investor' => 'Gomez Salazar, Leonardo (David)', 'monto' => 203600000, 'plazo' => 96, 'tasa' => 0.0705, 'fecha_inicio' => '2016-11-14', 'fecha_vencimiento' => '2034-11-14', 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '5-D', 'investor' => 'Gomez Salazar, Leonardo (David)', 'monto' => 50900000, 'plazo' => 96, 'tasa' => 0.0705, 'fecha_inicio' => '2016-12-15', 'fecha_vencimiento' => '2034-12-15', 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '6-D', 'investor' => 'Gomez Salazar, Leonardo', 'monto' => 2835961.08, 'plazo' => 96, 'tasa' => 0.0705, 'fecha_inicio' => '2017-04-04', 'fecha_vencimiento' => '2035-04-04', 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '9-D', 'investor' => 'Gomez Salazar, Leonardo', 'monto' => 7635000, 'plazo' => 96, 'tasa' => 0.0705, 'fecha_inicio' => '2017-06-26', 'fecha_vencimiento' => '2035-06-26', 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '29-D', 'investor' => 'Gomez Salazar, Leonardo (David)', 'monto' => 152700000, 'plazo' => 96, 'tasa' => 0.0705, 'fecha_inicio' => '2018-05-20', 'fecha_vencimiento' => '2026-05-20', 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '57-D', 'investor' => 'Leonardo Gómez', 'monto' => 4206152.04, 'plazo' => 96, 'tasa' => 0.0705, 'fecha_inicio' => '2021-09-15', 'fecha_vencimiento' => '2029-09-15', 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '58-D', 'investor' => 'Leonardo Gómez', 'monto' => 5090000, 'plazo' => 96, 'tasa' => 0.0705, 'fecha_inicio' => '2021-09-22', 'fecha_vencimiento' => '2029-09-22', 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '59-D', 'investor' => 'Leonardo Gómez', 'monto' => 18328983.11, 'plazo' => 96, 'tasa' => 0.0705, 'fecha_inicio' => '2021-09-01', 'fecha_vencimiento' => '2029-09-01', 'forma_pago' => 'MENSUAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '21-C', 'investor' => 'Fundación DSF', 'monto' => 5000000, 'plazo' => 60, 'tasa' => 0.0705, 'fecha_inicio' => '2023-05-30', 'fecha_vencimiento' => '2028-05-30', 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '22-C', 'investor' => 'Fundación DSF', 'monto' => 5000000, 'plazo' => 60, 'tasa' => 0.0705, 'fecha_inicio' => '2023-06-09', 'fecha_vencimiento' => '2028-06-09', 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '23-C', 'investor' => 'Fundación DSF', 'monto' => 5000000, 'plazo' => 60, 'tasa' => 0.0705, 'fecha_inicio' => '2023-08-08', 'fecha_vencimiento' => '2028-08-08', 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '24-C', 'investor' => 'Fundación DSF', 'monto' => 26200000, 'plazo' => 120, 'tasa' => 0.0705, 'fecha_inicio' => '2024-07-02', 'fecha_vencimiento' => '2034-07-02', 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '19-C', 'investor' => 'Fundación DSF', 'monto' => 50000000, 'plazo' => 60, 'tasa' => 0.0705, 'fecha_inicio' => '2022-09-01', 'fecha_vencimiento' => '2027-09-01', 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '30-D', 'investor' => 'Fundación DSF', 'monto' => 10000000, 'plazo' => 96, 'tasa' => 0.10, 'fecha_inicio' => '2018-05-23', 'fecha_vencimiento' => '2026-05-23', 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '32-D', 'investor' => 'Fundación DSF', 'monto' => 15625000, 'plazo' => 96, 'tasa' => 0.10, 'fecha_inicio' => '2018-07-26', 'fecha_vencimiento' => '2026-07-26', 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],
            ['numero_desembolso' => '55-D', 'investor' => 'Fundación DSF', 'monto' => 4500000, 'plazo' => 96, 'tasa' => 0.10, 'fecha_inicio' => '2021-08-27', 'fecha_vencimiento' => '2029-08-27', 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'CRC'],

            // === Inversiones de hojas individuales (no en TABLA GENERAL) ===
            ['numero_desembolso' => '60-D', 'investor' => 'Ted Chepman', 'monto' => 20000, 'plazo' => 96, 'tasa' => 0.06, 'fecha_inicio' => '2021-09-01', 'fecha_vencimiento' => '2029-09-01', 'forma_pago' => 'RESERVA', 'moneda' => 'USD'],
            ['numero_desembolso' => '61-D', 'investor' => 'Roberto Mora', 'monto' => 80000, 'plazo' => 96, 'tasa' => 0.07, 'fecha_inicio' => '2021-07-01', 'fecha_vencimiento' => '2029-07-01', 'forma_pago' => 'TRIMESTRAL', 'moneda' => 'USD'],
        ];

        foreach ($investments as $data) {
            $fechaInicio = Carbon::parse($data['fecha_inicio']);
            $fechaVencimiento = Carbon::parse($data['fecha_vencimiento']);

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

        if ($this->command) {
            $this->command->info('Investment seeder completed: ' . count($investments) . ' investments created with coupons.');
        }
    }
}
