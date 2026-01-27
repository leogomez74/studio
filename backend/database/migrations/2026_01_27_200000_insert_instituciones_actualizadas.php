<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Instituciones actualizadas desde el PDF "Instituciones y Convenios Actualizado".
     * Usa insertOrIgnore para no duplicar registros existentes (nombre es unique).
     */
    public function up(): void
    {
        $instituciones = [
            // Municipalidades
            'MUNICIPALIDAD DE SAN JOSÉ',
            'MUNICIPALIDAD DE TIBÁS',
            'MUNICIPALIDAD DE GOICOECHEA',
            'MUNICIPALIDAD DE OREAMUNO',
            'MUNICIPALIDAD DE CORONADO',
            'MUNICIPALIDAD DE DESAMPARADOS',
            'MUNICIPALIDAD DE MORAVIA',
            'MUNICIPALIDAD DE GRECIA',
            'MUNICIPALIDAD DE ALVARADO',
            'MUNICIPALIDAD DE ASERRI',
            'MUNICIPALIDAD DE CORREDORES',
            'MUNICIPALIDAD DE MORA',
            'MUNICIPALIDAD DE OROTINA',
            'MUNICIPALIDAD DE NARANJO',
            'MUNICIPALIDAD DE PARRITA',
            'MUNICIPALIDAD DE PALMARES',
            'MUNICIPALIDAD DE PUNTARENAS',
            'MUNICIPALIDAD DE SAN MATEO',
            'MUNICIPALIDAD DE SAN PABLO',
            'MUNICIPALIDAD DE SAN VITO',

            // Ministerios
            'MINISTERIO DE SALUD',
            'MINISTERIO DE AGRICULTURA Y GANADERÍA',
            'MINISTERIO DE AMBIENTE Y ENERGÍA',
            'MINISTERIO DE CIENCIA TECNOLOGÍA Y TELECOMUNICACIÓN',
            'MINISTERIO DE COMERCIO EXTERIOR',
            'MINISTERIO DE CULT. JUV Y DEPORTES',
            'MINISTERIO DE GOBERNACIÓN Y POLICÍA',
            'MINISTERIO DE ECO. IND Y COMERCIO',
            'MINISTERIO DE EDUCACIÓN PÚBLICA',
            'MINISTERIO DE HACIENDA',
            'MINISTERIO DE JUSTICIA Y GRACIA',
            'MINISTERIO DE LA PRESIDENCIA',
            'MINISTERIO DE OBRAS PÚBLICAS Y TRANSPORTE',
            'MINISTERIO DE PLANIF. NAC Y POL. ECO',
            'MINISTERIO DE RELACIONES EXTERIORES Y CULTO',
            'MINISTERIO DE SEGURIDAD PÚBLICA',
            'MINISTERIO DE TRABAJO Y SEGURO SOCIAL',
            'MINISTERIO DE VIVIENDA Y ASENT. HUMANOS',

            // Tribunales
            'TRIBUNAL DE SERVICIO CIVIL',
            'TRIBUNAL SUPREMO DE ELECCIONES',

            // Instituciones Descentralizadas
            'ANEP',
            'AYA',
            'ARCHIVO NACIONAL',
            'ASAMBLEA LEGISLATIVA',
            'AVIACIÓN CIVIL',
            'CNP',
            'CCSS',
            'CONAVI',
            'COSEVI',
            'CEN CINAI',
            'CONTROL DE MIGRACIÓN Y EXTRANJERÍA',
            'CN MÚSICA',
            'CNE',
            'CNC',
            'COOPEJOVO',
            'DEFENSORIA DE LOS HABITANTES',
            'DESARROLLO DE LA COMUNIDAD',
            'DIRECCIÓN NACIONAL DE REGISTRO CIVIL',
            'DIRECCIÓN NACIONAL DE PENSIONES',
            'FITOSANITARIO',
            'FANAL',
            'FONAFIFO',
            'INA',
            'IMAS',
            'IAFA',
            'ICE',
            'ICODER',
            'IMPRENTA NACIONAL',
            'ICD',
            'ICE EMERGENCIA 911',
            'IFAM',
            'INDER',
            'INVU',
            'INTA',
            'ICE ENERGÍA Y TELEC',
            'JUNTA ADM. REGISTRO NACIONAL',
            'MINAE',
            'MUSEO NACIONAL',
            'OTM',
            'PERSONA JOVEN',
            'PODER JUDICIAL',
            'PENSIONADOS PODER JUDICIAL',
            'PRESIDENCIA DE LA REPÚBLICA',
            'PROCURADURÍA GENERAL DE LA REPÚBLICA',
            'PANI',
            'RECOPE',
            'REGISTRO NACIONAL',
            'SERVICIO EXTERIOR',
            'SENASA',
            'SEC',
            'TEATRO NACIONAL',
            'UCR',
        ];

        sort($instituciones);

        $timestamp = now();
        $data = array_map(function (string $nombre) use ($timestamp) {
            return [
                'nombre' => $nombre,
                'activa' => true,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }, $instituciones);

        foreach (array_chunk($data, 50) as $chunk) {
            DB::table('instituciones')->insertOrIgnore($chunk);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $nombres = [
            'MINISTERIO DE SALUD',
            'MINISTERIO DE AGRICULTURA Y GANADERÍA',
            'MINISTERIO DE AMBIENTE Y ENERGÍA',
            'MINISTERIO DE CIENCIA TECNOLOGÍA Y TELECOMUNICACIÓN',
            'MINISTERIO DE COMERCIO EXTERIOR',
            'MINISTERIO DE CULT. JUV Y DEPORTES',
            'MINISTERIO DE GOBERNACIÓN Y POLICÍA',
            'MINISTERIO DE ECO. IND Y COMERCIO',
            'MINISTERIO DE EDUCACIÓN PÚBLICA',
            'MINISTERIO DE OBRAS PÚBLICAS Y TRANSPORTE',
            'MINISTERIO DE PLANIF. NAC Y POL. ECO',
            'MINISTERIO DE TRABAJO Y SEGURO SOCIAL',
            'MINISTERIO DE VIVIENDA Y ASENT. HUMANOS',
            'ANEP',
            'AVIACIÓN CIVIL',
            'CN MÚSICA',
            'DEFENSORIA DE LOS HABITANTES',
            'DIRECCIÓN NACIONAL DE REGISTRO CIVIL',
            'IAFA',
            'ICODER',
            'ICE EMERGENCIA 911',
            'ICE ENERGÍA Y TELEC',
            'OTM',
        ];

        DB::table('instituciones')->whereIn('nombre', $nombres)->delete();
    }
};
