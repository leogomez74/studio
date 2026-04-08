<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('automation_templates', function (Blueprint $table) {
            // Cambiar enum: quitar 'manual', agregar 'event'
            // MySQL no permite ALTER COLUMN en enums directamente, usamos raw
        });

        DB::statement("ALTER TABLE automation_templates MODIFY COLUMN trigger_type ENUM('scheduled', 'event') NOT NULL DEFAULT 'event'");

        Schema::table('automation_templates', function (Blueprint $table) {
            // event_key: clave del evento de código al que se suscribe (solo para trigger_type=event)
            $table->string('event_key', 100)->nullable()->after('trigger_type');
            $table->index('event_key');
        });
    }

    public function down(): void
    {
        Schema::table('automation_templates', function (Blueprint $table) {
            $table->dropIndex(['event_key']);
            $table->dropColumn('event_key');
        });

        DB::statement("ALTER TABLE automation_templates MODIFY COLUMN trigger_type ENUM('manual', 'scheduled') NOT NULL DEFAULT 'manual'");
    }
};
