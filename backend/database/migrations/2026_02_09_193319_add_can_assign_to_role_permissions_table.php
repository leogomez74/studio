<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('role_permissions', function (Blueprint $table) {
            $table->boolean('can_assign')->default(false)->after('can_archive');
        });

        // Dar permiso can_assign al módulo analizados para roles que ya tienen can_edit
        DB::table('role_permissions')
            ->where('module_key', 'analizados')
            ->where('can_edit', true)
            ->update(['can_assign' => true]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('role_permissions', function (Blueprint $table) {
            $table->dropColumn('can_assign');
        });
    }
};
