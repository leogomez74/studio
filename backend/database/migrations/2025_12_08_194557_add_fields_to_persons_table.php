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
        Schema::table('persons', function (Blueprint $table) {
            $table->string('genero')->nullable();
            $table->string('nacionalidad')->nullable();
            $table->string('telefono2')->nullable();
            $table->string('telefono3')->nullable();
            $table->string('institucion_labora')->nullable();
            $table->string('departamento_cargo')->nullable();
            $table->foreignId('deductora_id')->nullable()->constrained('deductoras')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('persons', function (Blueprint $table) {
            $table->dropForeign(['deductora_id']);
            $table->dropColumn([
                'genero',
                'nacionalidad',
                'telefono2',
                'telefono3',
                'institucion_labora',
                'departamento_cargo',
                'deductora_id'
            ]);
        });
    }
};
