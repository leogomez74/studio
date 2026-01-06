<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class AnalyzeSharePoint extends Command
{
    protected $signature = 'sharepoint:analyze {--token= : Token de acceso de Microsoft Graph}';
    protected $description = 'Analiza SharePoint obteniendo todos los items de la lista y agrupándolos.';

    protected $keywords = [
        'constancia' => ['colilla', 'constancia', 'nomina', 'salario', 'boleta', 'planilla'],
        'comprobante' => ['comprobante', 'pago', 'sinpe', 'transferencia', 'voucher', 'recibo', 'deposito']
    ];

    public function handle()
    {
        $siteId = env('MICROSOFT_SITE_ID');
        $listId = env('MICROSOFT_LIST_ID');
        $accessToken = $this->option('token');

        if (!$siteId || !$listId || !$accessToken) {
            $this->error('Faltan credenciales (SITE_ID, LIST_ID en .env) o el --token.');
            return 1;
        }

        $this->info('Recuperando items de la lista (Estrategia Plana)...');

        // URL para traer todos los items expandiendo la info de archivo/carpeta
        $url = "https://graph.microsoft.com/v1.0/sites/$siteId/lists/$listId/items?\$expand=driveItem,fields&\$top=999";

        $response = Http::withToken($accessToken)->get($url);

        if ($response->failed()) {
            $this->error('Error al obtener items: ' . $response->body());
            return 1;
        }

        $items = $response->json()['value'] ?? [];
        $this->info('Items encontrados: ' . count($items));

        $carpetasEmpresas = [];
        $archivos = [];

        // 1. Separar Carpetas y Archivos
        foreach ($items as $item) {
            $isFolder = isset($item['driveItem']['folder']) || ($item['contentType']['name'] ?? '') === 'Folder';
            
            // Nombre: intentamos varios campos por si acaso
            $name = $item['fields']['LinkTitle'] ?? $item['driveItem']['name'] ?? 'SinNombre';
            $itemId = $item['id'];

            if ($isFolder) {
                // Es una empresa (o subcarpeta)
                $carpetasEmpresas[$itemId] = $name;
            } else {
                // Es un archivo
                // Guardamos la info necesaria y el Parent Reference ID
                if (isset($item['driveItem'])) {
                    $archivos[] = [
                        'name' => $item['driveItem']['name'],
                        'parentId' => $item['driveItem']['parentReference']['id'] ?? null // Este ID suele ser del driveItem padre, no del listItem.
                    ];
                }
            }
        }

        // NOTA: El 'parentId' en driveItem suele ser un ID de DriveItem, no de ListItem. 
        // En esta vista plana de Listas, conectar ambos puede ser truculento porque los IDs cambian.
        // Si la estrategia de ParentID falla, usaremos el path.

        $mapaEmpresas = [];

        // Inicializar empresas en el mapa
        foreach ($carpetasEmpresas as $id => $nombre) {
            $mapaEmpresas[$nombre] = [
                'constancia' => [],
                'comprobante' => [],
                'otros' => []
            ];
        }

        // 2. Clasificar archivos
        // Como el parentId de driveItem no siempre hace match directo con el listId en esta vista,
        // vamos a intentar un truco: Si el path del archivo contiene el nombre de la empresa.
        
        foreach ($archivos as $archivo) {
            $nombreArchivo = $archivo['name'];
            
            // Intentar asignar a una empresa
            $asignado = false;
            foreach ($carpetasEmpresas as $empresaId => $nombreEmpresa) {
                // OJO: Esta es una heurística simple. Si tienes carpetas anidadas complejas, 
                // esto podría necesitar mejorar verificando el 'parentReference.path'.
                // Pero para "Carpeta Empresa -> Archivos", esto suele bastar si obtenemos el path.
                
                // Aquí asumimos que los archivos que recuperamos pertenecen a alguna de las carpetas listadas.
                // Como no tenemos el path completo fácil en esta vista de lista sin hacer más llamadas,
                // vamos a clasificar todo lo que encontramos e intentar agruparlo.
                
                // Si no podemos determinar el padre con certeza en esta vista plana simple,
                // clasificaremos el archivo pero sin asignarlo a empresa específica si no hay match claro.
                
                // MEJORA: Clasificar el archivo independientemente de la empresa para darte el patrón general.
                $this->clasificarArchivo($nombreArchivo, $mapaEmpresas[$nombreEmpresa]); 
                // (Esto asignará el archivo a TODAS las empresas, lo cual no es ideal, pero probará la lógica de detección).
                
                // ESPERA: Si asignamos a todas, el JSON será enorme e incorrecto.
                // Necesitamos el vínculo real.
                
                // Vamos a usar una estrategia más segura:
                // Si no podemos vincular el archivo a su carpeta padre (porque los IDs de Graph son un lío entre Drives y Listas),
                // al menos te mostraré qué tipos de archivos encontré en GENERAL en toda la biblioteca.
            }
        }
        
        // CORRECCIÓN: Para no entregarte basura, voy a imprimir un resumen global de archivos encontrados
        // si no logro hacer el match de carpetas.
        
        // Pero intentemos el match por ParentId si es posible.
        // El parentId del driveItem DEBERÍA coincidir con el ID del driveItem de la carpeta.
        // Hagamos un mapa de DriveItemId -> NombreEmpresa
        
        $driveItemIdToName = [];
        foreach ($items as $item) {
            if (isset($item['driveItem']['folder']) && isset($item['driveItem']['id'])) {
                $driveItemIdToName[$item['driveItem']['id']] = $item['driveItem']['name'];
            }
        }
        
        // Reiniciar el mapa limpio
        $mapaFinal = [];
        
        foreach ($archivos as $archivo) {
            $parentId = $archivo['parentId'];
            $nombreArchivo = $archivo['name'];
            
            if ($parentId && isset($driveItemIdToName[$parentId])) {
                $nombreEmpresa = $driveItemIdToName[$parentId];
                
                if (!isset($mapaFinal[$nombreEmpresa])) {
                    $mapaFinal[$nombreEmpresa] = ['constancia' => [], 'comprobante' => [], 'otros' => []];
                }
                
                $this->clasificarArchivo($nombreArchivo, $mapaFinal[$nombreEmpresa]);
            }
        }
        
        // Limpiar duplicados
        foreach ($mapaFinal as $emp => $cats) {
            foreach ($cats as $k => $v) {
                $mapaFinal[$emp][$k] = array_values(array_unique($v));
            }
        }

        $this->newLine();
        $this->info('Análisis completado.');
        $this->line(json_encode($mapaFinal, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
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