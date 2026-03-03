<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE accounting_entry_lines MODIFY COLUMN account_type ENUM('fixed','deductora','deductora_or_fixed') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE accounting_entry_lines MODIFY COLUMN account_type ENUM('fixed','deductora') NOT NULL");
    }
};
