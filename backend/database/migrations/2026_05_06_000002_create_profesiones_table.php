<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profesiones', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150)->unique();
            $table->string('slug')->index();
            $table->boolean('is_active')->default(true);
            $table->integer('order_column')->default(0);
            $table->timestamps();
        });

        $profesiones = [
            'Abogado(a)', 'Actor/Actriz', 'Administrador(a) de Empresas', 'Administrador(a) de Fincas',
            'Administrador(a) Público', 'Agrónomo(a)', 'Analista de Datos', 'Analista de Sistemas',
            'Antropólogo(a)', 'Archivista', 'Arquitecto(a)', 'Asistente Administrativo(a)',
            'Asistente Dental', 'Asistente Legal', 'Auditor(a)', 'Bibliotecólogo(a)', 'Biólogo(a)',
            'Bombero(a)', 'Cajero(a)', 'Chef / Cocinero(a)', 'Chofer / Conductor(a)',
            'Comunicador(a) Social', 'Conserje', 'Contador(a)', 'Criminólogo(a)',
            'Dentista / Odontólogo(a)', 'Desarrollador(a) de Software', 'Diseñador(a) Gráfico',
            'Diseñador(a) Industrial', 'Economista', 'Educador(a)', 'Electricista', 'Enfermero(a)',
            'Escritor(a)', 'Estadístico(a)', 'Farmacéutico(a)', 'Filólogo(a)', 'Filósofo(a)',
            'Físico(a)', 'Fisioterapeuta', 'Fotógrafo(a)', 'Funcionario(a) Público', 'Geógrafo(a)',
            'Geólogo(a)', 'Gestor(a) Ambiental', 'Guarda de Seguridad', 'Historiador(a)',
            'Ingeniero(a) Agrícola', 'Ingeniero(a) Ambiental', 'Ingeniero(a) Civil',
            'Ingeniero(a) Eléctrico', 'Ingeniero(a) Electrónico', 'Ingeniero(a) en Computación',
            'Ingeniero(a) en Sistemas', 'Ingeniero(a) Industrial', 'Ingeniero(a) Mecánico',
            'Ingeniero(a) Químico', 'Investigador(a)', 'Laboratorista', 'Locutor(a)',
            'Matemático(a)', 'Mecánico(a)', 'Médico(a)', 'Mercadólogo(a)', 'Meteorólogo(a)',
            'Microbiólogo(a)', 'Misceláneo(a)', 'Músico(a)', 'Notario(a)', 'Nutricionista',
            'Obrero(a)', 'Oficial de Seguridad', 'Operador(a) de Maquinaria', 'Optometrista',
            'Orientador(a)', 'Paramédico(a)', 'Pediatra', 'Periodista', 'Piloto',
            'Planificador(a)', 'Policía', 'Politólogo(a)', 'Profesor(a)',
            'Profesor(a) Universitario', 'Programador(a)', 'Promotor(a) Social', 'Psicólogo(a)',
            'Psiquiatra', 'Publicista', 'Químico(a)', 'Radiólogo(a)', 'Recepcionista',
            'Relacionista Público', 'Secretario(a)', 'Sociólogo(a)', 'Soldador(a)',
            'Técnico(a) en Electrónica', 'Técnico(a) en Enfermería', 'Técnico(a) en Informática',
            'Técnico(a) en Mantenimiento', 'Técnico(a) en Refrigeración', 'Tecnólogo(a) Médico',
            'Teólogo(a)', 'Terapeuta Ocupacional', 'Topógrafo(a)', 'Trabajador(a) Social',
            'Traductor(a)', 'Vendedor(a)', 'Veterinario(a)', 'Otro',
        ];

        $now = now();
        $rows = [];
        foreach ($profesiones as $i => $nombre) {
            $rows[] = [
                'name' => $nombre,
                'slug' => Str::slug($nombre),
                'is_active' => true,
                'order_column' => $i,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        DB::table('profesiones')->insert($rows);
    }

    public function down(): void
    {
        Schema::dropIfExists('profesiones');
    }
};
