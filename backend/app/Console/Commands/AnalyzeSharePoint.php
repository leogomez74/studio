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
    protected $signature = 'sharepoint:analyze {--folder-id= : (Opcional) ID de la carpeta específica a analizar. Si no se da, usa la raíz del Drive}';

    /**
     * La descripción del comando.
     *
     * @var string
     */
    protected $description = 'Analiza carpetas de SharePoint para generar un perfil de archivos por empresa usando Device Code Flow.';

    /**
     * Palabras clave para identificar tipos de documentos.
     */
    protected $keywords = [
        'constancia' => ['colilla', 'constancia', 'nomina', 'salario', 'boleta', 'planilla'],
        'comprobante' => ['comprobante', 'pago', 'sinpe', 'transferencia', 'voucher', 'recibo', 'deposito']
    ];

    /**
     * Ejecuta el comando.
     */
    public function handle()
    {
        $tenantId = env('MICROSOFT_TENANT_ID');
        $clientId = env('MICROSOFT_CLIENT_ID');
        $driveId = env('MICROSOFT_DRIVE_ID');

        if (!$tenantId || !$clientId || !$driveId) {
            $this->error('Faltan credenciales de Microsoft en el archivo .env (TENANT_ID, CLIENT_ID, DRIVE_ID)');
            return 1;
        }

        $this->info('Iniciando autenticación (Device Code Flow)...');

        // 1. Solicitar código de dispositivo
        // Scope para permisos delegados (actuar como tu usuario)
        $scopes = 'Files.Read.All Sites.Read.All User.Read offline_access';
        
        $deviceCodeResponse = Http::asForm()->post("https://login.microsoftonline.com/{$tenantId}/oauth2/v2.0/devicecode", [
            'client_id' => $clientId,
            'scope' => $scopes
        ]);

        if ($deviceCodeResponse->failed()) {
            $this->error('Error iniciando device flow: ' . $deviceCodeResponse->body());
            $this->newLine();
            $this->warn('IMPORTANTE: Asegúrate de haber habilitado "Allow public client flows" en Azure Portal > Authentication > Advanced settings.');
            return 1;
        }

        $deviceData = $deviceCodeResponse->json();
        $userCode = $deviceData['user_code'];
        $verificationUrl = $deviceData['verification_uri'];
        $deviceCode = $deviceData['device_code'];
        $interval = $deviceData['interval'] ?? 5; // Tiempo de espera entre intentos

        $this->newLine();
        $this->info("************************************************************");
        $this->info("*  ACCIÓN REQUERIDA:                                       *");
        $this->info("*  1. Abre este link en tu navegador: $verificationUrl *");
        $this->info("*  2. Ingresa este código: $userCode                       *");
        $this->info("************************************************************");
        $this->newLine();
        $this->info("Esperando a que inicies sesión en el navegador...");

        // 2. Polling para obtener el token
        $accessToken = null;
        
        while (true) {
            sleep($interval);

            $tokenResponse = Http::asForm()->post("https://login.microsoftonline.com/{$tenantId}/oauth2/v2.0/token", [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:device_code',
                'client_id' => $clientId,
                'device_code' => $deviceCode,
            ]);

            if ($tokenResponse->successful()) {
                $accessToken = $tokenResponse->json()['access_token'];
                $this->newLine();
                $this->info('¡Autenticación exitosa! Procediendo con el análisis...');
                break;
            }

            $error = $tokenResponse->json()['error'] ?? 'unknown';
            
            if ($error === 'authorization_pending') {
                // El usuario aún no se loguea, seguir esperando
                $this->output->write('.');
                continue;
            } elseif ($error === 'expired_token') {
                $this->error('El código expiró. Por favor ejecuta el comando de nuevo.');
                return 1;
            } else {
                $this->error('Error de autenticación: ' . $tokenResponse->body());
                return 1;
            }
        }

        // 3. Determinar URL inicial (Raíz del Drive o Carpeta Específica)
        $folderId = $this->option('folder-id');
        $url = $folderId 
            ? "https://graph.microsoft.com/v1.0/drives/{$driveId}/items/{$folderId}/children"
            : "https://graph.microsoft.com/v1.0/drives/{$driveId}/root/children";

        $this->info("Escaneando estructura de carpetas en SharePoint...");

        // 4. Obtener lista de empresas (Carpetas)
        $foldersResponse = Http::withToken($accessToken)->get($url);
        
        if ($foldersResponse->failed()) {
            $this->error('Error al leer SharePoint: ' . $foldersResponse->body());
            return 1;
        }

        $items = $foldersResponse->json()['value'] ?? [];
        $mapaEmpresas = [];

        $bar = $this->output->createProgressBar(count($items));
        $bar->start();

        foreach ($items as $item) {
            // Solo nos interesan las carpetas (folder property existe)
            if (isset($item['folder'])) {
                $nombreEmpresa = $item['name'];
                $empresaId = $item['id'];

                // Inicializar estructura
                $mapaEmpresas[$nombreEmpresa] = [
                    'constancia' => [],
                    'comprobante' => [],
                    'otros' => []
                ];

                // 5. Leer archivos DENTRO de la carpeta de la empresa
                $filesUrl = "https://graph.microsoft.com/v1.0/drives/{$driveId}/items/{$empresaId}/children";
                $filesResponse = Http::withToken($accessToken)->get($filesUrl);

                if ($filesResponse->successful()) {
                    $files = $filesResponse->json()['value'] ?? [];
                    
                    foreach ($files as $file) {
                        if (isset($file['file'])) { // Asegurar que es archivo
                            $this->clasificarArchivo($file['name'], $mapaEmpresas[$nombreEmpresa]);
                        }
                    }
                    
                    // Limpiar duplicados y reindexar
                    $mapaEmpresas[$nombreEmpresa]['constancia'] = array_values(array_unique($mapaEmpresas[$nombreEmpresa]['constancia']));
                    $mapaEmpresas[$nombreEmpresa]['comprobante'] = array_values(array_unique($mapaEmpresas[$nombreEmpresa]['comprobante']));
                    $mapaEmpresas[$nombreEmpresa]['otros'] = array_values(array_unique($mapaEmpresas[$nombreEmpresa]['otros']));
                }
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        // 6. Output del Resultado JSON
        $jsonResult = json_encode($mapaEmpresas, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        
        $this->info('Análisis completado. Resultado:');
        $this->line($jsonResult);
    }

    private function clasificarArchivo($nombre, &$bucket)
    {
        $nombreLower = Str::lower($nombre);
        $extension = pathinfo($nombre, PATHINFO_EXTENSION);
        
        if (empty($extension)) return;

        $encontrado = false;

        foreach ($this->keywords as $tipo => $palabras) {
            foreach ($palabras as $palabra) {
                if (str_contains($nombreLower, $palabra)) {
                    $bucket[$tipo][] = $extension;
                    $encontrado = true;
                    break 2; // Romper ambos bucles
                }
            }
        }

        if (!$encontrado) {
            $bucket['otros'][] = $extension;
        }
    }
}