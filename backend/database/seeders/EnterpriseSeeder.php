<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Enterprise;
use App\Models\EnterprisesRequirement;

class EnterpriseSeeder extends Seeder
{
    public function run(): void
    {
        \DB::statement('SET FOREIGN_KEY_CHECKS=0');
        $now = now();

        $data = [
            '911' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'jpg', 'qty' => 6],
            ],
            'Archivo Nacional' => [
                ['name' => 'Comprobantes Quincenales', 'ext' => 'jpg', 'qty' => 6],
            ],
            'ASAMB L' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'jpg', 'qty' => 6],
            ],
            'AYA' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Mensuales', 'ext' => 'pdf', 'qty' => 3],
            ],
            'CCSS' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'pdf', 'qty' => 6],
            ],
            'CEN CINAI' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'pdf', 'qty' => 6],
            ],
            'CNE' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'pdf', 'qty' => 6],
            ],
            'CNP' => [
                ['name' => 'Constancia y Comprobantes (PDF con fotos)', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Fotos de Documentos', 'ext' => 'jpg', 'qty' => 1],
            ],
            'CONAVI' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'jpg', 'qty' => 6],
            ],
            'COSEVI' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'jpg', 'qty' => 6],
            ],
            'DEFENSORIA' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'jpg', 'qty' => 6],
            ],
            'DGAC' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'jpg', 'qty' => 6],
            ],
            'DGSC' => [
                ['name' => 'Constancia (Imagen en PDF)', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (Imagen en PDF)', 'ext' => 'pdf', 'qty' => 6],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
            ],
            'DINADECO' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (Imagen en PDF)', 'ext' => 'pdf', 'qty' => 6],
            ],
            'FITOSANITARIO' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (Imagen en PDF)', 'ext' => 'pdf', 'qty' => 5],
            ],
            'ICD' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (Unificado)', 'ext' => 'pdf', 'qty' => 1],
            ],
            'ICE' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
            ],
            'IMAS' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'pdf', 'qty' => 6],
            ],
            'IMPRENTA NACIONAL' => [
                ['name' => 'Constancia (Imagen en PDF)', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
            ],
            'INA' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Mensuales (PDF)', 'ext' => 'pdf', 'qty' => 3],
                ['name' => 'Comprobantes Mensuales (HTM)', 'ext' => 'html', 'qty' => 3],
            ],
            'INDER' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Mensuales (Imágenes en PDF)', 'ext' => 'pdf', 'qty' => 1],
            ],
            'INVU' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'pdf', 'qty' => 6],
            ],
            'MAG' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'pdf', 'qty' => 6],
            ],
            'MCE' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
            ],
            'MCJ' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (Unificado)', 'ext' => 'pdf', 'qty' => 1],
            ],
            'MEIC' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
            ],
            'MEP' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
            ],
            'MGP' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
            ],
            'MH' => [
                ['name' => 'Constancia (Imagen en PDF)', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (Unificado)', 'ext' => 'pdf', 'qty' => 1],
            ],
            'MIDEPLAN' => [
                ['name' => 'Constancia (Imagen en PDF)', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
                ['name' => 'Comprobantes Quincenales (PNG)', 'ext' => 'png', 'qty' => 6],
            ],
            'MIGRACION' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
            ],
            'MINAE' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'pdf', 'qty' => 6],
            ],
            'MINIST DE SALUD' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
            ],
            'MJP' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
            ],
            'MOPT' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
            ],
            'MREC' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (Unificado)', 'ext' => 'pdf', 'qty' => 1],
            ],
            'MSP' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
            ],
            'MTSS' => [
                ['name' => 'Constancia (Imagen en PDF)', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
            ],
            'MUN DE ASERRI' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'pdf', 'qty' => 6],
            ],
            'MUN DE DESAM' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'pdf', 'qty' => 6],
            ],
            'MUN DE GOICO' => [
                ['name' => 'Constancia (Imagen en PDF)', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'jpeg', 'qty' => 6],
            ],
            'MUN DE OREAMU' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'pdf', 'qty' => 6],
            ],
            'MUN DE SAN P' => [
                ['name' => 'Constancia', 'ext' => 'jpeg', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (PDF)', 'ext' => 'pdf', 'qty' => 6],
                ['name' => 'Comprobantes Quincenales (JPEG)', 'ext' => 'jpeg', 'qty' => 6],
            ],
            'MUN DE SJ' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'pdf', 'qty' => 6],
            ],
            'MUN DE TIBAS' => [
                ['name' => 'Constancia', 'ext' => 'jpg', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'pdf', 'qty' => 6],
            ],
            'PANI' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (Imágenes en PDF)', 'ext' => 'pdf', 'qty' => 6],
            ],
            'PENSIONADOS PJ' => [
                ['name' => 'Constancia', 'ext' => 'jpeg', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (Unificado)', 'ext' => 'pdf', 'qty' => 1],
            ],
            'PGR' => [
                ['name' => 'Constancia (Imagen en PDF)', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'pdf', 'qty' => 6],
            ],
            'PODER JUDICIAL' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'pdf', 'qty' => 6],
            ],
            'RECOPE' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales', 'ext' => 'pdf', 'qty' => 6],
            ],
            'RN' => [
                ['name' => 'Constancia (Imagen en PDF)', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
            ],
            'TSE' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Quincenales (HTML)', 'ext' => 'html', 'qty' => 6],
            ],
            'UCR' => [
                ['name' => 'Constancia', 'ext' => 'pdf', 'qty' => 1],
                ['name' => 'Comprobantes Mensuales', 'ext' => 'pdf', 'qty' => 3],
            ],
        ];

        foreach ($data as $enterpriseName => $requirements) {
            $enterprise = Enterprise::updateOrCreate(
                ['business_name' => $enterpriseName]
            );

            // Borrar requisitos anteriores para limpieza total
            $enterprise->requirements()->delete();

            foreach ($requirements as $req) {
                $enterprise->requirements()->create([
                    'name' => $req['name'],
                    'file_extension' => $req['ext'],
                    'quantity' => $req['qty'],
                    'upload_date' => $now,
                    'last_updated' => $now,
                ]);
            }
        }
        \DB::statement('SET FOREIGN_KEY_CHECKS=1');
    }
}