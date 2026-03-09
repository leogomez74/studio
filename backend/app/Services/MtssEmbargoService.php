<?php

namespace App\Services;

use DOMDocument;
use DOMXPath;
use Exception;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MtssEmbargoService
{
    private const MTSS_URL = 'https://www.mtss.go.cr/buscador/embargo.aspx';
    private const CACHE_TTL = 60; // seconds

    /**
     * Calculate embargo via MTSS official page scraping.
     *
     * @throws Exception
     */
    public function calcular(
        float $salarioBruto,
        float $pensionAlimenticia = 0,
        float $otroEmbargo1 = 0,
        float $otroEmbargo2 = 0
    ): array {
        $cacheKey = $this->buildCacheKey($salarioBruto, $pensionAlimenticia, $otroEmbargo1, $otroEmbargo2);
        $cached = Cache::get($cacheKey);

        if ($cached !== null) {
            return ['resultado' => $cached, 'source' => 'mtss', 'cached' => true];
        }

        $tokens = $this->fetchPageTokens();

        $responseHtml = $this->submitForm($tokens, $salarioBruto, $pensionAlimenticia, $otroEmbargo1, $otroEmbargo2);

        $resultado = $this->parseResult($responseHtml);

        Cache::put($cacheKey, $resultado, self::CACHE_TTL);

        return ['resultado' => $resultado, 'source' => 'mtss', 'cached' => false];
    }

    private function buildCacheKey(float $s, float $p, float $e1, float $e2): string
    {
        return 'mtss_embargo_' . md5("{$s}|{$p}|{$e1}|{$e2}");
    }

    /**
     * GET the MTSS page and extract ASP.NET hidden tokens.
     */
    private function fetchPageTokens(): array
    {
        $response = Http::timeout(10)
            ->withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            ])
            ->get(self::MTSS_URL);

        if (!$response->successful()) {
            Log::error('MTSS: GET failed', ['status' => $response->status()]);
            throw new Exception('No se pudo acceder al sitio del MTSS (status ' . $response->status() . '). Intentá de nuevo.');
        }

        $html = $response->body();
        $doc = new DOMDocument();
        @$doc->loadHTML($html, LIBXML_NOERROR | LIBXML_NOWARNING);
        $xpath = new DOMXPath($doc);

        $tokens = [];
        foreach (['__VIEWSTATE', '__VIEWSTATEGENERATOR', '__EVENTVALIDATION'] as $name) {
            $node = $xpath->query("//input[@name='{$name}']")->item(0);
            if (!$node) {
                Log::error("MTSS: token '{$name}' not found in page", ['url' => self::MTSS_URL, 'html_length' => strlen($html)]);
                throw new Exception("La página del MTSS cambió su estructura. No se encontró el token '{$name}'.");
            }
            $tokens[$name] = $node->getAttribute('value');
        }

        return $tokens;
    }

    /**
     * POST the form to MTSS with the extracted tokens and form data.
     */
    private function submitForm(array $tokens, float $salario, float $pension, float $embargo1, float $embargo2): string
    {
        $formData = array_merge($tokens, [
            'ctl00$MainContentPlaceHolder$SalarioBrutoMensualTextBox' => $this->formatForMtss($salario),
            'ctl00$MainContentPlaceHolder$PensionesAlimenticiasTextBox' => $this->formatForMtss($pension),
            'ctl00$MainContentPlaceHolder$OtroEmbargo1TextBox' => $this->formatForMtss($embargo1),
            'ctl00$MainContentPlaceHolder$OtroEmbargo2TextBox' => $this->formatForMtss($embargo2),
            'ctl00$MainContentPlaceHolder$CalcularButton' => 'Calcular',
        ]);

        $response = Http::timeout(15)
            ->asForm()
            ->withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Referer' => self::MTSS_URL,
                'Origin' => 'https://www.mtss.go.cr',
            ])
            ->post(self::MTSS_URL, $formData);

        if (!$response->successful()) {
            Log::error('MTSS: POST failed', ['status' => $response->status(), 'body' => substr($response->body(), 0, 500), 'cedula' => $formData['txtCedula'] ?? null]);
            throw new Exception('Error al enviar datos al MTSS (status ' . $response->status() . '). Intentá de nuevo.');
        }

        return $response->body();
    }

    /**
     * Format a number for MTSS form submission.
     * The MTSS page uses jquery.number plugin with comma-separated thousands
     * and no decimals: e.g. "1,462,531"
     */
    private function formatForMtss(float $value): string
    {
        if ($value == 0) {
            return '';
        }

        return number_format($value, 0, '', ',');
    }

    /**
     * Parse the embargo result from the MTSS response HTML.
     * The result element is: <span id="ctl00_MainContentPlaceHolder_ResultadosLabel">
     * - When applicable: "Total a embargar 143.020,24"
     * - When not applicable: "El ingreso bruto no aplica para embargo"
     */
    private function parseResult(string $html): float
    {
        $doc = new DOMDocument();
        @$doc->loadHTML($html, LIBXML_NOERROR | LIBXML_NOWARNING);
        $xpath = new DOMXPath($doc);

        // Primary selector: the known result element
        $node = $xpath->query("//span[@id='ctl00_MainContentPlaceHolder_ResultadosLabel']")->item(0);

        if (!$node) {
            // Fallback: try partial match
            $node = $xpath->query("//span[contains(@id, 'ResultadosLabel')]")->item(0);
        }

        if (!$node) {
            Log::warning('MTSS: Result element not found', [
                'html_snippet' => substr($html, 0, 3000),
            ]);
            throw new Exception('No se pudo extraer el resultado del MTSS. La estructura de la página pudo haber cambiado.');
        }

        $text = trim($node->textContent);

        // Check for "no aplica" case
        if (stripos($text, 'no aplica') !== false) {
            Log::info('MTSS Embargo: salary does not qualify', ['raw_text' => $text]);
            return 0;
        }

        $parsed = $this->parseColonesToFloat($text);

        if ($parsed === null) {
            Log::warning('MTSS: Could not parse number from result', ['raw_text' => $text]);
            throw new Exception('No se pudo interpretar el resultado del MTSS: "' . $text . '"');
        }

        Log::info('MTSS Embargo: result parsed', ['raw_text' => $text, 'parsed' => $parsed]);
        return $parsed;
    }

    /**
     * Parse a Costa Rican Colones formatted string to float.
     * Handles: "143.020,24", "₡143.020,24", "Total a embargar 143.020,24", "0,00"
     */
    private function parseColonesToFloat(string $text): ?float
    {
        // Remove everything except digits, dots, and commas
        $cleaned = preg_replace('/[^0-9.,]/', '', $text);

        if (empty($cleaned)) {
            return null;
        }

        // Costa Rican format: dots as thousand separators, comma as decimal
        // e.g. "143.020,24"
        if (preg_match('/^[\d.]+,\d{1,2}$/', $cleaned)) {
            $cleaned = str_replace('.', '', $cleaned);
            $cleaned = str_replace(',', '.', $cleaned);
        } elseif (preg_match('/^[\d,]+\.\d{1,2}$/', $cleaned)) {
            // US format: "143,020.24"
            $cleaned = str_replace(',', '', $cleaned);
        } else {
            // Plain number or only thousands: "143020"
            $cleaned = str_replace(['.', ','], '', $cleaned);
        }

        if (!is_numeric($cleaned)) {
            return null;
        }

        return round((float) $cleaned, 2);
    }
}
