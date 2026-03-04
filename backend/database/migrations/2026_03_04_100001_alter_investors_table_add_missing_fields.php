<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop and recreate investors table with bigIncrements (table is empty)
        Schema::dropIfExists('investors');

        Schema::create('investors', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('cedula', 20)->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('status')->default('Activo');
            $table->string('tipo_persona')->default('Persona Física');
            $table->text('notas')->nullable();
            $table->string('cuenta_bancaria', 50)->nullable();
            $table->string('banco', 100)->nullable();
            $table->decimal('investment_balance', 15, 2)->default(0);
            $table->date('joined_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('investors');

        Schema::create('investors', function (Blueprint $table) {
            $table->string('id', 20)->primary();
            $table->string('name');
            $table->string('cedula', 20)->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('status')->default('Activo');
            $table->decimal('investment_balance', 15, 2)->default(0);
            $table->date('joined_at')->nullable();
            $table->timestamps();
        });
    }
};
