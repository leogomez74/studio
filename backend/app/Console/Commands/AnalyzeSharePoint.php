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
    protected $signature = 'sharepoint:analyze {--token= : Token de acceso de Microsoft Graph (opcional)} {--folder-id= : ID de la carpeta específica}';

    /**
     * La descripción del comando.
     *
     * @var string
     */
    protected $description = 'Analiza carpetas de SharePoint usando un token manual o Device Flow.';

    /**
     * Palabras clave para identificar tipos de documentos.
     */
    protected $keywords = [
        'constancia' => ['colilla', 'constancia', 'nomina', 'salario', 'boleta', 'planilla'],
        'comprobante' => ['comprobante', 'pago', 'sinpe', 'transferencia', 'voucher', 'recibo', 'deposito']
    ];

    public function handle()
    {
        $driveId = env('MICROSOFT_DRIVE_ID');
        if (!$driveId) {
            $this->error('Falta MICROSOFT_DRIVE_ID en el archivo .env');
            return 1;
        }

        $accessToken = $this->option('token');

        if (!$accessToken) {
            $this->info('No se proporcionó token manual. Iniciando Device Code Flow...');
            $accessToken = $this->runDeviceFlow();
            if (!$accessToken) return 1;
        }

        $this->info('¡Token obtenido! Escaneando estructura de carpetas...');

        // 1. Determinar URL inicial
        $folderId = $this->option('folder-id');
        $url = $folderId 
            ? "https://graph.microsoft.com/v1.0/drives/{$driveId}/items/{$folderId}/children"
            : "https://graph.microsoft.com/v1.0/drives/{$driveId}/root/children";

        $foldersResponse = Http::withToken($accessToken)->get($url);
        
        if ($foldersResponse->failed()) {
            $this->error('Error al leer SharePoint: ' . $foldersResponse->body());
            $this->info('Sugerencia: Si el error es "Resource Not Found", verifica tu MICROSOFT_DRIVE_ID.');
            return 1;
        }

        $items = $foldersResponse->json()['value'] ?? [];
        $mapaEmpresas = [];

        if (empty($items)) {
            $this->warn('No se encontraron carpetas o archivos en la ubicación especificada.');
            return 0;
        }

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

                $filesUrl = "https://graph.microsoft.com/v1.0/drives/{$driveId}/items/{$empresaId}/children";
                $filesResponse = Http::withToken($accessToken)->get($filesUrl);

                if ($filesResponse->successful()) {
                    $files = $filesResponse->json()['value'] ?? [];
                    foreach ($files as $file) {
                        if (isset($file['file'])) {
                            $this->clasificarArchivo($file['name'], $mapaEmpresas[$nombreEmpresa]);
                        }
                    }
                    
                    $mapaEmpresas[$nombreEmpresa]['constancia'] = array_values(array_unique($mapaEmpresas[$nombreEmpresa]['constancia']));
                    $mapaEmpresas[$nombreEmpresa]['comprobante'] = array_values(array_unique($mapaEmpresas[$nombreEmpresa]['comprobante']));
                    $mapaEmpresas[$nombreEmpresa]['otros'] = array_values(array_unique($mapaEmpresas[$nombreEmpresa]['otros']));
                }
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $jsonResult = json_encode($mapaEmpresas, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        $this->info('Análisis completado. Resultado:');
        $this->line($jsonResult);
    }

    private function runDeviceFlow()
    {
        $tenantId = env('MICROSOFT_TENANT_ID');
        $clientId = env('MICROSOFT_CLIENT_ID');

        $deviceCodeResponse = Http::asForm()->post("https://login.microsoftonline.com/{$tenantId}/oauth2/v2.0/devicecode", [
            'client_id' => $clientId,
            'scope' => 'Files.Read.All Sites.Read.All User.Read offline_access'
        ]);

        if ($deviceCodeResponse->failed()) {
            $this->error('Error iniciando device flow: ' . $deviceCodeResponse->body());
            return null;
        }

        $deviceData = $deviceCodeResponse->json();
        $this->info("Abre: {$deviceData['verification_uri']}");
        $this->info("Ingresa el código: {$deviceData['user_code']}");

        while (true) {
            sleep($deviceData['interval'] ?? 5);
            $tokenResponse = Http::asForm()->post("https://login.microsoftonline.com/{$tenantId}/oauth2/v2.0/token", [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:device_code',
                'client_id' => $clientId,
                'device_code' => $deviceData['device_code'],
            ]);

            if ($tokenResponse->successful()) return $tokenResponse->json()['access_token'];
            if ($tokenResponse->json()['error'] !== 'authorization_pending') {
                $this->error('Error: ' . $tokenResponse->json()['error']);
                return null;
            }
            $this->output->write('.');
        }
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
