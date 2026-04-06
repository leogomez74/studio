<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Crear rol Vendedor si no existe
        $rolId = DB::table('roles')->where('name', 'Vendedor')->value('id');

        if (!$rolId) {
            $rolId = DB::table('roles')->insertGetId([
                'name'        => 'Vendedor',
                'description' => 'Acceso exclusivo al módulo de ventas y sus propios KPIs',
                'full_access' => false,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        }

        // 2. Configurar permisos del rol Vendedor
        $modulos = [
            'reportes'      => [0, 0, 0, 0, 0, 0],
            'kpis'          => [1, 0, 0, 0, 0, 0], // view para sus KPIs propios
            'crm'           => [0, 0, 0, 0, 0, 0],
            'oportunidades' => [0, 0, 0, 0, 0, 0],
            'analizados'    => [0, 0, 0, 0, 0, 0],
            'creditos'      => [0, 0, 0, 0, 0, 0],
            'calculos'      => [0, 0, 0, 0, 0, 0],
            'cobros'        => [0, 0, 0, 0, 0, 0],
            'cobro_judicial'=> [0, 0, 0, 0, 0, 0],
            'ventas'        => [1, 1, 0, 0, 0, 0], // view + create (planificar visitas)
            'inversiones'   => [0, 0, 0, 0, 0, 0],
            'rutas'         => [0, 0, 0, 0, 0, 0],
            'proyectos'     => [0, 0, 0, 0, 0, 0],
            'comunicaciones'=> [0, 0, 0, 0, 0, 0],
            'staff'         => [0, 0, 0, 0, 0, 0],
            'entrenamiento' => [0, 0, 0, 0, 0, 0],
            'recompensas'   => [1, 0, 0, 0, 0, 0], // view para ver sus puntos
            'configuracion' => [0, 0, 0, 0, 0, 0],
            'tareas'        => [0, 0, 0, 0, 0, 0],
            'auditoria'     => [0, 0, 0, 0, 0, 0],
        ];

        foreach ($modulos as $module => [$view, $create, $edit, $delete, $archive, $assign]) {
            $exists = DB::table('role_permissions')
                ->where('role_id', $rolId)
                ->where('module_key', $module)
                ->exists();

            if (!$exists) {
                DB::table('role_permissions')->insert([
                    'role_id'    => $rolId,
                    'module_key' => $module,
                    'can_view'   => $view,
                    'can_create' => $create,
                    'can_edit'   => $edit,
                    'can_delete' => $delete,
                    'can_archive'=> $archive,
                    'can_assign' => $assign,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // 3. Crear 4 vendedores de prueba
        $vendedores = [
            ['name' => 'Ana Mora',    'email' => 'ana.mora@pep.cr'],
            ['name' => 'Luis Vega',   'email' => 'luis.vega@pep.cr'],
            ['name' => 'Carlos Ruiz', 'email' => 'carlos.ruiz@pep.cr'],
            ['name' => 'Diana Solís', 'email' => 'diana.solis@pep.cr'],
        ];

        $userIds = [];
        foreach ($vendedores as $v) {
            $exists = DB::table('users')->where('email', $v['email'])->value('id');
            if ($exists) {
                $userIds[$v['name']] = $exists;
                continue;
            }
            $id = DB::table('users')->insertGetId([
                'name'       => $v['name'],
                'email'      => $v['email'],
                'password'   => Hash::make('vendedor123'),
                'role_id'    => $rolId,
                'status'     => 'Activo',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $userIds[$v['name']] = $id;
        }

        // 4. Crear metas del mes actual con tiers estándar para cada vendedor
        $anio = (int) date('Y');
        $mes  = (int) date('n');

        foreach ($userIds as $nombre => $userId) {
            $existeMeta = DB::table('metas_venta')
                ->where('user_id', $userId)
                ->where('anio', $anio)
                ->where('mes', $mes)
                ->exists();

            if ($existeMeta) continue;

            $metaId = DB::table('metas_venta')->insertGetId([
                'user_id'                  => $userId,
                'anio'                     => $anio,
                'mes'                      => $mes,
                'meta_creditos_monto'      => 50_000_000,
                'meta_creditos_cantidad'   => 20,
                'meta_inversiones_monto'   => 0,
                'meta_inversiones_cantidad'=> 0,
                'notas'                    => 'Meta de prueba — generada por seed',
                'activo'                   => true,
                'created_at'               => now(),
                'updated_at'               => now(),
            ]);

            // Tiers estándar por meta
            $tiers = [
                ['creditos_minimos' => 0,  'porcentaje' => 0.0250, 'puntos_reward' => 100,  'descripcion' => 'Meta básica'],
                ['creditos_minimos' => 20, 'porcentaje' => 0.0300, 'puntos_reward' => 250,  'descripcion' => '20 créditos'],
                ['creditos_minimos' => 30, 'porcentaje' => 0.0350, 'puntos_reward' => 500,  'descripcion' => '30 créditos'],
            ];

            foreach ($tiers as $tier) {
                DB::table('meta_bonus_tiers')->insert(array_merge($tier, [
                    'meta_venta_id' => $metaId,
                    'created_at'    => now(),
                    'updated_at'    => now(),
                ]));
            }
        }

        // 5. Regla de comisión base si no existe ninguna
        $tieneReglas = DB::table('reglas_comision')->exists();
        if (!$tieneReglas) {
            DB::table('reglas_comision')->insert([
                [
                    'nombre'       => 'Crédito estándar',
                    'tipo'         => 'credito',
                    'monto_minimo' => 500_000,
                    'monto_maximo' => 5_000_000,
                    'porcentaje'   => 0.0250,
                    'activo'       => true,
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ],
                [
                    'nombre'       => 'Crédito alto monto',
                    'tipo'         => 'credito',
                    'monto_minimo' => 5_000_001,
                    'monto_maximo' => null,
                    'porcentaje'   => 0.0200,
                    'activo'       => true,
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ],
            ]);
        }
    }

    public function down(): void
    {
        // Eliminar solo los usuarios de prueba creados por esta migración
        $emails = ['ana.mora@pep.cr', 'luis.vega@pep.cr', 'carlos.ruiz@pep.cr', 'diana.solis@pep.cr'];
        $ids = DB::table('users')->whereIn('email', $emails)->pluck('id');

        DB::table('metas_venta')->whereIn('user_id', $ids)->delete();
        DB::table('users')->whereIn('email', $emails)->delete();
        DB::table('roles')->where('name', 'Vendedor')->delete();
    }
};
