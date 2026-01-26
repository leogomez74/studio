<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class AnalyzeSharePoint extends Command
{
    protected $signature = 'sharepoint:analyze {--token= : Token de acceso} {--drive-id=3c12fb8d-2541-4ad7-bbcc-cb210ac338a5 : El ID del Drive}';
    protected $description = 'Analiza el Drive específico usando el ID proporcionado.';

    protected $keywords = [
        'constancia' => ['colilla', 'constancia', 'nomina', 'salario', 'boleta', 'planilla'],
        'comprobante' => ['comprobante', 'pago', 'sinpe', 'transferencia', 'voucher', 'recibo', 'deposito']
    ];

    public function handle()
    {
        $accessToken = $this->option('token');
        // Usamos el ID que sacaste del F12 por defecto
        $rawDriveId = $this->option('drive-id'); 

        if (!$accessToken) {
            $this->error('Falta el token: --token="..."');
            return 1;
        }

        $this->info("Usando Drive ID: $rawDriveId");

        // Intentar leer la raíz directamente
        // Probamos primero como Drive, luego como Site/List si falla
        
        $url = "https://graph.microsoft.com/v1.0/drives/$rawDriveId/root/children";
        $this->info("Probando acceso directo: GET /drives/$rawDriveId/root/children");

        $response = Http::withToken($accessToken)->get($url);

        if ($response->failed()) {
            // Si falla, es probable que el ID sea de una Lista y no de un Drive.
            // Intentaremos acceder vía Site/List si tenemos esos datos, 
            // PERO primero probemos si es el formato de ID el problema.
            
            $this->warn('Acceso directo falló: ' . $response->json()['error']['code']);
            
            // Intento 2: Buscar la carpeta "documentos Made (PEP)" usando búsqueda global en el Drive
            // A veces el ID raíz falla pero la búsqueda funciona
            $this->info('Intentando búsqueda de carpeta "documentos Made (PEP)"...');
            
            $searchUrl = "https://graph.microsoft.com/v1.0/drives/$rawDriveId/root/search(q='documentos Made')";
            $searchResp = Http::withToken($accessToken)->get($searchUrl);
            
            if ($searchResp->successful()) {
                $found = $searchResp->json()['value'][0] ?? null;
                if ($found) {
                    $this->info('¡Carpeta encontrada! ID: ' . $found['id']);
                    // Usar ese ID para listar hijos
                    $url = "https://graph.microsoft.com/v1.0/drives/$rawDriveId/items/" . $found['id'] . "/children";
                    $response = Http::withToken($accessToken)->get($url);
                } else {
                    $this->error('No se encontró la carpeta.');
                    return 1;
                }
            } else {
                $this->error('Búsqueda falló también: ' . $searchResp->body());
                return 1;
            }
        }

        if ($response->failed()) {
             $this->error('Imposible acceder. El ID o el Token no son válidos para esta operación.');
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

                $filesUrl = "https://graph.microsoft.com/v1.0/drives/$rawDriveId/items/$empresaId/children";
                $filesResp = Http::withToken($accessToken)->get($filesUrl);

                if ($filesResp->successful()) {
                    $files = $filesResp->json()['value'] ?? [];
                    foreach ($files as $file) {
                        if (isset($file['file'])) {
                            $this->clasificarArchivo($file['name'], $mapaEmpresas[$nombreEmpresa]);
                        }
                    }
                    foreach ($mapaEmpresas[$nombreEmpresa] as $k => $v) {
                        $mapaEmpresas[$nombreEmpresa][$k] = array_values(array_unique($v));
                    }
                }
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
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