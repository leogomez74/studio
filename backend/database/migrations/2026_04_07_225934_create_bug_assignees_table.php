<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('bug_assignees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bug_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->unique(['bug_id', 'user_id']);
            $table->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('bug_assignees');
    }
};
