<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('investors', 'investment_balance')) {
            Schema::table('investors', function (Blueprint $table) {
                $table->dropColumn('investment_balance');
            });
        }
    }

    public function down(): void
    {
        Schema::table('investors', function (Blueprint $table) {
            $table->decimal('investment_balance', 15, 2)->default(0);
        });
    }
};
