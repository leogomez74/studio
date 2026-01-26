<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Lead;
use App\Models\Client;
use App\Models\Opportunity;
use App\Models\Analisis;
use App\Models\LeadStatus;
use Illuminate\Support\Facades\Hash;

class CrmSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Seed Users (Staff)
        $usersData = [
            ['name' => 'Administrador', 'email' => 'admin@pep.cr'],
            ['name' => 'Carlos Mendez', 'email' => 'carlosm@pep.cr'],
            ['name' => 'Wilmer Marquez', 'email' => 'coder@gomez.cr'],
            ['name' => 'Ahixel Rojas', 'email' => 'ahixel@pep.cr'],
            ['name' => 'Daniel Gómez', 'email' => 'daniel@gomez.cr'],
            ['name' => 'Leonardo Gómez', 'email' => 'leonardo@gomez.cr'],
        ];

        foreach ($usersData as $userData) {
            User::firstOrCreate(
                ['email' => $userData['email']],
                [
                    'name' => $userData['name'],
                    'password' => Hash::make('admin123'),
                ]
            );
        }

        // 2. Seed Lead Statuses
        $statuses = ['Nuevo', 'Contactado', 'Interesado', 'En Proceso', 'Convertido', 'Rechazado'];
        foreach ($statuses as $index => $status) {
            LeadStatus::firstOrCreate(
                ['name' => $status],
                ['slug' => \Illuminate\Support\Str::slug($status), 'order_column' => $index + 1]
            );
        }

        // 3. Seed Leads con datos completos para análisis
        $leadsData = [
            [
                'name' => 'Carla Díaz Solano', 'cedula' => '3-1111-2222', 'email' => 'carla.diaz@example.com', 'phone' => '7555-4444',
                'puesto' => 'Secretaria Ejecutiva', 'estado_puesto' => 'Propiedad', 'profesion' => 'Administración',
                'antiguedad' => '5 años', 'assigned_agent_name' => 'Carlos Mendez', 'status' => 'Interesado',
                'apellido1' => 'Díaz', 'apellido2' => 'Solano', 'fecha_nacimiento' => '1990-05-15',
                'estado_civil' => 'Soltero', 'whatsapp' => '7555-4444', 'province' => 'San José',
                'canton' => 'San José', 'distrito' => 'Pavas', 'source' => 'Facebook',
                'institucion_labora' => 'Ministerio de Educación Pública',
            ],
            [
                'name' => 'Daniel Alves Mora', 'cedula' => '4-2222-3333', 'email' => 'daniel.alves@example.com', 'phone' => '5432-1876',
                'puesto' => 'Ingeniero Civil', 'estado_puesto' => 'Propiedad', 'profesion' => 'Ingeniería',
                'antiguedad' => '10 años', 'assigned_agent_name' => 'Wilmer Marquez', 'status' => 'En Proceso',
                'apellido1' => 'Alves', 'apellido2' => 'Mora', 'fecha_nacimiento' => '1985-08-20',
                'estado_civil' => 'Casado', 'whatsapp' => '5432-1876', 'province' => 'Alajuela',
                'canton' => 'Alajuela', 'distrito' => 'San José', 'source' => 'Referido',
                'institucion_labora' => 'MOPT',
            ],
            [
                'name' => 'María Fernández López', 'cedula' => '1-3333-4444', 'email' => 'maria.fernandez@example.com', 'phone' => '8123-9876',
                'puesto' => 'Docente', 'estado_puesto' => 'Interino', 'profesion' => 'Educación',
                'antiguedad' => '3 años', 'assigned_agent_name' => 'Ahixel Rojas', 'status' => 'Nuevo',
                'apellido1' => 'Fernández', 'apellido2' => 'López', 'fecha_nacimiento' => '1992-03-10',
                'estado_civil' => 'Casado', 'whatsapp' => '8123-9876', 'province' => 'Heredia',
                'canton' => 'Heredia', 'distrito' => 'San Francisco', 'source' => 'Web',
                'institucion_labora' => 'Ministerio de Educación Pública',
            ],
            [
                'name' => 'José Rodríguez Vargas', 'cedula' => '2-4444-5555', 'email' => 'jose.rodriguez@example.com', 'phone' => '7890-1234',
                'puesto' => 'Contador', 'estado_puesto' => 'Propiedad', 'profesion' => 'Contaduría',
                'antiguedad' => '8 años', 'assigned_agent_name' => 'Carlos Mendez', 'status' => 'Contactado',
                'apellido1' => 'Rodríguez', 'apellido2' => 'Vargas', 'fecha_nacimiento' => '1988-12-01',
                'estado_civil' => 'Divorciado', 'whatsapp' => '7890-1234', 'province' => 'Cartago',
                'canton' => 'Cartago', 'distrito' => 'Oriental', 'source' => 'Instagram',
                'institucion_labora' => 'Ministerio de Hacienda',
            ],
            [
                'name' => 'Laura Jiménez Castro', 'cedula' => '5-5555-6666', 'email' => 'laura.jimenez@example.com', 'phone' => '6543-2109',
                'puesto' => 'Enfermera', 'estado_puesto' => 'Propiedad', 'profesion' => 'Enfermería',
                'antiguedad' => '12 años', 'assigned_agent_name' => 'Wilmer Marquez', 'status' => 'Interesado',
                'apellido1' => 'Jiménez', 'apellido2' => 'Castro', 'fecha_nacimiento' => '1980-07-25',
                'estado_civil' => 'Casado', 'whatsapp' => '6543-2109', 'province' => 'San José',
                'canton' => 'Escazú', 'distrito' => 'San Rafael', 'source' => 'Referido',
                'institucion_labora' => 'CCSS',
            ],
        ];

        foreach ($leadsData as $data) {
            $agent = User::where('name', $data['assigned_agent_name'])->first();
            $status = LeadStatus::where('name', $data['status'])->first();

            Lead::updateOrCreate(
                ['cedula' => $data['cedula']],
                [
                    'name' => $data['name'],
                    'email' => $data['email'],
                    'phone' => $data['phone'],
                    'person_type_id' => 1,
                    'assigned_to_id' => $agent?->id,
                    'lead_status_id' => $status?->id,
                    'ocupacion' => $data['puesto'],
                    'puesto' => $data['puesto'],
                    'estado_puesto' => $data['estado_puesto'],
                    'profesion' => $data['profesion'],
                    'institucion_labora' => $data['institucion_labora'],
                    'notes' => "Antigüedad: " . $data['antiguedad'],
                    'is_active' => true,
                    'apellido1' => $data['apellido1'],
                    'apellido2' => $data['apellido2'],
                    'fecha_nacimiento' => $data['fecha_nacimiento'],
                    'estado_civil' => $data['estado_civil'],
                    'whatsapp' => $data['whatsapp'],
                    'province' => $data['province'],
                    'canton' => $data['canton'],
                    'distrito' => $data['distrito'],
                    'source' => $data['source'],
                ]
            );
        }

        // 4. Seed Clients
        $clientsData = [
            [
                'name' => 'Ana Gómez Pérez', 'cedula' => '1-1111-1111', 'email' => 'ana.gomez@example.com', 'phone' => '8888-8888',
                'puesto' => 'Médico General', 'estado_puesto' => 'Propiedad', 'profesion' => 'Medicina',
                'institucion_labora' => 'CCSS', 'status' => 'Activo',
                'apellido1' => 'Gómez', 'apellido2' => 'Pérez', 'fecha_nacimiento' => '1980-01-01',
                'estado_civil' => 'Casado', 'whatsapp' => '8888-8888', 'province' => 'San José',
                'canton' => 'San José', 'distrito' => 'Mata Redonda', 'genero' => 'Femenino',
            ],
            [
                'name' => 'Carlos Ruiz Sánchez', 'cedula' => '2-2222-2222', 'email' => 'carlos.ruiz@example.com', 'phone' => '8999-9999',
                'puesto' => 'Abogado', 'estado_puesto' => 'Propiedad', 'profesion' => 'Derecho',
                'institucion_labora' => 'Poder Judicial', 'status' => 'Activo',
                'apellido1' => 'Ruiz', 'apellido2' => 'Sánchez', 'fecha_nacimiento' => '1975-06-15',
                'estado_civil' => 'Soltero', 'whatsapp' => '8999-9999', 'province' => 'Heredia',
                'canton' => 'Heredia', 'distrito' => 'Ulloa', 'genero' => 'Masculino',
            ],
        ];

        foreach ($clientsData as $data) {
            Client::updateOrCreate(
                ['cedula' => $data['cedula']],
                [
                    'name' => $data['name'],
                    'email' => $data['email'],
                    'phone' => $data['phone'],
                    'person_type_id' => 2,
                    'status' => $data['status'],
                    'puesto' => $data['puesto'],
                    'estado_puesto' => $data['estado_puesto'],
                    'profesion' => $data['profesion'],
                    'institucion_labora' => $data['institucion_labora'],
                    'is_active' => true,
                    'apellido1' => $data['apellido1'],
                    'apellido2' => $data['apellido2'],
                    'fecha_nacimiento' => $data['fecha_nacimiento'],
                    'estado_civil' => $data['estado_civil'],
                    'whatsapp' => $data['whatsapp'],
                    'province' => $data['province'],
                    'canton' => $data['canton'],
                    'distrito' => $data['distrito'],
                    'genero' => $data['genero'] ?? null,
                ]
            );
        }

        // 5. Seed Opportunities (ID auto-generado: YY-XXXXX-EPP-OP)
        $opportunitiesData = [
            [
                'lead_cedula' => '3-1111-2222',
                'opportunity_type' => 'Regular',
                'amount' => 3500000,
                'status' => 'Analizada',
                'assignedTo' => 'Carlos Mendez',
                'vertical' => 'Ministerio de Educación Pública',
                'expected_close_date' => now()->addDays(30),
            ],
            [
                'lead_cedula' => '4-2222-3333',
                'opportunity_type' => 'Regular',
                'amount' => 5000000,
                'status' => 'Analizada',
                'assignedTo' => 'Wilmer Marquez',
                'vertical' => 'MOPT',
                'expected_close_date' => now()->addDays(45),
            ],
            [
                'lead_cedula' => '1-3333-4444',
                'opportunity_type' => 'Micro-crédito',
                'amount' => 800000,
                'status' => 'Pendiente',
                'assignedTo' => 'Ahixel Rojas',
                'vertical' => 'Ministerio de Educación Pública',
                'expected_close_date' => now()->addDays(20),
            ],
            [
                'lead_cedula' => '2-4444-5555',
                'opportunity_type' => 'Regular',
                'amount' => 4200000,
                'status' => 'Analizada',
                'assignedTo' => 'Carlos Mendez',
                'vertical' => 'Ministerio de Hacienda',
                'expected_close_date' => now()->addDays(60),
            ],
            [
                'lead_cedula' => '5-5555-6666',
                'opportunity_type' => 'Regular',
                'amount' => 6000000,
                'status' => 'Pendiente',
                'assignedTo' => 'Wilmer Marquez',
                'vertical' => 'CCSS',
                'expected_close_date' => now()->addDays(35),
            ],
            [
                'lead_cedula' => '1-1111-1111',
                'opportunity_type' => 'Regular',
                'amount' => 8000000,
                'status' => 'Aceptada',
                'assignedTo' => 'Carlos Mendez',
                'vertical' => 'CCSS',
                'expected_close_date' => now()->addDays(15),
            ],
        ];

        $createdOpportunities = [];
        foreach ($opportunitiesData as $data) {
            $agent = User::where('name', $data['assignedTo'])->first();

            $opportunity = Opportunity::create([
                'lead_cedula' => $data['lead_cedula'],
                'opportunity_type' => $data['opportunity_type'],
                'amount' => $data['amount'],
                'status' => $data['status'],
                'vertical' => $data['vertical'],
                'assigned_to_id' => $agent?->id,
                'expected_close_date' => $data['expected_close_date'],
            ]);

            $createdOpportunities[] = [
                'opportunity' => $opportunity,
                'data' => $data,
            ];
        }

        // 6. Seed Analisis (solo para oportunidades con status 'Analizada')
        foreach ($createdOpportunities as $item) {
            $opportunity = $item['opportunity'];
            $data = $item['data'];

            if ($opportunity->status !== 'Analizada') {
                continue;
            }

            $lead = Lead::where('cedula', $data['lead_cedula'])->first()
                ?? Client::where('cedula', $data['lead_cedula'])->first();

            if (!$lead) {
                continue;
            }

            // Calcular ingresos de ejemplo basados en el monto
            $ingresoBruto = $data['amount'] * 0.15; // ~15% del monto como ingreso bruto mensual
            $ingresoNeto = $ingresoBruto * 0.75;    // 75% del bruto como neto

            Analisis::create([
                'reference' => $opportunity->id,
                'title' => $data['opportunity_type'],
                'estado_pep' => 'Aceptado',
                'estado_cliente' => 'Aprobado',
                'category' => $data['opportunity_type'],
                'monto_credito' => $data['amount'],
                'lead_id' => $lead->id,
                'opportunity_id' => $opportunity->id,
                'assigned_to' => $data['assignedTo'],
                'opened_at' => now(),
                'divisa' => 'CRC',
                'plazo' => $data['opportunity_type'] === 'Micro-crédito' ? 12 : 36,
                'ingreso_bruto' => $ingresoBruto,
                'ingreso_neto' => $ingresoNeto,
                'propuesta' => 'Cliente cumple con los requisitos para el crédito solicitado.',
            ]);
        }
    }
}
