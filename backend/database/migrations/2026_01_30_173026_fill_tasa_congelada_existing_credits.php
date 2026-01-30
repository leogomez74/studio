<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('credits')
            ->whereNull('tasa_anual')
            ->orWhereNull('tasa_maxima')
            ->update([
                'tasa_anual' => 54.00,
                'tasa_maxima' => 54.00,
            ]);
    }

    public function down(): void
    {
        // No revertir
    }
};
