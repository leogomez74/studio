<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('metas_venta', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedSmallInteger('anio');
            $table->unsignedTinyInteger('mes'); // 1-12
            // Metas de créditos
            $table->decimal('meta_creditos_monto', 15, 2)->default(0);
            $table->unsignedInteger('meta_creditos_cantidad')->default(0);
            // Metas de inversiones
            $table->decimal('meta_inversiones_monto', 15, 2)->default(0);
            $table->unsignedInteger('meta_inversiones_cantidad')->default(0);
            $table->text('notas')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->unique(['user_id', 'anio', 'mes']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('metas_venta');
    }
};
