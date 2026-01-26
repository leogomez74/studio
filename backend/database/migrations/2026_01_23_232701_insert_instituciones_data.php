<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $instituciones = [
            '911',
            'A.N.E.P.',
            'Archivo Nacional',
            'ASAMB L',
            'ASAMBLEA LEGISLATIVA',
            'AVIACION CIVIL',
            'AYA',
            'C.C.S.S',
            'C.N.P.',
            'CCSS',
            'CEN CINAI',
            'CEN-CINAI',
            'CN MUSICA',
            'CNC',
            'CNE',
            'CNP',
            'CONAVI',
            'CONTROL DE MIGRACIÓN Y EXTRANJERÍA',
            'COOPEJOVO',
            'CORONADO',
            'COSEVI',
            'DEFENSORIA',
            'DEFENSORÍA DE LOS HABITANTES',
            'DESARROLLO DE LA COMUNIDAD',
            'DGAC',
            'DGSC',
            'DINADECO',
            'DIRECCIÓN GENERAL DE SERVICIO CIVIL',
            'DIRECCIÓN NACIONAL DE PENSIONES',
            'FANAL',
            'FITOSANITARIO',
            'FONAFIFO',
            'GOBIERNO CENTRAL INTEGRA',
            'I.A.F.A.',
            'I.C.E.',
            'I.C.O.D.E.R',
            'I.M.A.S',
            'ICD',
            'ICE',
            'ICE EMERGENCIAS 911',
            'ICE ENERGIA Y TELEC.',
            'IFAM',
            'IMAS',
            'IMPRENTA NACIONAL',
            'INA',
            'INDER',
            'INDER (IDA)',
            'INTA',
            'INVU',
            'JUNTA ADM. REGISTRO NACIONAL',
            'MAG',
            'MCE',
            'MCJ',
            'MEIC',
            'MEP',
            'MGP',
            'MH',
            'MIDEPLAN',
            'MIGRACION',
            'MIN DE AGRICULTURA Y GANADERÍA',
            'MIN DE CIENCIA TECNOLOGÍA Y TELECOMUNICACIONES',
            'MIN DE COMERCIO EXTERIOR',
            'MIN DE CULT.JUV Y DEPORTES',
            'MIN DE ECO.IND Y COMERCIO',
            'MIN DE GOBERNACIÓN Y POLICÍA',
            'MINAE',
            'MINIST DE SALUD',
            'MINISTERIO DE AMBIENTE Y ENERGÍA',
            'MINISTERIO DE EDUACIÓN PÚBLICA',
            'MINISTERIO DE HACIENDA',
            'MINISTERIO DE JUSTICIA Y GRACIA',
            'MINISTERIO DE LA PRESIDENCIA',
            'MINISTERIO DE OBRAS PUBL. Y TRANSPORTE',
            'MINISTERIO DE PLANIF.NAC Y POL.ECO',
            'MINISTERIO DE RELACIONES EXTERIORES Y CULTO',
            'MINISTERIO DE SEGURIDAD PÚBLICA',
            'MINISTERIO DE TRAB. Y SEGUR. SOC',
            'MINISTERIO DE VIVIENDA Y ASENT.HUMANOS',
            'MINSTERIO DE SALUD',
            'MINSITERIO DE TRAB. Y SEGUR. SOC',
            'MJP',
            'MOPT',
            'MREC',
            'MSP',
            'MTSS',
            'MUN DE ASERRI',
            'MUN DE DESAM',
            'MUN DE GOICO',
            'MUN DE OREAMU',
            'MUN DE SAN P',
            'MUN DE SJ',
            'MUN DE TIBAS',
            'MUNICIPALIDAD DE ALVARADO',
            'MUNICIPALIDAD DE ASERRI',
            'MUNICIPALIDAD DE CORONADO',
            'MUNICIPALIDAD DE CORREDORES',
            'MUNICIPALIDAD DE DESAMPARADOS',
            'MUNICIPALIDAD DE GOICOECHEA',
            'MUNICIPALIDAD DE GRECIA',
            'MUNICIPALIDAD DE MORA',
            'MUNICIPALIDAD DE MORAVIA',
            'MUNICIPALIDAD DE NARANJO',
            'MUNICIPALIDAD DE OREAMUNO',
            'MUNICIPALIDAD DE OROTINA',
            'MUNICIPALIDAD DE PALMARES',
            'MUNICIPALIDAD DE PARRITA',
            'MUNICIPALIDAD DE PUNTARENAS',
            'MUNICIPALIDAD DE SAN JOSÉ',
            'MUNICIPALIDAD DE SAN MATEO',
            'MUNICIPALIDAD DE SAN PABLO',
            'MUNICIPALIDAD DE SAN VITO',
            'MUNICIPALIDAD DE TIBÁS',
            'MUNICIPALIDAD SAN JOSÉ',
            'MUSEO NACIONAL',
            'O.T.M.',
            'P.A.N.I',
            'PANI',
            'PENSIONADOS PODER JUDICIAL',
            'PENSIONADOS PJ',
            'PERSONA JOVEN',
            'PGR',
            'PODER JUDICIAL',
            'PRESIDENCIA DE LA REPÚBLICA',
            'PROCURADURÍA GENERAL DE LA REPÚBLICA',
            'RECOPE',
            'REGISTRO NACIONAL',
            'RN',
            'SEC',
            'SENASA',
            'SERVICIO EXTERIOR',
            'TEATRO NACIONAL',
            'TRIBUNAL DE SERVICIO CIVIL',
            'TRIBUNAL SUPREMO DE ELECCIONES',
            'TSC',
            'TSE',
            'UCR',
            'UCR UNIVERSIDAD DE COSTA RICA',
        ];

        // Ordenar alfabéticamente
        sort($instituciones);

        // Insertar cada institución
        $timestamp = now();
        $data = array_map(function($nombre) use ($timestamp) {
            return [
                'nombre' => $nombre,
                'activa' => true,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }, $instituciones);

        // Insertar en lotes para mejor rendimiento
        foreach (array_chunk($data, 50) as $chunk) {
            DB::table('instituciones')->insert($chunk);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('instituciones')->truncate();
    }
};
