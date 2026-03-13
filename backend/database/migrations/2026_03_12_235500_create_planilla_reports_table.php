<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('planilla_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deductora_id')->constrained('deductoras')->cascadeOnDelete();
            $table->string('periodo', 7); // YYYY-MM
            $table->string('tipo'); // planilla_cobro, novedades
            $table->string('nombre_archivo')->nullable();
            $table->string('ruta_archivo')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['deductora_id', 'periodo', 'tipo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('planilla_reports');
    }
};
