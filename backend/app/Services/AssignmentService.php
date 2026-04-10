<?php

namespace App\Services;

use App\Models\ModuleAssignment;
use Illuminate\Support\Facades\DB;

class AssignmentService
{
    /**
     * Module → table + person_type_id filter for counting existing assignments.
     */
    private const MODULE_COUNT_MAP = [
        'leads'    => ['table' => 'persons', 'type_id' => 1],
        'crm'      => ['table' => 'persons', 'type_id' => 2],
        'analysis' => ['table' => 'opportunities', 'type_id' => null],
        'credits'  => ['table' => 'credits', 'type_id' => null],
        'cobro'    => ['table' => 'credits', 'type_id' => null],
    ];

    /**
     * Returns the user_id that should receive the next assignment for the given module.
     * When multiple users share a module, picks the one with the fewest existing assignments.
     */
    public function getNextAssignee(string $module): ?int
    {
        $assignments = ModuleAssignment::where('module', $module)
            ->where('is_active', true)
            ->get();

        if ($assignments->isEmpty()) {
            return null;
        }

        if ($assignments->count() === 1) {
            return $assignments->first()->user_id;
        }

        $config = self::MODULE_COUNT_MAP[$module] ?? null;

        return $assignments
            ->sortBy(function ($assignment) use ($config) {
                if (!$config) {
                    return 0;
                }

                $query = DB::table($config['table'])
                    ->where('assigned_to_id', $assignment->user_id);

                if ($config['type_id'] !== null) {
                    $query->where('person_type_id', $config['type_id']);
                }

                return $query->count();
            })
            ->first()
            ->user_id;
    }
}
