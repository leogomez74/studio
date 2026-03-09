<?php

namespace App\Console\Commands;

use App\Models\EmbargoConfiguracion;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Smalot\PdfParser\Parser as PdfParser;

class ActualizarSalarioMinimoEmbargo extends Command
{
    protected $signature = 'embargo:actualizar-smi
        {--force : Forzar actualización aunque el valor no haya cambiado}
        {--anio= : Año del decreto a consultar (default: año actual)}';

    protected $description = 'Descarga el PDF de salarios mínimos del MTSS y actualiza el salario mínimo inembargable';

    /**
     * URL base del PDF de salarios mínimos del MTSS.
     * El MTSS publica anualmente en esta ruta con el formato: lista_salarios_minimos_YYYY.pdf
     */
    private const PDF_BASE_URL = 'https://www.mtss.go.cr/temas-laborales/salarios/lista_salarios_minimos_{anio}.pdf';

    public function handle(): int
    {
        $anio = (int) ($this->option('anio') ?: date('Y'));
        $pdfUrl = str_replace('{anio}', $anio, self::PDF_BASE_URL);

        $this->info("Descargando PDF de salarios mínimos {$anio}...");
        $this->info("URL: {$pdfUrl}");

        try {
            $response = Http::timeout(30)
                ->withHeaders(['User-Agent' => 'Mozilla/5.0'])
                ->get($pdfUrl);

            if (!$response->successful()) {
                $this->error("No se pudo descargar el PDF (HTTP {$response->status()}).");
                Log::warning('embargo:actualizar-smi - PDF download failed', [
                    'url' => $pdfUrl,
                    'status' => $response->status(),
                ]);
                return self::FAILURE;
            }

            $salarioMinimo = $this->extraerSalarioMinimo($response->body());

            if ($salarioMinimo === null) {
                $this->error('No se pudo extraer el salario mínimo del PDF.');
                Log::error('embargo:actualizar-smi - Could not parse minimum salary from PDF', ['url' => $pdfUrl, 'body_length' => strlen($response->body())]);
                return self::FAILURE;
            }

            $this->info("Salario mínimo mensual más bajo encontrado: ₡" . number_format($salarioMinimo, 2, ',', '.'));

            $this->actualizarConfiguracion($salarioMinimo, $anio);

            return self::SUCCESS;

        } catch (\Exception $e) {
            $this->error("Error: {$e->getMessage()}");
            Log::error('embargo:actualizar-smi - Exception', ['error' => $e->getMessage()]);
            return self::FAILURE;
        }
    }

    /**
     * Extraer el menor salario mínimo mensual del PDF.
     *
     * El PDF del MTSS contiene salarios diarios (₡12,000~₡25,000) y mensuales (₡268,000+).
     * Los salarios mensuales están marcados con * y son montos > ₡100,000.
     * El menor de estos es el salario mínimo inembargable (históricamente: trabajo doméstico).
     */
    private function extraerSalarioMinimo(string $pdfContent): ?float
    {
        $parser = new PdfParser();
        $pdf = $parser->parseContent($pdfContent);
        $text = $pdf->getText();

        // Buscar todos los montos en formato costarricense: ₡NNN.NNN,NN o ¢NNN.NNN,NN
        preg_match_all('/[₡¢]([\d.]+,\d{2})/', $text, $matches);

        if (empty($matches[1])) {
            return null;
        }

        $salariosMensuales = [];

        foreach ($matches[1] as $raw) {
            $valor = (float) str_replace(['.', ','], ['', '.'], $raw);
            // Filtrar solo salarios mensuales (> ₡100,000 descarta los diarios)
            if ($valor > 100000) {
                $salariosMensuales[] = $valor;
            }
        }

        if (empty($salariosMensuales)) {
            return null;
        }

        return min($salariosMensuales);
    }

    private function actualizarConfiguracion(float $nuevoSmi, int $anio): void
    {
        $config = EmbargoConfiguracion::vigente();

        if ($config && !$this->option('force')) {
            if ((float) $config->salario_minimo_inembargable === $nuevoSmi && $config->anio === $anio) {
                $config->update(['ultima_verificacion' => now()]);
                $this->info('El salario mínimo no cambió. Se actualizó la fecha de verificación.');
                Log::info('embargo:actualizar-smi - No changes, verification updated', ['smi' => $nuevoSmi]);
                return;
            }
        }

        // Si hay cambio: desactivar la configuración anterior y crear una nueva
        if ($config) {
            $config->update(['activo' => false]);
        }

        $nueva = EmbargoConfiguracion::create([
            'salario_minimo_inembargable' => $nuevoSmi,
            'tasa_ccss' => $config->tasa_ccss ?? 0.1083,
            'tasa_tramo1' => $config->tasa_tramo1 ?? 0.125,
            'tasa_tramo2' => $config->tasa_tramo2 ?? 0.25,
            'multiplicador_tramo1' => $config->multiplicador_tramo1 ?? 3,
            'tramos_renta' => $config->tramos_renta ?? [
                ['limite' => 918000, 'tasa' => 0],
                ['limite' => 1347000, 'tasa' => 0.10],
                ['limite' => 2364000, 'tasa' => 0.15],
                ['limite' => null, 'tasa' => 0.20],
            ],
            'fuente' => 'pdf_mtss',
            'decreto' => $config->decreto ?? null,
            'anio' => $anio,
            'activo' => true,
            'ultima_verificacion' => now(),
        ]);

        $smiAnterior = $config ? $config->salario_minimo_inembargable : 'N/A';
        $this->info("Configuración actualizada: SMI ₡" . number_format($nuevoSmi, 2, ',', '.') . " (anterior: ₡{$smiAnterior})");

        Log::info('embargo:actualizar-smi - Configuration updated', [
            'nuevo_smi' => $nuevoSmi,
            'anterior_smi' => $smiAnterior,
            'anio' => $anio,
        ]);
    }
}
