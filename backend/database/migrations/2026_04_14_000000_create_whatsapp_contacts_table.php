<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evolution_instance_id')->constrained('evolution_instances')->cascadeOnDelete();
            $table->string('phone_number', 20);
            $table->string('alias', 120);
            $table->timestamps();

            $table->unique(['evolution_instance_id', 'phone_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_contacts');
    }
};
