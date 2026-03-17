<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('workflow_id')->nullable()->after('id')->constrained('task_workflows')->nullOnDelete();
            $table->foreignId('workflow_status_id')->nullable()->after('workflow_id')->constrained('task_workflow_statuses')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->after('assigned_to')->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable()->after('due_date');
            $table->decimal('estimated_hours', 6, 2)->nullable()->after('completed_at');
            $table->decimal('actual_hours', 6, 2)->nullable()->after('estimated_hours');

            $table->index('workflow_id');
            $table->index('workflow_status_id');
            $table->index('completed_at');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropForeign(['workflow_id']);
            $table->dropForeign(['workflow_status_id']);
            $table->dropForeign(['created_by']);
            $table->dropIndex(['workflow_id']);
            $table->dropIndex(['workflow_status_id']);
            $table->dropIndex(['completed_at']);
            $table->dropColumn(['workflow_id', 'workflow_status_id', 'created_by', 'completed_at', 'estimated_hours', 'actual_hours']);
        });
    }
};
