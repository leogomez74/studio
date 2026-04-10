<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automation_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->string('module', 50); // credits, leads, opportunities, investments
            $table->enum('trigger_type', ['manual', 'scheduled'])->default('manual');
            $table->string('cron_expression', 100)->nullable(); // solo si scheduled
            $table->json('condition_json')->nullable(); // motor de condiciones
            $table->string('default_title', 255); // título de la tarea generada
            $table->text('description')->nullable(); // descripción para el admin
            $table->enum('priority', ['alta', 'media', 'baja'])->default('media');
            $table->unsignedInteger('due_days_offset')->default(3);
            $table->unsignedBigInteger('workflow_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('last_run_at')->nullable();
            $table->timestamps();

            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('workflow_id')->references('id')->on('task_workflows')->onDelete('set null');
        });

        Schema::create('automation_template_assignees', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('template_id');
            $table->unsignedBigInteger('user_id');
            $table->timestamps();

            $table->foreign('template_id')->references('id')->on('automation_templates')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->unique(['template_id', 'user_id']);
        });

        Schema::create('automation_template_checklist', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('template_id');
            $table->string('title', 255);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('template_id')->references('id')->on('automation_templates')->onDelete('cascade');
        });

        Schema::create('automation_template_executions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('template_id');
            $table->string('record_type', 50)->nullable(); // App\Models\Credit, etc.
            $table->unsignedBigInteger('record_id')->nullable(); // id del registro afectado
            $table->unsignedBigInteger('triggered_by')->nullable(); // user_id o null si es sistema
            $table->unsignedBigInteger('task_id')->nullable(); // tarea generada
            $table->enum('status', ['success', 'failed', 'skipped'])->default('success');
            $table->text('notes')->nullable();
            $table->timestamp('executed_at')->useCurrent();
            $table->timestamps();

            $table->foreign('template_id')->references('id')->on('automation_templates')->onDelete('cascade');
            $table->foreign('triggered_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('task_id')->references('id')->on('tasks')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_template_executions');
        Schema::dropIfExists('automation_template_checklist');
        Schema::dropIfExists('automation_template_assignees');
        Schema::dropIfExists('automation_templates');
    }
};
