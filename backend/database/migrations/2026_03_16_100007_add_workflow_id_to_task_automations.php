<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('task_automations', function (Blueprint $table) {
            $table->foreignId('workflow_id')->nullable()->after('is_active')->constrained('task_workflows')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('task_automations', function (Blueprint $table) {
            $table->dropForeign(['workflow_id']);
            $table->dropColumn('workflow_id');
        });
    }
};
