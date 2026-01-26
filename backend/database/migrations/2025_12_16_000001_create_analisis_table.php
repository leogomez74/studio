<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('analisis', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->string('title');
            $table->string('status');
            $table->string('category')->nullable();
            $table->decimal('monto_credito', 15, 2);
            $table->unsignedBigInteger('lead_id');
            $table->unsignedBigInteger('opportunity_id')->nullable();
            $table->string('assigned_to')->nullable();
            $table->date('opened_at')->nullable();
            $table->text('description')->nullable();
            $table->string('divisa')->default('CRC');
            $table->integer('plazo')->default(36);
            $table->timestamps();

            // Foreign keys (optional, uncomment if needed)
            // $table->foreign('lead_id')->references('id')->on('leads');
            // $table->foreign('opportunity_id')->references('id')->on('opportunities');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analisis');
    }
};
