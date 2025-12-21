<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Enterprise;
use App\Models\EnterprisesRequirement;

class EnterpriseRequirementSeeder extends Seeder
{
    public function run(): void
    {
        $tipos = ['Constancia', 'Colilla'];
        $extensiones = ['pdf', 'html'];
        $fecha = now();
        $enterprises = Enterprise::all();
        foreach ($enterprises as $enterprise) {
            foreach ($tipos as $tipo) {
                foreach ($extensiones as $ext) {
                    EnterprisesRequirement::updateOrCreate([
                        'enterprise_id' ,
                        'name' ,
                        'file_extension',
                    ], [
                         $tipo,
                        'upload_date' => $fecha,
                        'last_updated' => $fecha,
                    ]);
                }
            }
        }
    }
}
