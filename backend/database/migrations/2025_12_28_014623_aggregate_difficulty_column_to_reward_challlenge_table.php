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
        Schema::table('reward_challenge', function (Blueprint $table) {
            $table->string('type')->default('individual');
            $table->string('difficulty')->default('medium');
            $table->integer('points_reward')->default(0);
            $table->integer('xp_reward')->default(0);
            //
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reward_challenges', function (Blueprint $table) {
            $table->string('type')->default('individual');
            $table->string('difficulty')->default('medium');
            $table->integer('points_reward')->default(0);
            $table->integer('xp_reward')->default(0);

            //
        });
    }
};
