<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Enterprise;
use App\Models\EnterpriseEmployeeDocumentRequirement;

class EnterpriseSeeder extends Seeder
{
    public function run(): void
    {
        $empresas = [
            "I.M.A.S", "C.N.P.", "A.N.E.P.", "P.A.N.I", "MUNICIPALIDAD DE TIBÁS", "MUNICIPALIDAD SAN JOSÉ", "C.C.S.S", 
            "PERSONA JOVEN", "CONAVI", "MUNICIPALIDAD DE GOICOECHEA", "CORONADO", "COSEVI", "UCR", "CEN-CINAI", "INA", 
            "I.C.E.", "MUNICIPALIDAD GRECIA", "I.A.F.A.", "I.C.O.D.E.R", "RECOPE", "MUNICIPALIDAD DE OREAMUNO", 
            "PODER JUDICIAL", "PENSIONADOS PODER JUDICIAL", "MUNICIPALIDAD DE MORAVIA", "O.T.M.", "ASAMBLEA LEGISLATIVA", 
            "CONTROL DE MIGRACIÓN Y EXTRANJERÍA", "DEFENSORÍA DE LOS HABITANTES", "DESARROLLO DE LA COMUNIDAD", 
            "DIRECCIÓN GENERAL DE SERVICIO CIVIL", "DIRECCIÓN NACIONAL DE PENSIONES", "IMPRENTA NACIONAL", 
            "MIN DE AGRICULTURA Y GANADERÍA", "MINISTERIO DE AMBIENTE Y ENERGÍA", "MIN DE CIENCIA TECNOLOGÍA Y TELECOMUNICACIONES", 
            "MIN DE COMERCIO EXTERIOR", "MIN DE CULT.JUV Y DEPORTES", "MIN DE GOBERNACIÓN Y POLICÍA", "MIN DE ECO.IND Y COMERCIO", 
            "MINISTERIO DE EDUACIÓN PÚBLICA", "MINISTERIO DE HACIENDA", "MINISTERIO DE JUSTICIA Y GRACIA", 
            "MINISTERIO DE LA PRESIDENCIA", "MINISTERIO DE OBRAS PUBL. Y TRANSPORTE", "MINISTERIO DE PLANIF.NAC Y POL.ECO", 
            "MINISTERIO DE RELACIONES EXTERIORES Y CULTO", "MINSTERIO DE SALUD", "MINISTERIO DE SEGURIDAD PÚBLICA", 
            "MINSITERIO DE TRAB. Y SEGUR. SOC", "MINISTERIO DE VIVIENDA Y ASENT.HUMANOS", "PRESIDENCIA DE LA REPÚBLICA", 
            "PROCURADURÍA GENERAL DE LA REPÚBLICA", "REGISTRO NACIONAL", "SERVICIO EXTERIOR", "TRIBUNAL DE SERVICIO CIVIL", 
            "TRIBUNAL SUPREMO DE ELECCIONES", "AYA", "ARCHIVO NACIONAL", "CN MUSICA", "CNE", "COOPEJOVO", "FANAL", 
            "FITOSANITARIO", "SENASA", "FONAFIFO", "ICD", "ICE EMERGENCIAS 911", "IFAM", "INDER (IDA)", "INVU", "SEC", 
            "TEATRO NACIONAL", "CNC", "GOBIERNO CENTRAL INTEGRA", "INTA", "JUNTA ADM. REGISTRO NACIONAL", "MINAE", "IMAS", 
            "ICE ENERGIA Y TELEC.", "AVIACION CIVIL", "MUNICIPALIDAD DE ALVARADO", "MUNICIPALIDAD DE ASERRI", 
            "MUNICIPALIDAD DE CORONADO", "MUNICIPALIDAD DE CORREDORES", "MUNICIPALIDAD DE DESAMPARADOS", "MUNICIPALIDAD DE MORA", 
            "MUNICIPALIDAD DE NARANJO", "MUNICIPALIDAD DE OROTINA", "MUNICIPALIDAD DE PALMARES", "MUNICIPALIDAD DE PARRITA", 
            "MUNICIPALIDAD DE PUNTARENAS", "MUNICIPALIDAD DE SAN MATEO", "MUNICIPALIDAD DE SAN PABLO", "MUNICIPALIDAD DE SAN VITO"
        ];
        $tipos = ['Constancia', 'Colilla'];
        $extensiones = ['pdf', 'html'];
        $fecha = now();
        foreach ($empresas as $empresa) {
            $enterprise = Enterprise::create([
                'business_name' => $empresa,
            ]);
            foreach ($tipos as $tipo) {
                foreach ($extensiones as $ext) {
                    $enterprise->requirements()->create([
                        'file_extension' => $ext,
                        'binary' => '', // Aquí puedes poner datos binarios de ejemplo
                        'upload_date' => $fecha,
                        'last_updated' => $fecha,
                    ]);
                }
            }
        }
    }
}
