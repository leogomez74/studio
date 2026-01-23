<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\PersonDocument;
use App\Models\Opportunity;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class MigrateOldFileStructure extends Command
{
    protected $signature = 'files:migrate-structure {--dry-run : Simular la migración sin hacer cambios}';
    protected $description = 'Migrar archivos de la estructura antigua (leads/) a la nueva (documentos/)';

    public function handle()
    {
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('⚠️  MODO SIMULACIÓN - No se harán cambios reales');
        }

        $this->info('Iniciando migración de estructura de archivos...');
        $this->newLine();

        // Buscar todos los documentos con rutas antiguas
        $oldDocuments = PersonDocument::where('path', 'like', 'leads/%')->get();

        if ($oldDocuments->isEmpty()) {
            $this->info('✓ No hay archivos en la estructura antigua. Todo está actualizado.');
            return 0;
        }

        $this->info("Encontrados {$oldDocuments->count()} documentos en estructura antigua");
        $this->newLine();

        $migrated = 0;
        $errors = 0;
        $skipped = 0;

        $bar = $this->output->createProgressBar($oldDocuments->count());
        $bar->start();

        foreach ($oldDocuments as $doc) {
            $result = $this->migrateDocument($doc, $dryRun);

            if ($result['status'] === 'success') {
                $migrated++;
            } elseif ($result['status'] === 'skipped') {
                $skipped++;
                if (!$dryRun) {
                    $this->warn("  Omitido: {$doc->path} - {$result['message']}");
                }
            } else {
                $errors++;
                $this->error("  Error en {$doc->path}: {$result['message']}");
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        // Resumen
        $this->info('📊 Resumen de migración:');
        $this->table(
            ['Estado', 'Cantidad'],
            [
                ['✓ Migrados', $migrated],
                ['○ Omitidos', $skipped],
                ['✗ Errores', $errors],
                ['Total', $oldDocuments->count()],
            ]
        );

        if ($dryRun) {
            $this->newLine();
            $this->warn('💡 Esta fue una simulación. Ejecuta sin --dry-run para aplicar los cambios.');
        }

        return 0;
    }

    private function migrateDocument(PersonDocument $doc, bool $dryRun): array
    {
        try {
            // Extraer cédula del path antiguo (leads/{cedula}/archivo.ext)
            $pathParts = explode('/', $doc->path);
            if (count($pathParts) < 3 || $pathParts[0] !== 'leads') {
                return [
                    'status' => 'skipped',
                    'message' => "Path no coincide: {$doc->path}"
                ];
            }

            $cedula = $pathParts[1];
            $fileName = $pathParts[2];

            // Limpiar cédula (remover guiones)
            $strippedCedula = preg_replace('/[^0-9]/', '', $cedula);

            // Debug: mostrar información del path
            $fullPath = Storage::disk('public')->path($doc->path);

            // Verificar que el archivo existe físicamente
            if (!Storage::disk('public')->exists($doc->path)) {
                Log::warning('Archivo físico no existe', [
                    'path' => $doc->path,
                    'full_path' => $fullPath,
                    'exists' => file_exists($fullPath)
                ]);
                return [
                    'status' => 'skipped',
                    'message' => "Archivo no existe: {$fullPath}"
                ];
            }

            // Nueva ruta
            $newPath = "documentos/{$strippedCedula}/buzon/{$fileName}";

            // Si ya existe en la nueva ubicación, omitir
            if (Storage::disk('public')->exists($newPath)) {
                if (!$dryRun) {
                    // Actualizar solo el registro en BD
                    $doc->update(['path' => $newPath]);
                }
                return [
                    'status' => 'success',
                    'message' => 'Archivo ya existe en nueva ubicación, BD actualizada'
                ];
            }

            if (!$dryRun) {
                // Crear carpeta si no existe
                $targetFolder = "documentos/{$strippedCedula}/buzon";
                if (!Storage::disk('public')->exists($targetFolder)) {
                    Storage::disk('public')->makeDirectory($targetFolder);
                }

                // Mover archivo
                Storage::disk('public')->move($doc->path, $newPath);

                // Actualizar registro en BD
                $doc->update([
                    'path' => $newPath,
                    'url' => asset(Storage::url($newPath)),
                ]);

                // Sincronizar a oportunidades existentes del lead
                if ($doc->person) {
                    $this->syncToOpportunities($doc->person->cedula, $strippedCedula, $newPath, $fileName);
                }

                Log::info('Archivo migrado', [
                    'from' => $doc->path,
                    'to' => $newPath,
                    'person_id' => $doc->person_id
                ]);
            }

            return [
                'status' => 'success',
                'message' => 'Archivo migrado correctamente'
            ];

        } catch (\Exception $e) {
            Log::error('Error migrando documento', [
                'document_id' => $doc->id,
                'path' => $doc->path,
                'error' => $e->getMessage()
            ]);

            return [
                'status' => 'error',
                'message' => $e->getMessage()
            ];
        }
    }

    private function syncToOpportunities(string $cedula, string $strippedCedula, string $filePath, string $fileName): void
    {
        // Buscar oportunidades del lead
        $opportunities = Opportunity::where('lead_cedula', $cedula)
            ->orWhere('lead_cedula', $strippedCedula)
            ->get();

        foreach ($opportunities as $opportunity) {
            $targetFolder = "documentos/{$strippedCedula}/{$opportunity->id}/heredados";
            $targetPath = "{$targetFolder}/{$fileName}";

            try {
                // Crear carpeta si no existe
                if (!Storage::disk('public')->exists($targetFolder)) {
                    Storage::disk('public')->makeDirectory($targetFolder);
                }

                // Si ya existe, omitir
                if (Storage::disk('public')->exists($targetPath)) {
                    continue;
                }

                // Copiar archivo a la oportunidad
                Storage::disk('public')->copy($filePath, $targetPath);

                Log::info('Archivo sincronizado a oportunidad durante migración', [
                    'opportunity_id' => $opportunity->id,
                    'file' => $fileName
                ]);
            } catch (\Exception $e) {
                Log::error('Error sincronizando durante migración', [
                    'opportunity_id' => $opportunity->id,
                    'error' => $e->getMessage()
                ]);
            }
        }
    }
}
