<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('investment_coupons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('investment_id')->constrained('investments')->cascadeOnDelete();
            $table->date('fecha_cupon');
            $table->decimal('interes_bruto', 15, 2);
            $table->decimal('retencion', 15, 2);
            $table->decimal('interes_neto', 15, 2);
            $table->decimal('monto_reservado', 15, 2)->default(0);
            $table->enum('estado', ['Pendiente', 'Pagado', 'Reservado'])->default('Pendiente');
            $table->date('fecha_pago')->nullable();
            $table->text('notas')->nullable();
            $table->timestamps();

            $table->index(['investment_id', 'fecha_cupon']);
            $table->index('estado');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('investment_coupons');
    }
};
