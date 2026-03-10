<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->string('reference', 20)->nullable()->unique()->after('id');
        });

        // Poblar reference para tareas existentes
        $tasks = DB::table('tasks')->select('id')->orderBy('id')->get();
        foreach ($tasks as $task) {
            DB::table('tasks')->where('id', $task->id)->update([
                'reference' => 'TA-' . str_pad($task->id, 4, '0', STR_PAD_LEFT),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn('reference');
        });
    }
};
