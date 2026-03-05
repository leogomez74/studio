<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Verificar si la PK es string (migración original)
        $columns = DB::select("SHOW COLUMNS FROM investors WHERE Field = 'id'");
        $hasStringPk = !empty($columns) && str_contains($columns[0]->Type, 'varchar');

        if ($hasStringPk) {
            // Solo es seguro si la tabla está vacía
            if (DB::table('investors')->count() > 0) {
                throw new \RuntimeException(
                    'La tabla investors tiene datos con PK string. Migre los datos manualmente antes de ejecutar esta migración.'
                );
            }

            Schema::dropIfExists('investors');
            Schema::create('investors', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('cedula', 20)->nullable();
                $table->string('email')->nullable();
                $table->string('phone', 20)->nullable();
                $table->string('status')->default('Activo');
                $table->string('tipo_persona')->default('Persona Física');
                $table->text('notas')->nullable();
                $table->string('cuenta_bancaria', 50)->nullable();
                $table->string('banco', 100)->nullable();
                $table->decimal('investment_balance', 15, 2)->default(0);
                $table->date('joined_at')->nullable();
                $table->timestamps();
            });
        } else {
            // PK ya es auto-increment, solo agregar columnas faltantes
            Schema::table('investors', function (Blueprint $table) {
                if (!Schema::hasColumn('investors', 'tipo_persona')) {
                    $table->string('tipo_persona')->default('Persona Física')->after('status');
                }
                if (!Schema::hasColumn('investors', 'notas')) {
                    $table->text('notas')->nullable()->after('tipo_persona');
                }
                if (!Schema::hasColumn('investors', 'cuenta_bancaria')) {
                    $table->string('cuenta_bancaria', 50)->nullable()->after('notas');
                }
                if (!Schema::hasColumn('investors', 'banco')) {
                    $table->string('banco', 100)->nullable()->after('cuenta_bancaria');
                }
            });

            Schema::table('investors', function (Blueprint $table) {
                $table->string('cedula', 20)->nullable()->change();
                $table->string('email')->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('investors', 'tipo_persona')) {
            Schema::table('investors', function (Blueprint $table) {
                $table->dropColumn(['tipo_persona', 'notas', 'cuenta_bancaria', 'banco']);
            });
        }
    }
};
