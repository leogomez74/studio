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
        Schema::table('analisis', function (Blueprint $table) {
            $table->boolean('constancia_certificada')->default(false)->after('hoja_trabajo_datos');
            $table->string('constancia_metodo')->nullable()->after('constancia_certificada');
            $table->string('constancia_archivo')->nullable()->after('constancia_metodo');
            $table->unsignedBigInteger('constancia_certificada_por')->nullable()->after('constancia_archivo');
            $table->timestamp('constancia_certificada_at')->nullable()->after('constancia_certificada_por');
            $table->text('constancia_notas')->nullable()->after('constancia_certificada_at');
            $table->json('constancia_resultado')->nullable()->after('constancia_notas');
        });
    }

    public function down(): void
    {
        Schema::table('analisis', function (Blueprint $table) {
            $table->dropColumn([
                'constancia_certificada', 'constancia_metodo', 'constancia_archivo',
                'constancia_certificada_por', 'constancia_certificada_at',
                'constancia_notas', 'constancia_resultado',
            ]);
        });
    }
};
