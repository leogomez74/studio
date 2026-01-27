<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Normaliza la tabla instituciones para que coincida exactamente con el PDF
     * "Instituciones y Convenios Actualizado".
     *
     * 1. Elimina duplicados y entradas que no están en el PDF.
     * 2. Renombra entradas referenciadas (enterprises/persons) al nombre del PDF.
     * 3. Renombra entradas no referenciadas al formato del PDF.
     * 4. Normaliza persons.institucion_labora.
     */
    public function up(): void
    {
        // [nombre actual referenciado, nombre correcto del PDF]
        $renames = [
            ['911',              'ICE EMERGENCIA 911'],
            ['Archivo Nacional', 'ARCHIVO NACIONAL'],
            ['ASAMB L',         'ASAMBLEA LEGISLATIVA'],
            ['DEFENSORIA',      'DEFENSORIA DE LOS HABITANTES'],
            ['DGAC',            'AVIACIÓN CIVIL'],
            ['DINADECO',        'DESARROLLO DE LA COMUNIDAD'],
            ['MAG',             'MINISTERIO DE AGRICULTURA Y GANADERÍA'],
            ['MCE',             'MINISTERIO DE COMERCIO EXTERIOR'],
            ['MCJ',             'MINISTERIO DE CULT. JUV Y DEPORTES'],
            ['MEIC',            'MINISTERIO DE ECO. IND Y COMERCIO'],
            ['MEP',             'MINISTERIO DE EDUCACIÓN PÚBLICA'],
            ['MGP',             'MINISTERIO DE GOBERNACIÓN Y POLICÍA'],
            ['MH',              'MINISTERIO DE HACIENDA'],
            ['MIDEPLAN',        'MINISTERIO DE PLANIF. NAC Y POL. ECO'],
            ['MIGRACION',       'CONTROL DE MIGRACIÓN Y EXTRANJERÍA'],
            ['MINIST DE SALUD', 'MINISTERIO DE SALUD'],
            ['MJP',             'MINISTERIO DE JUSTICIA Y GRACIA'],
            ['MOPT',            'MINISTERIO DE OBRAS PÚBLICAS Y TRANSPORTE'],
            ['MREC',            'MINISTERIO DE RELACIONES EXTERIORES Y CULTO'],
            ['MSP',             'MINISTERIO DE SEGURIDAD PÚBLICA'],
            ['MTSS',            'MINISTERIO DE TRABAJO Y SEGURO SOCIAL'],
            ['MUN DE ASERRI',   'MUNICIPALIDAD DE ASERRI'],
            ['MUN DE DESAM',    'MUNICIPALIDAD DE DESAMPARADOS'],
            ['MUN DE GOICO',    'MUNICIPALIDAD DE GOICOECHEA'],
            ['MUN DE OREAMU',   'MUNICIPALIDAD DE OREAMUNO'],
            ['MUN DE SAN P',    'MUNICIPALIDAD DE SAN PABLO'],
            ['MUN DE SJ',       'MUNICIPALIDAD DE SAN JOSÉ'],
            ['MUN DE TIBAS',    'MUNICIPALIDAD DE TIBÁS'],
            ['PENSIONADOS PJ',  'PENSIONADOS PODER JUDICIAL'],
            ['PGR',             'PROCURADURÍA GENERAL DE LA REPÚBLICA'],
            ['RN',              'REGISTRO NACIONAL'],
            ['TSE',             'TRIBUNAL SUPREMO DE ELECCIONES'],
        ];

        // Entradas no referenciadas que solo necesitan rename en instituciones
        $nonRefRenames = [
            ['A.N.E.P.',          'ANEP'],
            ['I.A.F.A.',          'IAFA'],
            ['I.C.O.D.E.R',      'ICODER'],
            ['O.T.M.',            'OTM'],
            ['CN MUSICA',         'CN MÚSICA'],
            ['ICE ENERGIA Y TELEC.', 'ICE ENERGÍA Y TELEC'],
            ['MINISTERIO DE VIVIENDA Y ASENT.HUMANOS', 'MINISTERIO DE VIVIENDA Y ASENT. HUMANOS'],
            ['MIN DE CIENCIA TECNOLOGÍA Y TELECOMUNICACIONES', 'MINISTERIO DE CIENCIA TECNOLOGÍA Y TELECOMUNICACIÓN'],
        ];

        // Entradas a eliminar: duplicados cuya versión correcta será creada por rename,
        // o entradas que no están en el PDF.
        $toDelete = [
            // Duplicados con puntos (versión limpia queda por rename o ya existe)
            'C.C.S.S',
            'C.N.P.',
            'CEN-CINAI',
            'I.C.E.',
            'I.M.A.S',
            'P.A.N.I',
            'ICE EMERGENCIAS 911',
            // Nombres largos duplicados (el referenciado será renombrado a este nombre,
            // así que eliminamos la entrada duplicada no-referenciada ANTES del rename)
            'AVIACION CIVIL',
            'ASAMBLEA LEGISLATIVA',
            'CONTROL DE MIGRACIÓN Y EXTRANJERÍA',
            'CORONADO',
            'DEFENSORÍA DE LOS HABITANTES',
            'DESARROLLO DE LA COMUNIDAD',
            'DIRECCIÓN GENERAL DE SERVICIO CIVIL',
            'MIN DE AGRICULTURA Y GANADERÍA',
            'MIN DE COMERCIO EXTERIOR',
            'MIN DE CULT.JUV Y DEPORTES',
            'MIN DE ECO.IND Y COMERCIO',
            'MIN DE GOBERNACIÓN Y POLICÍA',
            'MINISTERIO DE AMBIENTE Y ENERGÍA',
            'MINISTERIO DE EDUACIÓN PÚBLICA',
            'MINISTERIO DE HACIENDA',
            'MINISTERIO DE JUSTICIA Y GRACIA',
            'MINISTERIO DE OBRAS PUBL. Y TRANSPORTE',
            'MINISTERIO DE PLANIF.NAC Y POL.ECO',
            'MINISTERIO DE RELACIONES EXTERIORES Y CULTO',
            'MINISTERIO DE SEGURIDAD PÚBLICA',
            'MINISTERIO DE TRAB. Y SEGUR. SOC',
            'MINSITERIO DE TRAB. Y SEGUR. SOC',
            'MINSTERIO DE SALUD',
            'MUNICIPALIDAD DE ASERRI',
            'MUNICIPALIDAD DE CORONADO',
            'MUNICIPALIDAD DE DESAMPARADOS',
            'MUNICIPALIDAD DE GOICOECHEA',
            'MUNICIPALIDAD DE OREAMUNO',
            'MUNICIPALIDAD DE SAN JOSÉ',
            'MUNICIPALIDAD DE SAN PABLO',
            'MUNICIPALIDAD DE TIBÁS',
            'MUNICIPALIDAD SAN JOSÉ',
            'PENSIONADOS PODER JUDICIAL',
            'PROCURADURÍA GENERAL DE LA REPÚBLICA',
            'REGISTRO NACIONAL',
            'TRIBUNAL SUPREMO DE ELECCIONES',
            // No están en el PDF
            'DGSC',
            'GOBIERNO CENTRAL INTEGRA',
            'INDER (IDA)',
            'TSC',
            'UCR UNIVERSIDAD DE COSTA RICA',
        ];

        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        // 1. Eliminar duplicados y no-PDF primero (libera nombres para renames)
        DB::table('instituciones')->whereIn('nombre', $toDelete)->delete();

        // 2. Renombrar referenciadas en instituciones + enterprises + persons
        foreach ($renames as [$old, $new]) {
            DB::table('instituciones')->where('nombre', $old)->update([
                'nombre' => $new,
                'updated_at' => now(),
            ]);
            DB::table('enterprises')->where('business_name', $old)->update([
                'business_name' => $new,
            ]);
            DB::table('persons')->where('institucion_labora', $old)->update([
                'institucion_labora' => $new,
            ]);
        }

        // 3. Renombrar no-referenciadas al formato PDF
        foreach ($nonRefRenames as [$old, $new]) {
            DB::table('instituciones')->where('nombre', $old)->update([
                'nombre' => $new,
                'updated_at' => now(),
            ]);
        }

        // 4. Normalizar persons con case diferente
        $personFixes = [
            ['Ministerio de Educación Pública', 'MINISTERIO DE EDUCACIÓN PÚBLICA'],
            ['Ministerio de Hacienda',          'MINISTERIO DE HACIENDA'],
            ['Poder Judicial',                  'PODER JUDICIAL'],
        ];
        foreach ($personFixes as [$old, $new]) {
            DB::table('persons')->where('institucion_labora', $old)->update([
                'institucion_labora' => $new,
            ]);
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=1');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Normalización no reversible de forma automática.
    }
};
