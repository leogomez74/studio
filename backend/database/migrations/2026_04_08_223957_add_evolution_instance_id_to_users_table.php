<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('evolution_instance_id')
                  ->nullable()
                  ->constrained('evolution_instances')
                  ->nullOnDelete()
                  ->after('is_default_lead_assignee');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeignIdFor(\App\Models\EvolutionInstance::class);
            $table->dropColumn('evolution_instance_id');
        });
    }
};
