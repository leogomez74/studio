<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Lead;
use App\Models\Client;
use App\Models\Opportunity;
use App\Models\LeadStatus;
use Illuminate\Support\Facades\Hash;

class CrmSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Seed Users (Staff)
        $usersData = [
            ['name' => 'Administrador', 'email' => 'admin@example.cr'],
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
                    'password' => Hash::make('password'), // Default password
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

        // 3. Seed Leads
        $leadsData = [
            [
                'name' => 'Carla Díaz Solano', 'cedula' => '3-1111-2222', 'email' => 'carla.dias@example.com', 'phone' => '7555-4444',
                'puesto' => 'Interino', 'antiguedad' => '2 años', 'assigned_agent_name' => 'Oficina', 'status' => 'Nuevo'
            ],
            [
                'name' => 'Daniel Alves Mora', 'cedula' => '4-2222-3333', 'email' => 'daniel.alves@example.com', 'phone' => '5432-1876',
                'puesto' => 'En Propiedad', 'antiguedad' => '10 años', 'assigned_agent_name' => 'Carlos Mendez', 'status' => 'Nuevo'
            ],
            [
                'name' => 'Eduardo Pereira', 'cedula' => '9-0123-4567', 'email' => 'eduardo.p@example.com', 'phone' => '8123-9876',
                'puesto' => 'En Propiedad', 'antiguedad' => '8 años', 'assigned_agent_name' => 'Oficina', 'status' => 'Nuevo'
            ],
            [
                'name' => 'Fernanda Núñez', 'cedula' => '1-2345-6789', 'email' => 'fernanda.n@example.com', 'phone' => '7890-1234',
                'puesto' => 'Interino', 'antiguedad' => '6 meses', 'assigned_agent_name' => 'Wilmer Marquez', 'status' => 'Nuevo'
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
                    'person_type_id' => 1, // Lead
                    'assigned_to_id' => $agent ? $agent->id : null,
                    'lead_status_id' => $status ? $status->id : null,
                    'ocupacion' => $data['puesto'], // Mapping puesto to ocupacion
                    'notes' => "Antigüedad: " . $data['antiguedad'],
                    'is_active' => true,
                ]
            );
        }

        // 4. Seed Clients
        $clientsData = [
            ['name' => 'Ana Silva Rojas', 'cedula' => '1-1234-5678', 'email' => 'ana.silva@example.com', 'phone' => '8765-4321', 'status' => 'Moroso'],
            ['name' => 'John Doe', 'cedula' => '6-4444-5555', 'email' => 'john.doe@example.com', 'phone' => '1122-3344', 'status' => 'Activo'],
            ['name' => 'Jane Smith', 'cedula' => '7-5555-6666', 'email' => 'jane.smith@example.com', 'phone' => '9988-7766', 'status' => 'En cobro'],
            ['name' => 'Peter Jones', 'cedula' => '8-6666-7777', 'email' => 'peter.jones@example.com', 'phone' => '6677-8899', 'status' => 'Inactivo'],
            ['name' => 'Lucía Méndez', 'cedula' => '9-7777-8888', 'email' => 'lucia.mendez@example.com', 'phone' => '5566-7788', 'status' => 'Activo'],
            ['name' => 'Carlos Fernández', 'cedula' => '1-8888-9999', 'email' => 'carlos.f@example.com', 'phone' => '4455-6677', 'status' => 'Activo'],
            ['name' => 'Sofía Hernández', 'cedula' => '2-9999-0000', 'email' => 'sofia.h@example.com', 'phone' => '3344-5566', 'status' => 'Moroso'],
            ['name' => 'Miguel González', 'cedula' => '3-0000-1111', 'email' => 'miguel.g@example.com', 'phone' => '2233-4455', 'status' => 'Activo'],
            ['name' => 'Valentina Rossi', 'cedula' => '4-1111-2222', 'email' => 'valentina.r@example.com', 'phone' => '1122-3344', 'status' => 'Activo'],
            ['name' => 'Javier Rodríguez', 'cedula' => '5-2222-3333', 'email' => 'javier.r@example.com', 'phone' => '9988-7766', 'status' => 'Activo'],
            ['name' => 'Camila Gómez', 'cedula' => '6-3333-4444', 'email' => 'camila.g@example.com', 'phone' => '8877-6655', 'status' => 'Activo'],
            ['name' => 'Mateo Díaz', 'cedula' => '7-4444-5555', 'email' => 'mateo.d@example.com', 'phone' => '7766-5544', 'status' => 'Activo'],
            ['name' => 'Isabella Castillo', 'cedula' => '8-5555-6666', 'email' => 'isabella.c@example.com', 'phone' => '6655-4433', 'status' => 'Fallecido'],
            ['name' => 'Sebastián Soto', 'cedula' => '9-6666-7777', 'email' => 'sebastian.s@example.com', 'phone' => '5544-3322', 'status' => 'Activo'],
            ['name' => 'Gabriela Vargas', 'cedula' => '1-7777-8888', 'email' => 'gabriela.v@example.com', 'phone' => '4433-2211', 'status' => 'En cobro'],
            ['name' => 'Bruno Costa Marin', 'cedula' => '2-0987-6543', 'email' => 'bruno.costa@example.com', 'phone' => '6123-4567', 'status' => 'Activo'],
        ];

        foreach ($clientsData as $data) {
            Client::updateOrCreate(
                ['cedula' => $data['cedula']],
                [
                    'name' => $data['name'],
                    'email' => $data['email'],
                    'phone' => $data['phone'],
                    'person_type_id' => 2, // Client
                    'status' => $data['status'], // Legacy status field
                    'is_active' => in_array($data['status'], ['Activo', 'Moroso', 'En cobro']),
                ]
            );
        }

        // 5. Seed Opportunities
        $opportunitiesData = [
            ['lead_cedula' => '2-0987-6543', 'creditType' => 'Regular', 'amount' => 5000000, 'status' => 'En proceso', 'assignedTo' => 'Wilmer Marquez'],
            ['lead_cedula' => '5-3333-4444', 'creditType' => 'Micro-crédito', 'amount' => 500000, 'status' => 'Convertido', 'assignedTo' => 'Carlos Mendez'],
            ['lead_cedula' => '3-1111-2222', 'creditType' => 'Regular', 'amount' => 2000000, 'status' => 'Rechazada', 'assignedTo' => 'Wilmer Marquez'],
            ['lead_cedula' => '4-2222-3333', 'creditType' => 'Regular', 'amount' => 7000000, 'status' => 'Aceptada', 'assignedTo' => 'Carlos Mendez'],
        ];

        foreach ($opportunitiesData as $data) {
            // Ensure the person exists (some opportunities might reference clients or leads not in the list above, but let's try)
            // In the mock data, '2-0987-6543' is Bruno Costa (Client).
            // '5-3333-4444' is Javier Rodríguez (Client).
            // '3-1111-2222' is Carla Díaz (Lead).
            // '4-2222-3333' is Daniel Alves (Lead).

            $agent = User::where('name', $data['assignedTo'])->first();

            Opportunity::create([
                'lead_cedula' => $data['lead_cedula'],
                'opportunity_type' => $data['creditType'],
                'amount' => $data['amount'],
                'status' => $data['status'],
                'assigned_to_id' => $agent ? $agent->id : null,
                'expected_close_date' => now()->addDays(30),
            ]);
        }
    }
}
