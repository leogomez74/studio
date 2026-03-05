<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('investment_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('investor_id')->constrained('investors')->cascadeOnDelete();
            $table->foreignId('investment_id')->nullable()->constrained('investments')->nullOnDelete();
            $table->date('fecha_pago');
            $table->decimal('monto', 15, 2);
            $table->enum('tipo', ['Interés', 'Capital', 'Adelanto', 'Liquidación']);
            $table->enum('moneda', ['CRC', 'USD']);
            $table->text('comentarios')->nullable();
            $table->timestamps();

            $table->index(['investor_id', 'fecha_pago']);
            $table->index('investment_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('investment_payments');
    }
};
