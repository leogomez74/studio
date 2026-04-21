<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('evolution_instances', function (Blueprint $table) {
            // ID del inbox de Chatwoot asociado a esta instancia.
            // Cuando está presente, los mensajes entrantes llegan vía Chatwoot webhook
            // en lugar del webhook directo de Evolution API.
            $table->unsignedBigInteger('chatwoot_inbox_id')->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('evolution_instances', function (Blueprint $table) {
            $table->dropColumn('chatwoot_inbox_id');
        });
    }
};
