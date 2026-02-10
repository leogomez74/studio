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
        Schema::table('credits', function (Blueprint $table) {
            $table->unsignedBigInteger('refundicion_parent_id')->nullable()->after('opportunity_id');
            $table->foreign('refundicion_parent_id')->references('id')->on('credits')->nullOnDelete();

            $table->unsignedBigInteger('refundicion_child_id')->nullable()->after('refundicion_parent_id');
            $table->foreign('refundicion_child_id')->references('id')->on('credits')->nullOnDelete();

            $table->decimal('refundicion_saldo_absorbido', 15, 2)->nullable()->after('refundicion_child_id');
            $table->decimal('refundicion_monto_entregado', 15, 2)->nullable()->after('refundicion_saldo_absorbido');
            $table->timestamp('refundicion_at')->nullable()->after('refundicion_monto_entregado');
            $table->string('cierre_motivo')->nullable()->after('refundicion_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('credits', function (Blueprint $table) {
            $table->dropForeign(['refundicion_parent_id']);
            $table->dropForeign(['refundicion_child_id']);
            $table->dropColumn([
                'refundicion_parent_id',
                'refundicion_child_id',
                'refundicion_saldo_absorbido',
                'refundicion_monto_entregado',
                'refundicion_at',
                'cierre_motivo',
            ]);
        });
    }
};
