<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class AnalyzeSharePoint extends Command
{
    /**
     * El nombre y la firma del comando de consola.
     *
     * @var string
     */
    protected $signature = 'sharepoint:analyze {--token= : Token de acceso de Microsoft Graph} {--folder-id= : ID de la carpeta específica}';

    /**
     * La descripción del comando.
     *
     * @var string
     */
    protected $description = 'Analiza carpetas de SharePoint usando SiteId + ListId para mayor compatibilidad.';

    /**
     * Palabras clave para identificar tipos de documentos.
     */
    protected $keywords = [
        'constancia' => ['colilla', 'constancia', 'nomina', 'salario', 'boleta', 'planilla'],
        'comprobante' => ['comprobante', 'pago', 'sinpe', 'transferencia', 'voucher', 'recibo', 'deposito']
    ];

    public function handle()
    {
        // IDs extraídos del F12 o Graph Explorer (GUIDs puros)
        $siteId = env('MICROSOFT_SITE_ID');
        $listId = env('MICROSOFT_LIST_ID');
        $accessToken = $this->option('token');

        if (!$siteId || !$listId || !$accessToken) {
            $this->error('Error de configuración:');
            $this->line('- Asegúrate de tener MICROSOFT_SITE_ID y MICROSOFT_LIST_ID en tu archivo .env');
            $this->line('- Ejecuta el comando con --token="TU_TOKEN_DE_GRAPH_EXPLORER"');
            return 1;
        }

        $this->info("Conectando a SharePoint...");
        $this->info("Site ID: $siteId");
        $this->info("List ID: $listId");

        // 1. Construir URL base usando la API de Listas (Acepta GUIDs directos)
        // Documentación: GET /sites/{site-id}/lists/{list-id}/items/{item-id}/children
        
        $folderId = $this->option('folder-id');
        
        // Si no hay folder ID, usamos 'root' para la raíz de la lista
        $endpoint = $folderId 
            ? "/items/$folderId/children" 
            : "/items/root/children";

        $url = "https://graph.microsoft.com/v1.0/sites/$siteId/lists/$listId" . $endpoint;

        // Importante: $expand=driveItem nos da acceso a si es folder o file y sus propiedades
        $response = Http::withToken($accessToken)->get($url . '?$expand=driveItem');
        
        if ($response->failed()) {
            $this->error('Fallo al leer la lista: ' . $response->body());
            return 1;
        }

        $items = $response->json()['value'] ?? [];
        $mapaEmpresas = [];

        if (empty($items)) {
            $this->warn('La carpeta está vacía o no se encontraron ítems.');
            return 0;
        }

        $bar = $this->output->createProgressBar(count($items));
        $bar->start();

        foreach ($items as $item) {
            // Detectar si es carpeta
            // En listas, el contentType suele indicar "Folder" o existe la propiedad driveItem->folder
            $isFolder = isset($item['driveItem']['folder']) || 
                        (isset($item['contentType']['name']) && $item['contentType']['name'] === 'Folder');

            if ($isFolder) {
                // El nombre real suele estar en 'fields->LinkTitle' o 'driveItem->name'
                $nombreEmpresa = $item['driveItem']['name'] ?? $item['fields']['LinkTitle'] ?? 'SinNombre';
                $empresaItemId = $item['id']; // ID del ítem en la lista

                $mapaEmpresas[$nombreEmpresa] = [
                    'constancia' => [],
                    'comprobante' => [],
                    'otros' => []
                ];

                // 2. Leer contenido de la subcarpeta (Empresa)
                $subUrl = "https://graph.microsoft.com/v1.0/sites/$siteId/lists/$listId/items/$empresaItemId/children?\$expand=driveItem";
                $subResponse = Http::withToken($accessToken)->get($subUrl);

                if ($subResponse->successful()) {
                    $files = $subResponse->json()['value'] ?? [];
                    
                    foreach ($files as $file) {
                        // Verificar si es archivo
                        if (isset($file['driveItem']['file'])) {
                            $fileName = $file['driveItem']['name'];
                            $this->clasificarArchivo($fileName, $mapaEmpresas[$nombreEmpresa]);
                        }
                    }
                    
                    // Limpiar duplicados
                    foreach ($mapaEmpresas[$nombreEmpresa] as $k => $v) {
                        $mapaEmpresas[$nombreEmpresa][$k] = array_values(array_unique($v));
                    }
                }
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $jsonResult = json_encode($mapaEmpresas, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        $this->info('Análisis completado:');
        $this->line($jsonResult);
    }

    private function clasificarArchivo($nombre, &$bucket)
    {
        $nombreLower = Str::lower($nombre);
        $extension = pathinfo($nombre, PATHINFO_EXTENSION);
        
        if (empty($extension)) return;

        foreach ($this->keywords as $tipo => $palabras) {
            foreach ($palabras as $palabra) {
                if (str_contains($nombreLower, $palabra)) {
                    $bucket[$tipo][] = $extension;
                    return;
                }
            }
        }
        $bucket['otros'][] = $extension;
    }
}