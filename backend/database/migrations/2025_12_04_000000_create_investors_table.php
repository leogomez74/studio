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
        if (!Schema::hasTable('investors')) {
            Schema::create('investors', function (Blueprint $table) {
                $table->string('id', 20)->primary(); // String PK
                $table->string('name');
                $table->string('cedula', 20);
                $table->string('email');
                $table->string('phone', 20)->nullable();
                $table->string('status')->default('Activo');
                $table->decimal('investment_balance', 15, 2)->default(0);
                $table->date('joined_at')->nullable();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('investors');
    }
};
