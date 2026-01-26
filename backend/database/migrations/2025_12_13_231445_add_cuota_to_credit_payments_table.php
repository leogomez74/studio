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
        Schema::table('credit_payments', function (Blueprint $table) {
            if (! Schema::hasColumn('credit_payments', 'monto')) {
                $table->decimal('monto', 15, 2)->nullable()->after('cuota');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('credit_payments', function (Blueprint $table) {
            if (Schema::hasColumn('credit_payments', 'monto')) {
                $table->dropColumn('monto');
            }
        });
    }
};
