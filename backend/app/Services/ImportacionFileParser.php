<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Smalot\PdfParser\Parser as PdfParser;

/**
 * Lee archivos Excel/CSV/PDF y extrae campos canónicos de una persona.
 *
 * Estrategia:
 * - Excel/CSV: primera fila = headers, segunda fila = datos del cliente.
 *   Los headers se normalizan y se mapean a campos canónicos por sinónimos.
 * - PDF: extrae texto plano, busca patrones "Etiqueta: valor" línea por línea
 *   y también heurísticas (cédula 9 dígitos, etc.).
 */
class ImportacionFileParser
{
    /**
     * Sinónimos por campo canónico. Las keys son los campos en `persons`,
     * los values son arrays de sinónimos normalizados (sin tildes, lowercase, sin espacios extras).
     *
     * @var array<string, array<int, string>>
     */
    private array $synonyms = [
        'cedula'             => ['cedula', 'identificacion', 'identidad', 'dni', 'numerodecedula', 'numerocedula', 'nocedula', 'cedulaidentidad', 'numeroidentificacion'],
        'name'               => ['nombre', 'nombres', 'firstname', 'primernombre'],
        'apellido1'          => ['apellido1', 'primerapellido', 'apellidopaterno', 'apellido'],
        'apellido2'          => ['apellido2', 'segundoapellido', 'apellidomaterno'],
        'fecha_nacimiento'   => ['fechanacimiento', 'fechadenacimiento', 'nacimiento', 'fechanac', 'dob', 'birthdate', 'fechadenac'],
        'estado_civil'       => ['estadocivil'],
        'genero'             => ['genero', 'sexo'],
        'nacionalidad'       => ['nacionalidad'],
        'email'              => ['email', 'correo', 'correoelectronico', 'mail'],
        'phone'              => ['phone', 'telefono', 'tel', 'celular', 'movil', 'numerotelefono'],
        'whatsapp'           => ['whatsapp', 'wa'],
        'tel_casa'           => ['telcasa', 'telefonocasa', 'telefonohogar'],
        'province'           => ['provincia', 'province'],
        'canton'             => ['canton'],
        'distrito'           => ['distrito'],
        'direccion1'         => ['direccion', 'direccion1', 'direccionexacta', 'domicilio', 'address', 'domicilioelectoral'],
        'direccion2'         => ['direccion2', 'otradireccion'],
        'ocupacion'          => ['ocupacion', 'oficio'],
        'profesion'          => ['profesion'],
        'institucion_labora' => ['institucionlabora', 'institucion', 'empresa', 'patrono', 'lugardetrabajo', 'lugartrabajo', 'centrodetrabajo'],
        'puesto'             => ['puesto', 'cargo'],
        'nivel_academico'    => ['nivelacademico', 'escolaridad', 'educacion'],
        'nombramientos'      => ['nombramientos', 'nombramiento'],
    ];

    /**
     * Sinónimos por campo canónico de Crédito.
     *
     * @var array<string, array<int, string>>
     */
    private array $creditoSynonyms = [
        'cedula'              => ['cedula', 'identificacion', 'identidad', 'dni', 'cedulacliente'],
        'numero_operacion'    => ['numerooperacion', 'numerodeoperacion', 'numerocredito', 'numerodecredito', 'referencia', 'reference', 'operacion'],
        'monto_credito'       => ['montocredito', 'monto', 'principal', 'capital'],
        'plazo_meses'         => ['plazomeses', 'plazo', 'plazoenmeses', 'meses'],
        'tasa_anual'          => ['tasaanual', 'tasa', 'interesanual', 'tasainteres'],
        'cuota'               => ['cuota', 'cuotamensual', 'pago'],
        'fecha_formalizacion' => ['fechaformalizacion', 'formalizado', 'fechadeformalizacion', 'fecha'],
        'deductora_nombre'    => ['deductoranombre', 'deductora', 'patrono', 'institucionpago'],
        'divisa'              => ['divisa', 'moneda', 'currency'],
        'categoria'           => ['categoria', 'tipo', 'tipocredito'],
        'descripcion'         => ['descripcion', 'detalle', 'observaciones', 'nota'],
    ];

    /**
     * Sinónimos por campo canónico de Pago.
     *
     * @var array<string, array<int, string>>
     */
    private array $pagoSynonyms = [
        'cedula'             => ['cedula', 'identificacion', 'cedulacliente'],
        'numero_operacion'   => ['numerooperacion', 'numerocredito', 'referencia', 'reference', 'operacion'],
        'fecha_pago'         => ['fechapago', 'fechadepago', 'fecha'],
        'monto_total'        => ['montototal', 'monto', 'total', 'pago'],
        'capital'            => ['capital', 'amortizacioncapital', 'principal'],
        'interes_corriente'  => ['interescorriente', 'interes', 'interesnormal'],
        'interes_moratorio'  => ['interesmoratorio', 'mora', 'moratorio'],
        'otros'              => ['otros', 'cargos', 'cargosadicionales'],
        'tipo_pago'          => ['tipopago', 'tipo', 'tipodepago'],
        'numero_cuota'       => ['numerocuota', 'cuotanumero', 'noCuota', 'nocuota'],
        'referencia_pago'    => ['referenciapago', 'recibo', 'idpago', 'idanterior', 'comprobante'],
        'nota'               => ['nota', 'observacion', 'descripcion'],
    ];

