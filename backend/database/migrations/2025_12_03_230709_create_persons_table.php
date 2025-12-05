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
        if (!Schema::hasTable('persons')) {
            Schema::create('persons', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('cedula', 20)->unique();
                $table->string('email')->unique()->nullable();
                $table->string('phone', 20)->nullable();
                $table->string('status')->default('Activo'); // Default status

                // Fields for Leads
                $table->text('notes')->nullable();
                $table->string('source')->nullable();

                // Fields for Clients
                $table->string('province')->nullable();
                $table->string('canton')->nullable();
                $table->string('address')->nullable(); // Mapped from 'direccion1' in controller logic, keeping standard name

                // Discriminator
                $table->integer('person_type_id')->index(); // 1: Lead, 2: Client

                // Relations
                $table->foreignId('assigned_to_id')->nullable()->constrained('users')->nullOnDelete();

                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('persons');
    }
};
