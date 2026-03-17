<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_workflow_statuses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_id')->constrained('task_workflows')->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('slug', 100);
            $table->string('color', 7)->default('#6b7280');
            $table->string('icon', 50)->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_initial')->default(false);
            $table->boolean('is_terminal')->default(false);
            $table->boolean('is_closed')->default(false);
            $table->timestamps();

            $table->unique(['workflow_id', 'slug']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_workflow_statuses');
    }
};
