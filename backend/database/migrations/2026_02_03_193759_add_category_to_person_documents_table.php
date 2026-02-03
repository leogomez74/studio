<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('person_documents', function (Blueprint $table) {
            $table->enum('category', ['cedula', 'recibo_servicio', 'comprobante_ingresos', 'constancia_trabajo', 'otro'])
                  ->default('otro')
                  ->after('person_id');
        });
    }

    public function down(): void
    {
        Schema::table('person_documents', function (Blueprint $table) {
            $table->dropColumn('category');
        });
    }
};
