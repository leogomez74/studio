<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marketing_costs', function (Blueprint $table) {
            $table->id();
            // Mes contable (siempre día 1 del mes) — un registro por canal por mes.
            $table->date('period_month');
            // Canal (Facebook Ads, Google Ads, Referencias, Volante, etc.) — texto libre.
            $table->string('channel');
            $table->decimal('amount', 15, 2)->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['period_month', 'channel']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_costs');
    }
};
