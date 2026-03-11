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
        Schema::create('external_integrations', function (Blueprint $table) {
            $table->id();
            $table->string('name');                          // Nombre visible: "Ecopal", "DSF"
            $table->string('slug')->unique();                // Identificador: "ecopal", "dsf"
            $table->string('type')->default('rutas');        // Tipo: "rutas", "general"
            $table->string('base_url');                      // URL base de la API
            $table->string('auth_type')->default('bearer');  // bearer, basic, api_key, none
            $table->text('auth_token')->nullable();          // Token/API key
            $table->string('auth_user')->nullable();         // Usuario (para basic auth)
            $table->string('auth_password')->nullable();     // Password (para basic auth)
            $table->json('endpoints')->nullable();           // Mapeo de endpoints
            $table->json('headers')->nullable();             // Headers adicionales
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_sync_at')->nullable();
            $table->string('last_sync_status')->nullable();  // success, error
            $table->text('last_sync_message')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('external_integrations');
    }
};
