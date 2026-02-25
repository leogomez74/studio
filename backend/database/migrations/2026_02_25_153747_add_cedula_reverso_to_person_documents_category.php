<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE person_documents MODIFY COLUMN category ENUM('cedula', 'cedula_reverso', 'recibo_servicio', 'comprobante_ingresos', 'constancia_trabajo', 'otro') DEFAULT 'otro'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE person_documents MODIFY COLUMN category ENUM('cedula', 'recibo_servicio', 'comprobante_ingresos', 'constancia_trabajo', 'otro') DEFAULT 'otro'");
    }
};
