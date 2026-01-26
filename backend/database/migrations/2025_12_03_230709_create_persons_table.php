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
        Schema::dropIfExists('persons');
        Schema::enableForeignKeyConstraints();
        Schema::create('persons', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('apellido1')->nullable();
            $table->string('apellido2')->nullable();
            $table->string('cedula', 20)->nullable()->unique();
            $table->string('email')->nullable()->unique();
            $table->string('phone', 20)->nullable();
            $table->string('status')->default('Activo'); // Legacy status string

            // Extended Contact Info
            $table->string('whatsapp', 50)->nullable();
            $table->string('tel_casa', 50)->nullable();
            $table->string('tel_amigo', 50)->nullable();

            // Address
            $table->string('province')->nullable(); // provincia
            $table->string('canton')->nullable();
            $table->string('distrito')->nullable();
            $table->string('direccion1')->nullable();
            $table->string('direccion2')->nullable();

            // Personal Info
            $table->string('ocupacion')->nullable();
            $table->string('estado_civil')->nullable();
            $table->date('fecha_nacimiento')->nullable();

            // Relations / References
            $table->string('relacionado_a')->nullable();
            $table->string('tipo_relacion')->nullable();

            // Fields for Leads
            $table->text('notes')->nullable();
            $table->string('source')->nullable();

            // System Flags
            $table->boolean('is_active')->default(true);

            // Discriminator
            $table->integer('person_type_id')->index(); // 1: Lead, 2: Client

            // Relations
            $table->foreignId('assigned_to_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('lead_status_id')->nullable()->constrained('lead_statuses')->nullOnDelete();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */

    public function down(): void
    {
        Schema::dropIfExists('persons');
    }
};