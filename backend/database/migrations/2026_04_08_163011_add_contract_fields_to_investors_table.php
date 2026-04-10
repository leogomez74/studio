<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('investors', function (Blueprint $table) {
            $table->string('nacionalidad')->nullable()->after('tipo_persona');
            $table->string('estado_civil')->nullable()->after('nacionalidad');
            $table->string('profesion')->nullable()->after('estado_civil');
            $table->text('direccion_contrato')->nullable()->after('profesion');
            $table->string('numero_pasaporte')->nullable()->after('direccion_contrato');
        });
    }
    public function down(): void {
        Schema::table('investors', function (Blueprint $table) {
            $table->dropColumn(['nacionalidad', 'estado_civil', 'profesion', 'direccion_contrato', 'numero_pasaporte']);
        });
    }
};
