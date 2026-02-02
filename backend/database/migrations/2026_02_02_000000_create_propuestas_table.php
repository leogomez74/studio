<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('propuestas', function (Blueprint $table) {
            $table->id();
            $table->string('analisis_reference');
            $table->decimal('monto', 15, 2);
            $table->integer('plazo');
            $table->decimal('cuota', 15, 2);
            $table->decimal('interes', 8, 4);
            $table->string('categoria')->nullable();
            $table->string('estado')->default('Pendiente');
            $table->unsignedBigInteger('aceptada_por')->nullable();
            $table->timestamp('aceptada_at')->nullable();
            $table->timestamps();

            $table->foreign('analisis_reference')
                  ->references('reference')
                  ->on('analisis')
                  ->onDelete('cascade');

            $table->foreign('aceptada_por')
                  ->references('id')
                  ->on('users')
                  ->onDelete('set null');

            $table->index('analisis_reference');
            $table->index('estado');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('propuestas');
    }
};
