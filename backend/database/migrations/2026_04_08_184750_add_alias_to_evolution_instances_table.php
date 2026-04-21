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
        if (!Schema::hasTable('evolution_instances')) {
            return;
        }

        Schema::table('evolution_instances', function (Blueprint $table) {
            if (!Schema::hasColumn('evolution_instances', 'alias')) {
                $table->string('alias')->default('')->after('api_key');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('evolution_instances')) {
            return;
        }

        Schema::table('evolution_instances', function (Blueprint $table) {
            if (Schema::hasColumn('evolution_instances', 'alias')) {
                $table->dropColumn('alias');
            }
        });
    }
};
