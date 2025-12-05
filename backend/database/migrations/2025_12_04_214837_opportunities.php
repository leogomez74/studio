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
        if (!Schema::hasTable('opportunities')) {
            Schema::create('opportunities', function (Blueprint $table) {
                $table->string('id', 20)->primary();
                $table->string('lead_cedula', 20);
                $table->enum('credit_type', ['Regular', 'Micro-crédito']);
                $table->decimal('amount', 15, 2);
                $table->enum('status', ['En proceso', 'Rechazada', 'Aceptada', 'Convertido']);
                $table->date('start_date');
                $table->unsignedBigInteger('assigned_to_id'); // Corrected type for User FK

                $table->timestamps();

                // Foreign Keys (Commented out as per log recommendation until data/indexes are ready)
                // $table->foreign('lead_cedula')->references('cedula')->on('persons');
                // $table->foreign('assigned_to_id')->references('id')->on('users');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('opportunities');
    }
};
