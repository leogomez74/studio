<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_automation_assignees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('automation_id')->constrained('task_automations')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unique(['automation_id', 'user_id']);
        });

        // Migrar datos existentes: copiar assigned_to al pivote
        $automations = DB::table('task_automations')
            ->whereNotNull('assigned_to')
            ->get(['id', 'assigned_to']);

        foreach ($automations as $auto) {
            DB::table('task_automation_assignees')->insert([
                'automation_id' => $auto->id,
                'user_id' => $auto->assigned_to,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('task_automation_assignees');
    }
};
