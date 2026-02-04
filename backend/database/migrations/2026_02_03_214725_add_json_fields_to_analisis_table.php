<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Las columnas salarios_anteriores y deducciones ya existen
        // Esta migración se mantiene vacía para registro histórico
    }

    public function down(): void
    {
        // No-op: las columnas ya existían antes de esta migración
    }
};
