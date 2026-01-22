<?php

declare(strict_types=1);

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
        Schema::table('credits', function (Blueprint $table): void {
            if (!Schema::hasColumn('credits', 'poliza_actual')) {
                $table->decimal('poliza_actual', 15, 2)->default(0)->after('poliza');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('credits', function (Blueprint $table): void {
            if (Schema::hasColumn('credits', 'poliza_actual')) {
                $table->dropColumn('poliza_actual');
            }
        });
    }
};
