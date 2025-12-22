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
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('reward_user_badges');
        Schema::enableForeignKeyConstraints();
        Schema::create('reward_user_badges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reward_user_id')->constrained('reward_users')->onDelete('cascade');
            $table->foreignId('reward_badge_id')->constrained('reward_badges')->onDelete('cascade');
            $table->timestamp('earned_at');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['reward_user_id', 'reward_badge_id']);
            $table->index('earned_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reward_user_badges');
    }
};
