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
        Schema::dropIfExists('reward_transactions');
        Schema::enableForeignKeyConstraints();
        Schema::create('reward_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reward_user_id')->constrained('reward_users')->onDelete('cascade');
            $table->string('type');  // earn, spend, bonus, expire, badge_reward, challenge_reward
            $table->integer('amount');
            $table->string('currency')->default('points');  // points, coins, xp
            $table->text('description')->nullable();
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->integer('balance_after')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['reward_user_id', 'type']);
            $table->index(['reference_type', 'reference_id']);
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reward_transactions');
    }
};