    /**
     * Parsea un archivo subido y devuelve una LISTA de records (uno por persona).
     *
     * - Excel/CSV: cada fila después del header = 1 record
     * - PDF: el archivo entero = 1 record
     *
     * @return array<int, array<string, mixed>>
     */
    public function parse(UploadedFile $file): array
    {
        $ext = strtolower($file->getClientOriginalExtension());

        return match ($ext) {
            'xlsx', 'xls' => $this->parseSpreadsheet($file->getRealPath(), $ext),
            'csv'         => $this->parseSpreadsheet($file->getRealPath(), 'csv'),
            'pdf'         => [$this->parsePdf($file->getRealPath())],
            default       => throw new \InvalidArgumentException("Formato no soportado: {$ext}"),
        };
    }

    /**
     * Parsea un archivo de créditos: Excel con hojas "Creditos" y "Pagos".
     *
     * @return array{creditos: array<int, array<string, mixed>>, pagos: array<int, array<string, mixed>>}
     */
    public function parseCreditos(UploadedFile $file): array
    {
        $ext = strtolower($file->getClientOriginalExtension());

        if (!in_array($ext, ['xlsx', 'xls', 'csv'], true)) {
            throw new \InvalidArgumentException(
                "Importación de créditos solo soporta Excel/CSV en esta fase. Recibido: {$ext}"
            );
        }

        $reader = $ext === 'csv'
            ? IOFactory::createReader('Csv')
            : IOFactory::createReaderForFile($file->getRealPath());
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($file->getRealPath());

        $creditos = [];
        $pagos    = [];

        // Buscar hojas por nombre normalizado (sin importar tildes/mayúsculas)
        foreach ($spreadsheet->getAllSheets() as $sheet) {
            $sheetName = $this->normalizeHeader($sheet->getTitle());
            $rows = $sheet->toArray(null, true, false, false);

            if (count($rows) < 2) continue;

            if (in_array($sheetName, ['creditos', 'credito'], true)) {
                $creditos = $this->mapSheetRows($rows, $this->creditoSynonyms);
            } elseif (in_array($sheetName, ['pagos', 'pago', 'historial', 'historicopagos'], true)) {
                $pagos = $this->mapSheetRows($rows, $this->pagoSynonyms);
            }
        }

        // Si solo hay una hoja y no se identificó por nombre, asumir que es Créditos
        if (empty($creditos) && empty($pagos)) {
            $firstSheet = $spreadsheet->getActiveSheet();
            $rows = $firstSheet->toArray(null, true, false, false);
            if (count($rows) >= 2) {
                $creditos = $this->mapSheetRows($rows, $this->creditoSynonyms);
            }
        }

        if (empty($creditos)) {
            throw new \RuntimeException(
                'No se encontró la hoja "Creditos" con datos. Asegúrate de que la primera hoja se llame "Creditos".'
            );
        }

        return ['creditos' => $creditos, 'pagos' => $pagos];
    }

    /**
     * Mapea filas de una hoja usando un diccionario de sinónimos específico.
     *
     * @param array<int, array<int, mixed>> $rows
     * @param array<string, array<int, string>> $synonyms
     * @return array<int, array<string, mixed>>
     */
    private function mapSheetRows(array $rows, array $synonyms): array
    {
        $headers = array_map(fn($h) => $this->normalizeHeader((string)($h ?? '')), $rows[0]);

        $records = [];
        for ($i = 1; $i < count($rows); $i++) {
            $values = $rows[$i] ?? [];

            // Saltar filas vacías
            $isEmpty = true;
            foreach ($values as $v) {
                if ($v !== null && $v !== '' && trim((string)$v) !== '') {
                    $isEmpty = false;
                    break;
                }
            }
            if ($isEmpty) continue;

            $record = ['__row' => $i + 1];
            foreach ($headers as $idx => $normalizedHeader) {
                if ($normalizedHeader === '') continue;
                $field = $this->matchFieldIn($normalizedHeader, $synonyms);
                if ($field === null) continue;

                $val = $values[$idx] ?? null;
                $val = is_string($val) ? trim($val) : $val;
                if ($val === null || $val === '') continue;

                if (!isset($record[$field])) {
                    $record[$field] = $val;
                }
            }

            if (count($record) > 1) {
                $records[] = $record;
            }
        }

        return $records;
    }

