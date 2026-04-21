<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evolution_instances', function (Blueprint $table) {
            $table->id();
            $table->text('api_key');                          // Encriptada por el modelo
            $table->string('instance_name')->default('');     // Obtenido desde Evolution API
            $table->string('phone_number')->default('');      // Obtenido desde Evolution API
            $table->string('profile_name')->default('');      // Nombre del perfil WhatsApp
            $table->string('status')->default('unknown');     // open / closed / connecting / unknown
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evolution_instances');
    }
};
