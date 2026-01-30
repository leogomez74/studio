<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use PhpOffice\PhpSpreadsheet\IOFactory;
use App\Models\LoanConfiguration;

class ExportDeduccionesCommand extends Command
{
    protected $signature = 'export:deducciones {--limit=500}';
    protected $description = 'Exportar datos de Excel a archivos JSON versionables (por deductora y mes)';

    public function handle()
    {
        $limit = (int) $this->option('limit');
        $baseDir = dirname(base_path()) . '/.prueba';

        // Buscar archivos .xlsx y .xls
        $xlsxFiles = glob($baseDir . '/*.xlsx');
        $xlsFiles = glob($baseDir . '/*.xls');
        $files = array_merge($xlsxFiles, $xlsFiles);

        if (empty($files)) {
            $this->error('No se encontraron archivos Excel (.xlsx, .xls) en .prueba/');
            return 1;
        }

        // Obtener configuración de microcrédito para cálculos
        $microConfig = LoanConfiguration::where('tipo', 'microcredito')->first();
        if (!$microConfig || !$microConfig->tasa) {
            $this->error('No se encontró configuración de microcrédito con tasa asignada');
            return 1;
        }

        $this->info("✅ Usando configuración:");
        $this->info("   Tasa: {$microConfig->tasa->tasa}%");
        $this->info("   Plazo: {$microConfig->plazo_minimo} meses");
        $this->info("   Archivos encontrados: " . count($files));
        $this->newLine();

        $outputDir = database_path('seeders/data');
        if (!is_dir($outputDir)) {
            mkdir($outputDir, 0755, true);
        }

        foreach ($files as $filePath) {
            $this->processFile($filePath, $limit, $outputDir, $microConfig);
        }

        $this->info("\n✅ Exportación completada. Archivos generados en: {$outputDir}");
        $this->info('💡 Ahora puedes hacer commit de estos archivos y ejecutar: php artisan db:seed --class=DeduccionesSeeder');

        return 0;
    }

