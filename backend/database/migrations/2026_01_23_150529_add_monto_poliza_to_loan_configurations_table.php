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
        Schema::table('loan_configurations', function (Blueprint $table) {
            $table->decimal('monto_poliza', 12, 2)->default(0)->after('plazo_maximo');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('loan_configurations', function (Blueprint $table) {
            $table->dropColumn('monto_poliza');
        });
    }
};