    /**
     * Variante de matchField que recibe el diccionario explícitamente.
     *
     * @param array<string, array<int, string>> $synonyms
     */
    private function matchFieldIn(string $normalizedHeader, array $synonyms): ?string
    {
        foreach ($synonyms as $field => $aliases) {
            if (in_array($normalizedHeader, $aliases, true)) {
                return $field;
            }
        }
        if (array_key_exists($normalizedHeader, $synonyms)) {
            return $normalizedHeader;
        }
        return null;
    }

    /**
     * Lee la primera hoja del archivo: fila 1 = headers, filas 2..N = un record por fila.
     *
     * @return array<int, array<string, mixed>>
     */
    private function parseSpreadsheet(string $path, string $ext): array
    {
        $reader = $ext === 'csv'
            ? IOFactory::createReader('Csv')
            : IOFactory::createReaderForFile($path);

        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($path);
        $sheet = $spreadsheet->getActiveSheet();
        $rows = $sheet->toArray(null, true, false, false);

        if (count($rows) < 2) {
            throw new \RuntimeException('El archivo debe tener al menos una fila de cabeceras y una fila de datos.');
        }

        $headers = array_map(fn($h) => $this->normalizeHeader((string)($h ?? '')), $rows[0]);

        // Cada fila a partir de la 2 es un record
        $records = [];
        for ($i = 1; $i < count($rows); $i++) {
            $values = $rows[$i] ?? [];

            // Saltar filas completamente vacías
            $isEmpty = true;
            foreach ($values as $v) {
                if ($v !== null && $v !== '' && trim((string)$v) !== '') {
                    $isEmpty = false;
                    break;
                }
            }
            if ($isEmpty) continue;

            $record = [];
            foreach ($headers as $idx => $normalizedHeader) {
                if ($normalizedHeader === '') continue;
                $field = $this->matchField($normalizedHeader);
                if ($field === null) continue;

                $val = $values[$idx] ?? null;
                $val = is_string($val) ? trim($val) : $val;
                if ($val === null || $val === '') continue;

                if (!isset($record[$field])) {
                    $record[$field] = $val;
                }
            }

            if (!empty($record)) {
                $records[] = $record;
            }
        }

        if (empty($records)) {
            throw new \RuntimeException('El archivo no contiene filas con datos reconocibles.');
        }

        return $records;
    }

    /**
     * Extrae texto del PDF y busca patrones "Etiqueta: valor".
     * También aplica heurísticas adicionales (cédula 9-12 dígitos).
     *
     * @return array<string, mixed>
     */
    private function parsePdf(string $path): array
    {
        $parser = new PdfParser();
        $pdf = $parser->parseFile($path);
        $text = $pdf->getText();

        if (trim($text) === '') {
            throw new \RuntimeException('No se pudo extraer texto del PDF (¿es una imagen escaneada?).');
        }

        $result = [];

        // 1. Buscar líneas tipo "Etiqueta: valor"
        $lines = preg_split('/[\r\n]+/', $text) ?: [];
        foreach ($lines as $line) {
            if (!str_contains($line, ':')) continue;
            [$labelRaw, $valueRaw] = array_pad(explode(':', $line, 2), 2, '');
            $normalizedLabel = $this->normalizeHeader($labelRaw);
            $value = trim($valueRaw);

            if ($normalizedLabel === '' || $value === '') continue;

            $field = $this->matchField($normalizedLabel);
            if ($field === null) continue;

            if (!isset($result[$field])) {
                $result[$field] = $value;
            }
        }

        // 2. Heurística cédula: 9 a 12 dígitos consecutivos (puede tener espacios o guiones)
        if (empty($result['cedula'])) {
            if (preg_match('/\b(\d[\s-]?){8,11}\d\b/', $text, $m)) {
                $clean = preg_replace('/[\s-]/', '', $m[0]);
                if (strlen((string) $clean) >= 9 && strlen((string) $clean) <= 12) {
                    $result['cedula'] = $clean;
                }
            }
        }

        return $result;
    }

    /**
     * Normaliza un encabezado/etiqueta: lowercase, sin tildes, sin caracteres no alfanuméricos.
     */
    private function normalizeHeader(string $h): string
    {
        $h = trim($h);
        if ($h === '') return '';

        // Quitar tildes (transliteración ASCII)
        $h = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $h) ?: $h;
        $h = strtolower($h);
        // Quitar todo lo que no sea letra o número
        $h = preg_replace('/[^a-z0-9]/', '', $h) ?? '';
        return $h;
    }

    /**
     * Busca a qué campo canónico corresponde un header normalizado.
     */
    private function matchField(string $normalizedHeader): ?string
    {
        foreach ($this->synonyms as $field => $aliases) {
            if (in_array($normalizedHeader, $aliases, true)) {
                return $field;
            }
        }
        // También match exacto contra el nombre canónico
        if (array_key_exists($normalizedHeader, $this->synonyms)) {
            return $normalizedHeader;
        }
        return null;
    }
}