    private function processFile(string $filePath, int $limit, string $outputDir, $microConfig)
    {
        // Obtener nombre sin extensión
        $fileNameWithExt = basename($filePath);
        $fileName = pathinfo($filePath, PATHINFO_FILENAME);
        $this->info("📄 Procesando: {$fileNameWithExt}");

        // Identificar deductora
        $deductora = $this->extractDeductora($fileName);

        // Extraer mes del nombre con soporte para múltiples formatos
        $mes = $this->extractMes($fileName);

        $tasaAnual = $microConfig->tasa->tasa;
        $plazoMeses = $microConfig->plazo_minimo;

        // Leer Excel
        $spreadsheet = IOFactory::load($filePath);
        $sheet = $spreadsheet->getActiveSheet();
        $rows = $sheet->toArray();

        array_shift($rows); // Remover header

        $data = [];
        $count = 0;

        foreach (array_slice($rows, 0, $limit) as $row) {
            $cedula = $row[0] ?? null;
            $nombreCompleto = $row[1] ?? null;
            $cuotaMensualRaw = $row[2] ?? null;

            // Limpiar y convertir cuota mensual (remover espacios, comas, etc.)
            if (is_string($cuotaMensualRaw)) {
                $cuotaMensualRaw = str_replace([' ', ','], '', trim($cuotaMensualRaw));
            }
            $cuotaMensual = (float) $cuotaMensualRaw;

            if (empty($cedula) || empty($nombreCompleto) || $cuotaMensual <= 0) {
                continue;
            }

            $nombres = $this->parsearNombre($nombreCompleto);

            // Calcular monto del crédito a partir de la cuota usando fórmula inversa
            $montoCredito = $this->calcularMontoDesdeQuota(
                $cuotaMensual,
                $tasaAnual,
                $plazoMeses
            );

            $data[] = [
                'cedula' => (string) $cedula,
                'nombre' => $nombres['nombre'],
                'apellido1' => $nombres['apellido1'],
                'apellido2' => $nombres['apellido2'],
                'monto_credito' => round($montoCredito, 2),
                'cuota_mensual' => round($cuotaMensual, 2),
                'mes' => $mes,
                'deductora' => $deductora,
            ];

            $count++;
        }

        // Guardar JSON con nombre que incluye deductora y mes
        $outputFile = $outputDir . "/deducciones_{$deductora}_{$mes}.json";
        file_put_contents($outputFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $this->info("✅ Exportados {$count} registros → {$outputFile}");
    }

    private function parsearNombre(string $nombreCompleto): array
    {
        // Filtrar y reindexar para evitar índices faltantes
        $partes = array_values(array_filter(explode(' ', trim(strtoupper($nombreCompleto)))));
        $totalPartes = count($partes);

        if ($totalPartes === 0) {
            return [
                'nombre' => '',
                'apellido1' => '',
                'apellido2' => '',
            ];
        }

        if ($totalPartes === 1) {
            return [
                'nombre' => $partes[0],
                'apellido1' => '',
                'apellido2' => '',
            ];
        }

        if ($totalPartes === 2) {
            return [
                'nombre' => $partes[1],
                'apellido1' => $partes[0],
                'apellido2' => '',
            ];
        }

        if ($totalPartes === 3) {
            return [
                'nombre' => $partes[2],
                'apellido1' => $partes[0],
                'apellido2' => $partes[1],
            ];
        }

        // 4+ partes: primeros 2 = apellidos, resto = nombre
        $apellido1 = $partes[0];
        $apellido2 = $partes[1];
        $nombre = implode(' ', array_slice($partes, 2));

        return [
            'nombre' => $nombre,
            'apellido1' => $apellido1,
            'apellido2' => $apellido2,
        ];
    }

    /**
     * Identificar la deductora del nombre del archivo
     */
    private function extractDeductora(string $fileName): string
    {
        if (stripos($fileName, 'CREDIPEP') !== false) {
            return 'CREDIPEP';
        } elseif (stripos($fileName, 'CoopeSanGabriel') !== false || stripos($fileName, 'SanGabriel') !== false) {
            return 'CoopeSanGabriel';
        } elseif (stripos($fileName, 'CoopeServicios') !== false || stripos($fileName, 'coopeservicios') !== false) {
            return 'CoopeServicios';
        }

        return 'UNKNOWN';
    }

    /**
     * Extraer y normalizar el mes del nombre del archivo
     * Soporta formatos: CREDIPEP_AGO25, CoopeSanGabriel Agost 25, etc.
     */
    private function extractMes(string $fileName): string
    {
        // Mapeo de nombres de meses a abreviaciones
        $mesesMap = [
            'ENERO' => 'ENE', 'ENE' => 'ENE',
            'FEBRERO' => 'FEB', 'FEB' => 'FEB',
            'MARZO' => 'MAR', 'MAR' => 'MAR',
            'ABRIL' => 'ABR', 'ABR' => 'ABR',
            'MAYO' => 'MAY', 'MAY' => 'MAY',
            'JUNIO' => 'JUN', 'JUN' => 'JUN',
            'JULIO' => 'JUL', 'JUL' => 'JUL',
            'AGOSTO' => 'AGO', 'AGOST' => 'AGO', 'AGO' => 'AGO',
            'SEPTIEMBRE' => 'SEP', 'SEPTEMBER' => 'SEP', 'SEPT' => 'SEP', 'SEP' => 'SEP', 'SET' => 'SEP',
            'OCTUBRE' => 'OCT', 'OCT' => 'OCT',
            'NOVIEMBRE' => 'NOV', 'NOV' => 'NOV',
            'DICIEMBRE' => 'DIC', 'DIC' => 'DIC',
        ];

        $fileName = strtoupper($fileName);

        // Formato 1: CREDIPEP_AGO25, CREDIPEP_SEPT25
        if (preg_match('/_([A-Z]+)(\d{2})$/i', $fileName, $matches)) {
            $mesRaw = strtoupper($matches[1]);
            $anio = $matches[2];
            $mesNormalizado = $mesesMap[$mesRaw] ?? $mesRaw;
            return $mesNormalizado . $anio;
        }

        // Formato 2: CoopeSanGabriel Agost 25, CoopeServicios Nov 25
        if (preg_match('/([A-Z]+)\s+(\d{2})$/i', $fileName, $matches)) {
            $mesRaw = strtoupper($matches[1]);
            $anio = $matches[2];
            $mesNormalizado = $mesesMap[$mesRaw] ?? $mesRaw;
            return $mesNormalizado . $anio;
        }

        return 'UNKNOWN';
    }

    /**
     * Calcular el monto del crédito a partir de la cuota mensual
     * Usa la FÓRMULA INVERSA de la usada en CreditController::generateAmortizationSchedule
     *
     * Fórmula original: Cuota = Monto * [r(1+r)^n] / [(1+r)^n - 1]
     * Fórmula inversa:  Monto = Cuota * [(1+r)^n - 1] / [r(1+r)^n]
     */
    private function calcularMontoDesdeQuota(float $cuota, float $tasaAnual, int $plazoMeses): float
    {
        if ($plazoMeses <= 0 || $cuota <= 0) {
            return 0;
        }

        $tasaMensual = ($tasaAnual / 100) / 12;

        if ($tasaMensual == 0) {
            // Sin interés: monto = cuota * plazo
            return $cuota * $plazoMeses;
        }

        // Fórmula inversa usando la misma estructura que CreditController
        $potencia = pow(1 + $tasaMensual, $plazoMeses);
        $monto = $cuota * ($potencia - 1) / ($tasaMensual * $potencia);

        return $monto;
    }
}
