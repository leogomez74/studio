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
            if (!Schema::hasColumn('reward_challenges', 'icon')) {
                $table->string('icon')->nullable()->after('difficulty');
            }
            if (!Schema::hasColumn('reward_challenges', 'image_url')) {
                $table->string('image_url')->nullable()->after('icon');
            }
            if (!Schema::hasColumn('reward_challenges', 'points_reward')) {
                $table->integer('points_reward')->default(0)->after('image_url');
            }
            if (!Schema::hasColumn('reward_challenges', 'xp_reward')) {
                $table->integer('xp_reward')->default(0)->after('points_reward');
            }
            if (!Schema::hasColumn('reward_challenges', 'badge_reward_id')) {
                $table->unsignedBigInteger('badge_reward_id')->nullable()->after('xp_reward');
            }
            if (!Schema::hasColumn('reward_challenges', 'is_featured')) {
                $table->boolean('is_featured')->default(false)->after('is_active');
            }
            if (!Schema::hasColumn('reward_challenges', 'sort_order')) {
                $table->integer('sort_order')->default(0)->after('is_featured');
            }
        });

        // Rename date columns to match model expectations
        if (Schema::hasColumn('reward_challenges', 'start_date') && !Schema::hasColumn('reward_challenges', 'starts_at')) {
            Schema::table('reward_challenges', function (Blueprint $table) {
                $table->renameColumn('start_date', 'starts_at');
            });
        }
        if (Schema::hasColumn('reward_challenges', 'end_date') && !Schema::hasColumn('reward_challenges', 'ends_at')) {
            Schema::table('reward_challenges', function (Blueprint $table) {
                $table->renameColumn('end_date', 'ends_at');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Rename columns back
        if (Schema::hasColumn('reward_challenges', 'starts_at')) {
            Schema::table('reward_challenges', function (Blueprint $table) {
                $table->renameColumn('starts_at', 'start_date');
            });
        }
        if (Schema::hasColumn('reward_challenges', 'ends_at')) {
            Schema::table('reward_challenges', function (Blueprint $table) {
                $table->renameColumn('ends_at', 'end_date');
            });
        }

        Schema::table('reward_challenges', function (Blueprint $table) {
            $columns = ['difficulty', 'icon', 'image_url', 'points_reward', 'xp_reward', 'badge_reward_id', 'is_featured', 'sort_order'];
            foreach ($columns as $column) {
                if (Schema::hasColumn('reward_challenges', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
