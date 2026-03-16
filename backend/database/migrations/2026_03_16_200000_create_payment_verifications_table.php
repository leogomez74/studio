<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('credit_id')->constrained('credits')->cascadeOnDelete();
            $table->foreignId('requested_by')->constrained('users');
            $table->foreignId('assigned_to')->constrained('users');
            $table->string('payment_type'); // normal, adelanto, extraordinario, cancelacion_anticipada
            $table->json('payment_data');   // {monto, fecha, referencia, strategy, cuotas, etc.}
            $table->string('status')->default('pending'); // pending, approved, rejected, applied, cancelled
            $table->timestamp('verified_at')->nullable();
            $table->text('verification_notes')->nullable();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->timestamps();

            $table->index(['requested_by', 'status']);
            $table->index(['assigned_to', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_verifications');
    }
};
