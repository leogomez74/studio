<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Actualizar tareas existentes que tienen project_code numérico (sin prefijo)
        // Necesitamos determinar el módulo basándonos en el contexto disponible

        // 1. Créditos: tienen project_name y project_code con formato de referencia (ej: "25-12345-0007-CO")
        // Buscar el credit.id correspondiente a la referencia y cambiar a CRED-{id}
        $creditTasks = DB::table('tasks')
            ->whereNotNull('project_code')
            ->where('project_code', 'NOT LIKE', 'LEAD-%')
            ->where('project_code', 'NOT LIKE', 'OPP-%')
            ->where('project_code', 'NOT LIKE', 'ANA-%')
            ->where('project_code', 'NOT LIKE', 'CRED-%')
            ->where('project_code', 'REGEXP', '[^0-9]') // contiene caracteres no numéricos = referencia de crédito
            ->get(['id', 'project_code']);

        foreach ($creditTasks as $task) {
            $credit = DB::table('credits')->where('reference', $task->project_code)->first(['id']);
            if ($credit) {
                DB::table('tasks')->where('id', $task->id)->update(['project_code' => 'CRED-' . $credit->id]);
            }
        }

        // 2. Para tareas con project_code numérico, intentar determinar el módulo
        // por el título o details de la tarea (basado en los templates de automatización)
        $numericTasks = DB::table('tasks')
            ->whereNotNull('project_code')
            ->where('project_code', 'NOT LIKE', 'LEAD-%')
            ->where('project_code', 'NOT LIKE', 'OPP-%')
            ->where('project_code', 'NOT LIKE', 'ANA-%')
            ->where('project_code', 'NOT LIKE', 'CRED-%')
            ->where('project_code', 'REGEXP', '^[0-9]+$') // solo dígitos
            ->get(['id', 'project_code', 'title']);

        foreach ($numericTasks as $task) {
            $entityId = $task->project_code;
            $title = strtolower($task->title);

            // Determinar módulo por título de la tarea automática
            if (str_contains($title, 'nuevo lead') || str_contains($title, 'lead creado')) {
                DB::table('tasks')->where('id', $task->id)->update(['project_code' => 'LEAD-' . $entityId]);
            } elseif (str_contains($title, 'propuesta') || str_contains($title, 'pep') || str_contains($title, 'no califica') || str_contains($title, 'análisis') || str_contains($title, 'analisis')) {
                // Verificar si el ID corresponde a un análisis existente
                $exists = DB::table('analisis')->where('id', $entityId)->exists();
                if ($exists) {
                    DB::table('tasks')->where('id', $task->id)->update(['project_code' => 'ANA-' . $entityId]);
                } else {
                    // Podría ser oportunidad
                    $oppExists = DB::table('opportunities')->where('id', $entityId)->exists();
                    if ($oppExists) {
                        DB::table('tasks')->where('id', $task->id)->update(['project_code' => 'OPP-' . $entityId]);
                    }
                }
            } elseif (str_contains($title, 'colillas') || str_contains($title, 'oportunidad')) {
                DB::table('tasks')->where('id', $task->id)->update(['project_code' => 'OPP-' . $entityId]);
            } else {
                // Fallback: intentar encontrar la entidad por ID en orden de probabilidad
                if (DB::table('analisis')->where('id', $entityId)->exists()) {
                    DB::table('tasks')->where('id', $task->id)->update(['project_code' => 'ANA-' . $entityId]);
                } elseif (DB::table('opportunities')->where('id', $entityId)->exists()) {
                    DB::table('tasks')->where('id', $task->id)->update(['project_code' => 'OPP-' . $entityId]);
                } elseif (DB::table('persons')->where('id', $entityId)->where('person_type_id', 1)->exists()) {
                    DB::table('tasks')->where('id', $task->id)->update(['project_code' => 'LEAD-' . $entityId]);
                }
            }
        }
    }

    public function down(): void
    {
        // No es práctico revertir esta migración
    }
};
