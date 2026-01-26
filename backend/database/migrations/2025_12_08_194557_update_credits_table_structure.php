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
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('credits');
        Schema::enableForeignKeyConstraints();
        Schema::create('credits', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->string('title');
            $table->string('status')->default('Abierto');
            $table->string('category')->nullable();
            $table->string('assigned_to')->nullable();
            $table->integer('progress')->default(0);
            $table->timestamp('opened_at')->nullable();
            $table->text('description')->nullable();
            $table->foreignId('lead_id')->constrained('persons')->onDelete('cascade');
            $table->string('opportunity_id')->nullable();
            $table->foreign('opportunity_id')->references('id')->on('opportunities')->onDelete('set null');
            // Campos adicionales de la migración alter
            $table->string('tipo_credito')->nullable();
            $table->string('numero_operacion')->unique()->nullable();
            $table->decimal('monto_credito', 15, 2)->default(0);
            $table->decimal('cuota', 15, 2)->default(0);
            $table->date('fecha_ultimo_pago')->nullable();
            $table->string('garantia')->nullable();
            $table->date('fecha_culminacion_credito')->nullable();
            $table->decimal('tasa_anual', 5, 2)->default(33.5);
            $table->integer('plazo')->default(0);
            $table->integer('cuotas_atrasadas')->default(0);
            $table->foreignId('deductora_id')->nullable()->constrained('deductoras')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('credits');
    }
};
