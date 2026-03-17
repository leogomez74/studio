<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_workflow_transitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_id')->constrained('task_workflows')->cascadeOnDelete();
            $table->foreignId('from_status_id')->constrained('task_workflow_statuses')->cascadeOnDelete();
            $table->foreignId('to_status_id')->constrained('task_workflow_statuses')->cascadeOnDelete();
            $table->string('name', 100)->nullable();
            $table->integer('points_award')->default(0);
            $table->integer('xp_award')->default(0);
            $table->timestamps();

            $table->unique(['workflow_id', 'from_status_id', 'to_status_id'], 'task_wf_transition_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_workflow_transitions');
    }
};
