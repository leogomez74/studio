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
        Schema::table('reward_catalog_items', function (Blueprint $table) {
            // Rename cost to points_cost to match model
            if (Schema::hasColumn('reward_catalog_items', 'cost') && !Schema::hasColumn('reward_catalog_items', 'points_cost')) {
                $table->renameColumn('cost', 'points_cost');
            }
        });

        Schema::table('reward_catalog_items', function (Blueprint $table) {
            // Add missing columns from model
            if (!Schema::hasColumn('reward_catalog_items', 'icon')) {
                $table->string('icon')->nullable()->after('category');
            }
            if (!Schema::hasColumn('reward_catalog_items', 'max_per_user')) {
                $table->integer('max_per_user')->nullable()->after('stock');
            }
            if (!Schema::hasColumn('reward_catalog_items', 'requirements')) {
                $table->json('requirements')->nullable()->after('max_per_user');
            }
            if (!Schema::hasColumn('reward_catalog_items', 'is_featured')) {
                $table->boolean('is_featured')->default(false)->after('is_active');
            }
            if (!Schema::hasColumn('reward_catalog_items', 'sort_order')) {
                $table->integer('sort_order')->default(0)->after('is_featured');
            }
        });

        // Drop columns not used by model
        Schema::table('reward_catalog_items', function (Blueprint $table) {
            if (Schema::hasColumn('reward_catalog_items', 'currency')) {
                $table->dropColumn('currency');
            }
            if (Schema::hasColumn('reward_catalog_items', 'level_required')) {
                $table->dropColumn('level_required');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reward_catalog_items', function (Blueprint $table) {
            // Restore original columns
            if (!Schema::hasColumn('reward_catalog_items', 'currency')) {
                $table->string('currency')->default('points')->after('points_cost');
            }
            if (!Schema::hasColumn('reward_catalog_items', 'level_required')) {
                $table->integer('level_required')->default(1)->after('image_url');
            }
        });

        Schema::table('reward_catalog_items', function (Blueprint $table) {
            // Drop added columns
            $columns = ['icon', 'max_per_user', 'requirements', 'is_featured', 'sort_order'];
            foreach ($columns as $column) {
                if (Schema::hasColumn('reward_catalog_items', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        // Rename points_cost back to cost
        if (Schema::hasColumn('reward_catalog_items', 'points_cost') && !Schema::hasColumn('reward_catalog_items', 'cost')) {
            Schema::table('reward_catalog_items', function (Blueprint $table) {
                $table->renameColumn('points_cost', 'cost');
            });
        }
    }
};
