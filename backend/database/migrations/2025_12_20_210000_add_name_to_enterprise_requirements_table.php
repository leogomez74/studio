<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('enterprises_requirements', function (Blueprint $table) {
            $table->string('name')->after('enterprise_id');
        });
    }

    public function down(): void
    {
        Schema::table('enterprises_requirements', function (Blueprint $table) {
            $table->dropColumn('name');
        });
    }
};
