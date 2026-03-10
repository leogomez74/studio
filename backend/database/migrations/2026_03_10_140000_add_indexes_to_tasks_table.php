<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->index('assigned_to');
            $table->index('status');
            $table->index('due_date');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropIndex(['assigned_to']);
            $table->dropIndex(['status']);
            $table->dropIndex(['due_date']);
        });
    }
};
