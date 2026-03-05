<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('investment_rate_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('investment_id')->constrained('investments')->cascadeOnDelete();
            $table->decimal('tasa_anterior', 8, 4);
            $table->decimal('tasa_nueva', 8, 4);
            $table->foreignId('cambiado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->text('motivo')->nullable();
            $table->timestamps();

            $table->index('investment_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('investment_rate_history');
    }
};
