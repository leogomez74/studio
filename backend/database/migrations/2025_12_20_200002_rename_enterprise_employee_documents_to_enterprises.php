<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::rename('enterprise_employee_documents', 'enterprises');
    }

    public function down(): void
    {
        Schema::rename('enterprises', 'enterprise_employee_documents');
    }
};
