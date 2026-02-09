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
            // Referencia 2
            $table->string('tel_amigo_2', 50)->nullable()->after('tipo_relacion');
            $table->string('relacionado_a_2')->nullable()->after('tel_amigo_2');
            $table->string('tipo_relacion_2')->nullable()->after('relacionado_a_2');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('persons', function (Blueprint $table) {
            $table->dropColumn([
                'tel_amigo_2',
                'relacionado_a_2',
                'tipo_relacion_2',
            ]);
        });
    }
};
