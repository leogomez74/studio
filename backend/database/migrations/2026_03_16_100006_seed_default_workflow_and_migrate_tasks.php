<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Create default workflow
        $workflowId = DB::table('task_workflows')->insertGetId([
            'name' => 'Por Defecto',
            'slug' => 'por-defecto',
            'description' => 'Flujo de trabajo estándar con los estados básicos del sistema.',
            'color' => '#3b82f6',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Create statuses for default workflow
        $statuses = [
            ['name' => 'Pendiente', 'slug' => 'pendiente', 'color' => '#6b7280', 'icon' => 'clock', 'sort_order' => 1, 'is_initial' => true, 'is_terminal' => false, 'is_closed' => false],
            ['name' => 'En Progreso', 'slug' => 'en_progreso', 'color' => '#3b82f6', 'icon' => 'loader', 'sort_order' => 2, 'is_initial' => false, 'is_terminal' => false, 'is_closed' => false],
            ['name' => 'Completada', 'slug' => 'completada', 'color' => '#22c55e', 'icon' => 'check-circle', 'sort_order' => 3, 'is_initial' => false, 'is_terminal' => true, 'is_closed' => false],
            ['name' => 'Archivada', 'slug' => 'archivada', 'color' => '#f59e0b', 'icon' => 'archive', 'sort_order' => 4, 'is_initial' => false, 'is_terminal' => false, 'is_closed' => true],
        ];

        $statusIds = [];
        foreach ($statuses as $status) {
            $statusIds[$status['slug']] = DB::table('task_workflow_statuses')->insertGetId(array_merge(
                $status,
                ['workflow_id' => $workflowId, 'created_at' => now(), 'updated_at' => now()]
            ));
        }

        // Create transitions
        $transitions = [
            ['from' => 'pendiente', 'to' => 'en_progreso', 'name' => 'Iniciar', 'points' => 5, 'xp' => 5],
            ['from' => 'en_progreso', 'to' => 'completada', 'name' => 'Completar', 'points' => 50, 'xp' => 25],
            ['from' => 'en_progreso', 'to' => 'pendiente', 'name' => 'Devolver', 'points' => 0, 'xp' => 0],
            ['from' => 'completada', 'to' => 'archivada', 'name' => 'Archivar', 'points' => 0, 'xp' => 0],
            ['from' => 'archivada', 'to' => 'pendiente', 'name' => 'Restaurar', 'points' => 0, 'xp' => 0],
            ['from' => 'pendiente', 'to' => 'completada', 'name' => 'Completar directo', 'points' => 40, 'xp' => 20],
        ];

        foreach ($transitions as $t) {
            DB::table('task_workflow_transitions')->insert([
                'workflow_id' => $workflowId,
                'from_status_id' => $statusIds[$t['from']],
                'to_status_id' => $statusIds[$t['to']],
                'name' => $t['name'],
                'points_award' => $t['points'],
                'xp_award' => $t['xp'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Migrate existing tasks to default workflow
        $statusMap = [
            'pendiente' => $statusIds['pendiente'],
            'en_progreso' => $statusIds['en_progreso'],
            'completada' => $statusIds['completada'],
            'archivada' => $statusIds['archivada'],
            'deleted' => $statusIds['archivada'], // map deleted to archivada status
        ];

        foreach ($statusMap as $oldStatus => $newStatusId) {
            DB::table('tasks')
                ->where('status', $oldStatus)
                ->update([
                    'workflow_id' => $workflowId,
                    'workflow_status_id' => $newStatusId,
                ]);
        }

        // Set completed_at for already completed tasks
        DB::table('tasks')
            ->where('status', 'completada')
            ->whereNull('completed_at')
            ->update(['completed_at' => DB::raw('updated_at')]);
    }

    public function down(): void
    {
        // Reset tasks
        DB::table('tasks')->update([
            'workflow_id' => null,
            'workflow_status_id' => null,
        ]);

        // Delete default workflow (cascades to statuses and transitions)
        DB::table('task_workflows')->where('slug', 'por-defecto')->delete();
    }
};
