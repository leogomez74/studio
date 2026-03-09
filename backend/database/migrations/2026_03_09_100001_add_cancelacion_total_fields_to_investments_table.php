<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('investments', function (Blueprint $table) {
            $table->timestamp('fecha_pago_total')->nullable()->after('fecha_cancelacion');
            $table->string('tipo_cancelacion_total', 20)->nullable()->after('fecha_pago_total');
        });
    }

    public function down(): void
    {
        Schema::table('investments', function (Blueprint $table) {
            $table->dropColumn(['fecha_pago_total', 'tipo_cancelacion_total']);
        });
    }
};
