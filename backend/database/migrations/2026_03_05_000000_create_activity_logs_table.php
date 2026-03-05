<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('user_name', 150)->nullable();
            $table->string('action', 30);                   // create|update|delete|login|logout|export|upload|restore
            $table->string('module', 60);                   // Leads, Clientes, Creditos, etc.
            $table->string('model_type', 100)->nullable();  // App\Models\Lead
            $table->string('model_id', 50)->nullable();     // ID del registro
            $table->string('model_label', 200)->nullable(); // Referencia legible: "26-00001-01-CRED"
            $table->json('changes')->nullable();             // [{field, old_value, new_value}]
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 300)->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->index('user_id');
            $table->index('action');
            $table->index('module');
            $table->index(['model_type', 'model_id']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
