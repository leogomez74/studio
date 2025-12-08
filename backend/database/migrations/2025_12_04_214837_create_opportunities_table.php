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
        Schema::create('opportunities', function (Blueprint $table) {
            $table->string('id')->primary(); // Custom String ID (e.g., 25-00004-OP)

            // Relationship to Lead/Client via Cedula (as requested)
            $table->string('lead_cedula', 20)->index();

            // Opportunity Details
            $table->string('opportunity_type')->nullable();
            $table->string('vertical')->nullable();
            $table->decimal('amount', 15, 2)->nullable();
            $table->string('status')->default('Abierta');
            $table->date('expected_close_date')->nullable();
            $table->text('comments')->nullable();

            // Assignment
            $table->foreignId('assigned_to_id')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            // Optional: Foreign key constraint if persons.cedula is unique and indexed
            // $table->foreign('lead_cedula')->references('cedula')->on('persons');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('opportunities');
    }
};
