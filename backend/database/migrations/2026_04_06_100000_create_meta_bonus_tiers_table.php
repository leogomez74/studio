<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meta_bonus_tiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meta_venta_id')->constrained('metas_venta')->cascadeOnDelete();
            $table->unsignedInteger('creditos_minimos')->default(0); // 0 = tier base, 20, 30...
            $table->decimal('porcentaje', 5, 4);                     // 0.0250 = 2.5%
            $table->unsignedInteger('puntos_reward')->default(0);    // puntos gamification al alcanzar este tramo
            $table->string('descripcion')->nullable();               // "Meta básica", "20 créditos", etc.
            $table->timestamps();

            $table->index('meta_venta_id');
            $table->unique(['meta_venta_id', 'creditos_minimos']); // no duplicar umbrales por meta
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meta_bonus_tiers');
    }
};
