<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('external_integrations', function (Blueprint $table) {
            $table->string('base_url')->nullable()->default(null)->change();
            $table->string('auth_type')->nullable()->default('bearer')->change();
        });
    }

    public function down(): void
    {
        Schema::table('external_integrations', function (Blueprint $table) {
            $table->string('base_url')->nullable(false)->change();
            $table->string('auth_type')->nullable(false)->default('bearer')->change();
        });
    }
};
