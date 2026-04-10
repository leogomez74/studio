<?php

namespace Database\Seeders;

use App\Models\ModuleAssignment;
use App\Models\User;
use Illuminate\Database\Seeder;

class ModuleAssignmentSeeder extends Seeder
{
    private const ASSIGNMENTS = [
        'leads'    => ['da@pep.cr'],
        'crm'      => ['da@pep.cr'],
        'analysis' => ['mh@pep.cr', 'da@pep.cr'],
        'credits'  => ['mh@pep.cr'],
        'cobro'    => ['carlosm@pep.cr'],
    ];

    public function run(): void
    {
        foreach (self::ASSIGNMENTS as $module => $emails) {
            foreach ($emails as $email) {
                $user = User::where('email', $email)->first();

                if (!$user) {
                    $this->command->warn("Usuario no encontrado: {$email} (módulo: {$module})");
                    continue;
                }

                ModuleAssignment::updateOrCreate(
                    ['module' => $module, 'user_id' => $user->id],
                    ['is_active' => true]
                );

                $this->command->info("Asignado: {$user->name} → {$module}");
            }
        }
    }
}
