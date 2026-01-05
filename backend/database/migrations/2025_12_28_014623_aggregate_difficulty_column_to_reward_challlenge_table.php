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
        Schema::table('reward_challenges', function (Blueprint $table) {
            if (!Schema::hasColumn('reward_challenges', 'difficulty')) {
                $table->string('difficulty')->default('medium')->after('type');
            }

            if (!Schema::hasColumn('reward_challenges', 'points_reward')) {
                $table->integer('points_reward')->default(0)->after('description');
            }

            if (!Schema::hasColumn('reward_challenges', 'xp_reward')) {
                $table->integer('xp_reward')->default(0)->after('points_reward');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reward_challenges', function (Blueprint $table) {
            $columns = ['difficulty', 'points_reward', 'xp_reward'];

            foreach ($columns as $column) {
                if (Schema::hasColumn('reward_challenges', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
