<?php

use Illuminate\Database\Migrations\Migration;
use Database\Seeders\InvestmentSeeder;

return new class extends Migration
{
    public function up(): void
    {
        (new InvestmentSeeder)->run();
    }

    public function down(): void
    {
        // Los datos se eliminan al revertir las tablas de inversiones
    }
};
