<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private array $modulos = [
        'reportes'       => [0, 0, 0, 0, 0, 0],
        'kpis'           => [1, 0, 0, 0, 0, 0],
        'crm'            => [0, 0, 0, 0, 0, 0],
        'oportunidades'  => [0, 0, 0, 0, 0, 0],
        'analizados'     => [0, 0, 0, 0, 0, 0],
        'creditos'       => [0, 0, 0, 0, 0, 0],
        'calculos'       => [0, 0, 0, 0, 0, 0],
        'cobros'         => [0, 0, 0, 0, 0, 0],
        'cobro_judicial' => [0, 0, 0, 0, 0, 0],
        'ventas'         => [1, 1, 0, 0, 0, 0],
        'inversiones'    => [0, 0, 0, 0, 0, 0],
        'rutas'          => [0, 0, 0, 0, 0, 0],
        'proyectos'      => [0, 0, 0, 0, 0, 0],
        'comunicaciones' => [0, 0, 0, 0, 0, 0],
        'staff'          => [0, 0, 0, 0, 0, 0],
        'entrenamiento'  => [0, 0, 0, 0, 0, 0],
        'recompensas'    => [1, 0, 0, 0, 0, 0],
        'configuracion'  => [0, 0, 0, 0, 0, 0],
        'tareas'         => [0, 0, 0, 0, 0, 0],
        'auditoria'      => [0, 0, 0, 0, 0, 0],
    ];

    public function up(): void
    {
        foreach (['Vendedor Interno', 'Vendedor Externo'] as $nombre) {
            $rolId = DB::table('roles')->where('name', $nombre)->value('id');

            if (!$rolId) {
                $desc = $nombre === 'Vendedor Interno'
                    ? 'Vendedor perteneciente a la plantilla interna de la empresa'
                    : 'Vendedor externo / comisionista independiente';

                $rolId = DB::table('roles')->insertGetId([
                    'name'        => $nombre,
                    'description' => $desc,
                    'full_access' => false,
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }

            foreach ($this->modulos as $module => [$view, $create, $edit, $delete, $archive, $assign]) {
                $exists = DB::table('role_permissions')
                    ->where('role_id', $rolId)
                    ->where('module_key', $module)
                    ->exists();

                if (!$exists) {
                    DB::table('role_permissions')->insert([
                        'role_id'     => $rolId,
                        'module_key'  => $module,
                        'can_view'    => $view,
                        'can_create'  => $create,
                        'can_edit'    => $edit,
                        'can_delete'  => $delete,
                        'can_archive' => $archive,
                        'can_assign'  => $assign,
                        'created_at'  => now(),
                        'updated_at'  => now(),
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        foreach (['Vendedor Interno', 'Vendedor Externo'] as $nombre) {
            $rolId = DB::table('roles')->where('name', $nombre)->value('id');
            if ($rolId) {
                DB::table('role_permissions')->where('role_id', $rolId)->delete();
                DB::table('roles')->where('id', $rolId)->delete();
            }
        }
    }
};
