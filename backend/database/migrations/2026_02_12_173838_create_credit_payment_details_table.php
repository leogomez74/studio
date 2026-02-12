<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credit_payment_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('credit_payment_id')->constrained('credit_payments')->cascadeOnDelete();
            $table->foreignId('plan_de_pago_id')->constrained('plan_de_pagos')->cascadeOnDelete();
            $table->integer('numero_cuota');
            $table->string('estado_anterior', 20);
            $table->decimal('pago_mora', 12, 2)->default(0);
            $table->decimal('pago_int_vencido', 12, 2)->default(0);
            $table->decimal('pago_int_corriente', 12, 2)->default(0);
            $table->decimal('pago_poliza', 12, 2)->default(0);
            $table->decimal('pago_principal', 12, 2)->default(0);
            $table->decimal('pago_total', 12, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_payment_details');
    }
};
