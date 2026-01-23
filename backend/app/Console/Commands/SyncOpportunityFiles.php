<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Opportunity;
use App\Models\Person;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class SyncOpportunityFiles extends Command
{
    protected $signature = 'opportunities:sync-files {--opportunity=}';
    protected $description = 'Sincronizar archivos del buzón del lead a las oportunidades';

    public function handle()
    {
        $this->info('Sincronizando archivos de leads a oportunidades...');

        // Si se especifica una oportunidad específica
        if ($opportunityId = $this->option('opportunity')) {
            $opportunities = Opportunity::where('id', $opportunityId)->get();
            if ($opportunities->isEmpty()) {
                $this->error("Oportunidad {$opportunityId} no encontrada");
                return 1;
            }
        } else {
            // Sincronizar todas las oportunidades
            $opportunities = Opportunity::all();
        }

        $this->info("Procesando {$opportunities->count()} oportunidades...");

        $synced = 0;
        $skipped = 0;
        $errors = 0;

        foreach ($opportunities as $opportunity) {
            $result = $this->syncFilesForOpportunity($opportunity);

            if ($result['status'] === 'success') {
                $synced++;
                $this->line("✓ {$opportunity->id}: {$result['files_count']} archivos copiados");
            } elseif ($result['status'] === 'skipped') {
                $skipped++;
                $this->line("○ {$opportunity->id}: {$result['message']}");
            } else {
                $errors++;
                $this->warn("✗ {$opportunity->id}: {$result['message']}");
            }
        }

        $this->newLine();
        $this->info("✅ Sincronización completa:");
        $this->info("  - {$synced} oportunidades sincronizadas");
        $this->info("  - {$skipped} oportunidades omitidas");
        $this->info("  - {$errors} errores");

        return 0;
    }

    private function syncFilesForOpportunity(Opportunity $opportunity): array
    {
        if (empty($opportunity->lead_cedula)) {
            return [
                'status' => 'skipped',
                'message' => 'Sin cédula asociada',
                'files_count' => 0
            ];
        }

        // Buscar la persona por cédula
        $person = Person::where('cedula', $opportunity->lead_cedula)->first();

        if (!$person) {
            return [
                'status' => 'skipped',
                'message' => 'Lead no encontrado',
                'files_count' => 0
            ];
        }

        $personDocuments = $person->documents;

        if ($personDocuments->isEmpty()) {
            return [
                'status' => 'skipped',
                'message' => 'Sin documentos en el buzón',
                'files_count' => 0
            ];
        }

        // Limpiar cédula para el nombre de la carpeta
        $cedulaLimpia = $this->cleanCedula($opportunity->lead_cedula);
        $heredadosFolder = "documentos/{$cedulaLimpia}/{$opportunity->id}/heredados";
        $copiedFiles = 0;

        try {
            // Crear carpeta si no existe
            if (!Storage::disk('public')->exists($heredadosFolder)) {
                Storage::disk('public')->makeDirectory($heredadosFolder);
            }

            foreach ($personDocuments as $doc) {
                // Verificar si el archivo físico existe
                if (!Storage::disk('public')->exists($doc->path)) {
                    Log::warning('Archivo físico no encontrado', [
                        'opportunity' => $opportunity->id,
                        'path' => $doc->path
                    ]);
                    continue;
                }

                $fileName = basename($doc->path);
                $newPath = "{$heredadosFolder}/{$fileName}";

                // Si el archivo ya existe en la oportunidad, omitirlo
                if (Storage::disk('public')->exists($newPath)) {
                    continue;
                }

                // Copiar archivo
                try {
                    Storage::disk('public')->copy($doc->path, $newPath);
                    $copiedFiles++;

                    Log::info('Archivo sincronizado', [
                        'opportunity' => $opportunity->id,
                        'from' => $doc->path,
                        'to' => $newPath
                    ]);
                } catch (\Exception $e) {
                    Log::error('Error copiando archivo', [
                        'opportunity' => $opportunity->id,
                        'file' => $doc->path,
                        'error' => $e->getMessage()
                    ]);
                }
            }

            return [
                'status' => 'success',
                'message' => 'Archivos copiados correctamente',
                'files_count' => $copiedFiles
            ];
        } catch (\Exception $e) {
            Log::error('Error sincronizando archivos de oportunidad', [
                'opportunity' => $opportunity->id,
                'error' => $e->getMessage()
            ]);

            return [
                'status' => 'error',
                'message' => $e->getMessage(),
                'files_count' => 0
            ];
        }
    }

    private function cleanCedula(string $cedula): string
    {
        return preg_replace('/[^0-9]/', '', $cedula);
    }
}
