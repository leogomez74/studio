<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class AnalyzeSharePoint extends Command
{
    protected $signature = 'sharepoint:analyze {--token= : Token del dueño (Owner)} {--folder= : Nombre de la carpeta a buscar (opcional)}';
    protected $description = 'Analiza el Drive del dueño del token automáticamente.';

    protected $keywords = [
        'constancia' => ['colilla', 'constancia', 'nomina', 'salario', 'boleta', 'planilla'],
        'comprobante' => ['comprobante', 'pago', 'sinpe', 'transferencia', 'voucher', 'recibo', 'deposito']
    ];

    public function handle()
    {
        $accessToken = $this->option('token');
        $targetFolder = $this->option('folder'); // Ej: "documentos Made (PEP)"

        if (!$accessToken) {
            $this->error('Necesitas el token del dueño: php artisan sharepoint:analyze --token="..."');
            return 1;
        }

        $this->info('1. Obteniendo información del Drive del usuario...');
        
        // Pedir el Drive por defecto del usuario dueño del token
        $meDriveResponse = Http::withToken($accessToken)->get('https://graph.microsoft.com/v1.0/me/drive');

        if ($meDriveResponse->failed()) {
            $this->error('Error al obtener el Drive: ' . $meDriveResponse->body());
            return 1;
        }

        $driveId = $meDriveResponse->json()['id'];
        $this->info("   > Drive ID encontrado: $driveId");

        // 2. Localizar la carpeta objetivo (si se especificó) o usar la raíz
        $rootUrl = "https://graph.microsoft.com/v1.0/drives/$driveId/root";
        
        if ($targetFolder) {
            $this->info("2. Buscando carpeta: '$targetFolder'...");
            // Buscar la carpeta específica en la raíz
            $searchUrl = "https://graph.microsoft.com/v1.0/drives/$driveId/root/children?\$filter=name eq '$targetFolder'";
            $searchRes = Http::withToken($accessToken)->get($searchUrl);
            
            $found = $searchRes->json()['value'][0] ?? null;
            
            if (!$found) {
                $this->error("   > No se encontró la carpeta '$targetFolder' en la raíz.");
                return 1;
            }
            
            $rootUrl = "https://graph.microsoft.com/v1.0/drives/$driveId/items/" . $found['id'];
            $this->info("   > Carpeta encontrada. ID: " . $found['id']);
        } else {
            $this->info("2. Usando la raíz del Drive.");
        }

        // 3. Escanear contenido
        $this->info('3. Escaneando empresas...');
        $childrenUrl = "$rootUrl/children";
        $response = Http::withToken($accessToken)->get($childrenUrl);

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

                // Leer archivos dentro de la empresa
                $filesUrl = "https://graph.microsoft.com/v1.0/drives/$driveId/items/$empresaId/children";
                $filesResp = Http::withToken($accessToken)->get($filesUrl);

                if ($filesResp->successful()) {
                    $files = $filesResp->json()['value'] ?? [];
                    foreach ($files as $file) {
                        if (isset($file['file'])) {
                            $this->clasificarArchivo($file['name'], $mapaEmpresas[$nombreEmpresa]);
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

        $this->info('Resultados:');
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
