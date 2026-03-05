<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Primero ampliar el enum de estado
        DB::statement("ALTER TABLE investments MODIFY COLUMN estado ENUM('Activa','Finalizada','Liquidada','Cancelada','Renovada') DEFAULT 'Activa'");

        Schema::table('investments', function (Blueprint $table) {
            $table->decimal('tipo_cambio', 10, 4)->nullable()->after('notas');
            $table->foreignId('investment_origen_id')->nullable()->after('tipo_cambio')
                ->constrained('investments')->nullOnDelete();
            $table->string('cancelado_por')->nullable()->after('investment_origen_id');
            $table->date('fecha_cancelacion')->nullable()->after('cancelado_por');
        });
    }

    public function down(): void
    {
        Schema::table('investments', function (Blueprint $table) {
            $table->dropForeign(['investment_origen_id']);
            $table->dropColumn(['tipo_cambio', 'investment_origen_id', 'cancelado_por', 'fecha_cancelacion']);
        });

        DB::statement("ALTER TABLE investments MODIFY COLUMN estado ENUM('Activa','Finalizada','Liquidada') DEFAULT 'Activa'");
    }
};
