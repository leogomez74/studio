<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('capital_reserves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('investor_id')->constrained('investors')->cascadeOnDelete();
            $table->foreignId('investment_id')->nullable()->constrained('investments')->nullOnDelete();
            $table->decimal('monto_reserva', 15, 2);
            $table->text('descripcion')->nullable();
            $table->timestamps();

            $table->index('investor_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('capital_reserves');
    }
};
