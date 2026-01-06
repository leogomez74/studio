<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class AnalyzeSharePoint extends Command
{
    protected $signature = 'sharepoint:analyze {--token= : Token de acceso de Microsoft Graph} {--folder-id= : ID de la carpeta específica}';
    protected $description = 'Analiza carpetas de SharePoint resolviendo el Drive ID automáticamente.';

    protected $keywords = [
        'constancia' => ['colilla', 'constancia', 'nomina', 'salario', 'boleta', 'planilla'],
        'comprobante' => ['comprobante', 'pago', 'sinpe', 'transferencia', 'voucher', 'recibo', 'deposito']
    ];

    public function handle()
    {
        $siteId = env('MICROSOFT_SITE_ID');
        $listId = env('MICROSOFT_LIST_ID');
        $accessToken = $this->option('token');

        if (!$accessToken) {
            $this->error('Por favor proporciona el token con --token="..."');
            return 1;
        }

        // 1. Resolver el Drive ID correcto
        $this->info('Resolviendo Drive ID...');
        $driveUrl = "https://graph.microsoft.com/v1.0/sites/$siteId/lists/$listId/drive";
        $driveResp = Http::withToken($accessToken)->get($driveUrl);

        if ($driveResp->failed()) {
            $this->error('No se pudo encontrar el Drive asociado a la lista: ' . $driveResp->body());
            return 1;
        }

        $driveId = $driveResp->json()['id'];
        $this->info("Drive ID resuelto: $driveId");

        // 2. Escanear
        $folderId = $this->option('folder-id');
        $url = $folderId 
            ? "https://graph.microsoft.com/v1.0/drives/$driveId/items/$folderId/children"
            : "https://graph.microsoft.com/v1.0/drives/$driveId/root/children";

        $this->info('Escaneando carpetas...');
        
        $response = Http::withToken($accessToken)->get($url);
        
        if ($response->failed()) {
            $this->error('Error leyendo carpetas: ' . $response->body());
            return 1;
        }

        $items = $response->json()['value'] ?? [];
        $mapaEmpresas = [];

        $bar = $this->output->createProgressBar(count($items));
        $bar->start();

        foreach ($items as $item) {
            if (isset($item['folder'])) {
                $nombreEmpresa = $item['name'];
                $empresaId = $item['id'];

                $mapaEmpresas[$nombreEmpresa] = [
                    'constancia' => [],
                    'comprobante' => [],
                    'otros' => []
                ];

                // Leer archivos
                $filesUrl = "https://graph.microsoft.com/v1.0/drives/$driveId/items/$empresaId/children";
                $filesResp = Http::withToken($accessToken)->get($filesUrl);

                if ($filesResp->successful()) {
                    $files = $filesResp->json()['value'] ?? [];
                    foreach ($files as $file) {
                        if (isset($file['file'])) {
                            $this->clasificarArchivo($file['name'], $mapaEmpresas[$nombreEmpresa]);
                        }
                    }
                    // Limpiar
                    foreach ($mapaEmpresas[$nombreEmpresa] as $k => $v) {
                        $mapaEmpresas[$nombreEmpresa][$k] = array_values(array_unique($v));
                    }
                }
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $this->info('Resultado:');
        $this->line(json_encode($mapaEmpresas, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
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
