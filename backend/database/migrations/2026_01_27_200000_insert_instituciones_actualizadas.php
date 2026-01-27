<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Instituciones nuevas desde el PDF "Instituciones y Convenios Actualizado".
     *
     * Las demás instituciones del PDF ya existían en la tabla con nombres
     * abreviados o con variantes (ej: A.N.E.P., I.A.F.A., MIN DE..., MUN DE...).
     * Esos nombres se mantienen porque están referenciados en enterprises y persons.
     *
     * Solo se agrega la institución genuinamente nueva.
     */
    public function up(): void
    {
        $timestamp = now();

        DB::table('instituciones')->insertOrIgnore([
            [
                'nombre' => 'DIRECCIÓN NACIONAL DE REGISTRO CIVIL',
                'activa' => true,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('instituciones')->where('nombre', 'DIRECCIÓN NACIONAL DE REGISTRO CIVIL')->delete();
    }
};
