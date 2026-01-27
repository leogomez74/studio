<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lead_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('alert_type', 50);
            $table->tinyInteger('alert_number');
            $table->json('inactive_leads')->nullable();
            $table->json('inactive_opportunities')->nullable();
            $table->text('message');
            $table->boolean('is_read')->default(false);
            $table->unsignedBigInteger('assigned_to_id')->nullable();
            $table->timestamps();

            $table->index('alert_type');
            $table->index('alert_number');
            $table->index('is_read');
            $table->index('created_at');
            $table->foreign('assigned_to_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_alerts');
    }
};
