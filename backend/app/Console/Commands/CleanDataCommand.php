<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CleanDataCommand extends Command
{
    protected $signature = 'db:clean-data {--force : Forzar limpieza sin confirmación}';
    protected $description = 'Limpiar tablas de datos (persons, opportunities, analisis, credits) manteniendo configuraciones';

    public function handle()
    {
        if (!$this->option('force') && !$this->confirm('⚠️  Esto eliminará todos los registros de: persons, opportunities, analisis, credits, plan_de_pagos, credit_payments. ¿Continuar?')) {
            $this->info('❌ Operación cancelada');
            return 0;
        }

        $this->info('🧹 Limpiando base de datos...');

        // Deshabilitar checks de foreign key temporalmente
        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        try {
            // Orden importante: eliminar primero las tablas dependientes
            $tablesToClean = [
                'credit_payments',
                'plan_de_pagos',
                'credit_documents',
                'credits',
                'analisis',
                'opportunities',
                'person_documents',
                'persons',
                'lead_alerts',
            ];

            foreach ($tablesToClean as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->truncate();
                    $this->info("✅ Limpiada: {$table}");
                } else {
                    $this->warn("⚠️  Tabla no existe: {$table}");
                }
            }

            $this->newLine();
            $this->info('✅ Base de datos limpiada exitosamente');
            $this->info('💡 Las configuraciones, usuarios, tasas y deductoras se mantuvieron intactas');

        } catch (\Exception $e) {
            $this->error('❌ Error: ' . $e->getMessage());
            return 1;
        } finally {
            // Re-habilitar checks de foreign key
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }

        return 0;
    }
}
