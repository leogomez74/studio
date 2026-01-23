<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\PersonDocument;
use Illuminate\Support\Facades\Storage;

class DiagnoseFileStructure extends Command
{
    protected $signature = 'files:diagnose';
    protected $description = 'Diagnosticar el estado de los archivos en el servidor';

    public function handle()
    {
        $this->info('🔍 Diagnóstico de estructura de archivos');
        $this->newLine();

        // 1. Verificar configuración de Storage
        $this->info('1. Configuración de Storage:');
        $storagePath = Storage::disk('public')->path('');
        $this->line("   Path base: {$storagePath}");
        $this->line("   Existe: " . (is_dir($storagePath) ? '✓ Sí' : '✗ No'));
        $this->line("   Permisos: " . substr(sprintf('%o', fileperms($storagePath)), -4));
        $this->newLine();

        // 2. Verificar documentos en BD
        $this->info('2. Documentos en base de datos:');
        $oldDocs = PersonDocument::where('path', 'like', 'leads/%')->count();
        $newDocs = PersonDocument::where('path', 'like', 'documentos/%')->count();
        $this->line("   Estructura antigua (leads/): {$oldDocs}");
        $this->line("   Estructura nueva (documentos/): {$newDocs}");
        $this->newLine();

        // 3. Verificar archivos físicos
        $this->info('3. Muestra de archivos (primeros 5):');
        $sampleDocs = PersonDocument::where('path', 'like', 'leads/%')->take(5)->get();

        foreach ($sampleDocs as $doc) {
            $fullPath = Storage::disk('public')->path($doc->path);
            $exists = file_exists($fullPath);
            $storageExists = Storage::disk('public')->exists($doc->path);

            $this->line("   Path BD: {$doc->path}");
            $this->line("   Path completo: {$fullPath}");
            $this->line("   file_exists(): " . ($exists ? '✓' : '✗'));
            $this->line("   Storage::exists(): " . ($storageExists ? '✓' : '✗'));

            if ($exists) {
                $this->line("   Tamaño: " . filesize($fullPath) . " bytes");
            }
            $this->newLine();
        }

        // 4. Verificar estructura de carpetas
        $this->info('4. Estructura de carpetas:');
        $leadsFolder = Storage::disk('public')->path('leads');
        $documentosFolder = Storage::disk('public')->path('documentos');

        $this->line("   Carpeta 'leads': " . (is_dir($leadsFolder) ? '✓ Existe' : '✗ No existe'));
        if (is_dir($leadsFolder)) {
            $leadCount = count(glob($leadsFolder . '/*', GLOB_ONLYDIR));
            $this->line("   Subcarpetas en 'leads': {$leadCount}");
        }

        $this->line("   Carpeta 'documentos': " . (is_dir($documentosFolder) ? '✓ Existe' : '✗ No existe'));
        if (is_dir($documentosFolder)) {
            $docCount = count(glob($documentosFolder . '/*', GLOB_ONLYDIR));
            $this->line("   Subcarpetas en 'documentos': {$docCount}");
        }

        $this->newLine();
        $this->info('✅ Diagnóstico completado');

        return 0;
    }
}
