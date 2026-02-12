<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('credit_payments', function (Blueprint $table) {
            $table->string('estado_reverso', 20)->default('Vigente')->after('estado');
            $table->string('motivo_anulacion', 255)->nullable()->after('estado_reverso');
            $table->unsignedBigInteger('anulado_por')->nullable()->after('motivo_anulacion');
            $table->dateTime('fecha_anulacion')->nullable()->after('anulado_por');
            $table->foreign('anulado_por')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('credit_payments', function (Blueprint $table) {
            $table->dropForeign(['anulado_por']);
            $table->dropColumn(['estado_reverso', 'motivo_anulacion', 'anulado_por', 'fecha_anulacion']);
        });
    }
};
