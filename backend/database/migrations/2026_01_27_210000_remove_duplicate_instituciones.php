<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Elimina instituciones duplicadas insertadas por error en
     * 2026_01_27_200000_insert_instituciones_actualizadas.
     *
     * Estas son variantes con nombres "limpios" del PDF que duplican
     * registros existentes con nombres abreviados/con puntos, los cuales
     * están referenciados en enterprises.business_name y persons.institucion_labora.
     */
    public function up(): void
    {
        $duplicados = [
            'ANEP',
            'IAFA',
            'ICE EMERGENCIA 911',
            'ICE ENERGÍA Y TELEC',
            'ICODER',
            'MINISTERIO DE AGRICULTURA Y GANADERÍA',
            'MINISTERIO DE CIENCIA TECNOLOGÍA Y TELECOMUNICACIÓN',
            'MINISTERIO DE COMERCIO EXTERIOR',
            'MINISTERIO DE CULT. JUV Y DEPORTES',
            'MINISTERIO DE ECO. IND Y COMERCIO',
            'MINISTERIO DE EDUCACIÓN PÚBLICA',
            'MINISTERIO DE GOBERNACIÓN Y POLICÍA',
            'MINISTERIO DE OBRAS PÚBLICAS Y TRANSPORTE',
            'MINISTERIO DE PLANIF. NAC Y POL. ECO',
            'MINISTERIO DE SALUD',
            'MINISTERIO DE TRABAJO Y SEGURO SOCIAL',
            'MINISTERIO DE VIVIENDA Y ASENT. HUMANOS',
            'OTM',
        ];

        DB::table('instituciones')->whereIn('nombre', $duplicados)->delete();
    }

    /**
     * Reverse: re-inserta los registros eliminados.
     */
    public function down(): void
    {
        $timestamp = now();

        $instituciones = [
            'ANEP',
            'IAFA',
            'ICE EMERGENCIA 911',
            'ICE ENERGÍA Y TELEC',
            'ICODER',
            'MINISTERIO DE AGRICULTURA Y GANADERÍA',
            'MINISTERIO DE CIENCIA TECNOLOGÍA Y TELECOMUNICACIÓN',
            'MINISTERIO DE COMERCIO EXTERIOR',
            'MINISTERIO DE CULT. JUV Y DEPORTES',
            'MINISTERIO DE ECO. IND Y COMERCIO',
            'MINISTERIO DE EDUCACIÓN PÚBLICA',
            'MINISTERIO DE GOBERNACIÓN Y POLICÍA',
            'MINISTERIO DE OBRAS PÚBLICAS Y TRANSPORTE',
            'MINISTERIO DE PLANIF. NAC Y POL. ECO',
            'MINISTERIO DE SALUD',
            'MINISTERIO DE TRABAJO Y SEGURO SOCIAL',
            'MINISTERIO DE VIVIENDA Y ASENT. HUMANOS',
            'OTM',
        ];

        $data = array_map(fn(string $nombre) => [
            'nombre' => $nombre,
            'activa' => true,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ], $instituciones);

        DB::table('instituciones')->insertOrIgnore($data);
    }
};
