<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
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
        'cedula'             => [
            'cedula', 'identificacion', 'identidad', 'dni', 'numerodecedula', 'numerocedula',
            'nocedula', 'cedulaidentidad', 'numeroidentificacion', 'idalterno', 'numerodeidentificacion',
        ],
        // 'name' captura desde headers genéricos "Nombre" / "Nombres".
        // Si el valor viene con varias palabras (ej: "JENKINS CRUZ STEPHANIE") y no hay
        // apellido1/apellido2 separados, postProcess() lo divide automáticamente.
        'name'               => ['nombre', 'nombres', 'nombrecompleto', 'nombrepersona', 'nombrepila', 'primernombre', 'firstname', 'apellidosynombres'],
        'apellido1'          => ['apellido1', 'primerapellido', 'apellidopaterno', 'apellido'],
        'apellido2'          => ['apellido2', 'segundoapellido', 'apellidomaterno'],
        'fecha_nacimiento'   => [
            'fechanacimiento', 'fechadenacimiento', 'nacimiento', 'fechanac', 'dob', 'birthdate',
            'fechadenac', 'fecnacimiento', 'fnacimiento',
        ],
        'estado_civil'       => ['estadocivil', 'edocivil'],
        'genero'             => ['genero', 'sexo'],
        'nacionalidad'       => ['nacionalidad', 'pais'],
        'email'              => ['email', 'correo', 'correoelectronico', 'mail', 'emailno1', 'emailprincipal', 'email1', 'emailno2', 'email2'],
        // 'whatsapp' captura el teléfono móvil/celular (uso primario en CR)
        'whatsapp'           => ['whatsapp', 'wa', 'numwhatsapp', 'movil', 'celular', 'telmovil', 'telcelular', 'celularmovil', 'numerocelular', 'celular1'],
        // 'phone' solo captura headers genéricos "Teléfono" / "Phone" o teléfono de trabajo
        'phone'              => ['phone', 'telefono', 'tel', 'numerotelefono', 'teltrabajo', 'telefonotrabajo'],
        'tel_casa'           => ['telcasa', 'telefonocasa', 'telefonohogar', 'telhabitacion', 'telhogar', 'habitacion'],
        'province'           => ['provincia', 'province'],
        'canton'             => ['canton'],
        'distrito'           => ['distrito'],
        'direccion1'         => ['direccion', 'direccion1', 'direccionexacta', 'domicilio', 'address', 'domicilioelectoral', 'direccionresidencia'],
        'direccion2'         => ['direccion2', 'otradireccion'],
        'ocupacion'          => ['ocupacion', 'oficio'],
        'profesion'          => ['profesion'],
        'institucion_labora' => [
            'institucionlabora', 'institucion', 'empresa', 'patrono', 'lugardetrabajo', 'lugartrabajo',
            'centrodetrabajo', 'institucionempresa', 'razonsocial', 'empresalabora',
        ],
        'puesto'             => ['puesto', 'cargo'],
        'nivel_academico'    => ['nivelacademico', 'escolaridad', 'educacion'],
        'nombramientos'      => ['nombramientos', 'nombramiento', 'estadolaboral', 'tiponombramiento', 'estadopuesto'],
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
        'poliza'             => ['poliza', 'polizas', 'polizapago'],
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

        if ($ext === 'pdf') {
            return $this->parseCreditoPdf($file->getRealPath());
        }

        if (!in_array($ext, ['xlsx', 'xls', 'csv'], true)) {
            throw new \InvalidArgumentException(
                "Formato no soportado para créditos: {$ext}"
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
                $records[] = $this->postProcessRecord($record, $synonyms);
            }
        }

        return $records;
    }

    /**
     * Aplica reglas post-extracción sobre un record ya mapeado:
     * - Split de nombre compuesto "APELLIDO1 APELLIDO2 NOMBRES" → 3 campos
     * - Conversión de fechas Excel serial → string YYYY-MM-DD
     *
     * @param array<string, mixed> $record
     * @param array<string, array<int, string>> $synonyms
     * @return array<string, mixed>
     */
    private function postProcessRecord(array $record, array $synonyms): array
    {
        // 1. Si tenemos `name` pero NO apellido1 ni apellido2, intentar split del nombre completo.
        // El formato común en CR es "APELLIDO1 APELLIDO2 NOMBRES" (excel CREDIPEP, INS, TSE, etc.)
        if (isset($record['name']) && empty($record['apellido1']) && empty($record['apellido2'])) {
            $tokens = preg_split('/\s+/', trim((string) $record['name'])) ?: [];
            $tokens = array_values(array_filter($tokens, fn($t) => $t !== ''));
            $count = count($tokens);

            if ($count >= 3) {
                // 3+ palabras: apellido1, apellido2, resto = nombres
                $record['apellido1'] = $tokens[0];
                $record['apellido2'] = $tokens[1];
                $record['name']      = implode(' ', array_slice($tokens, 2));
            } elseif ($count === 2) {
                // 2 palabras: apellido1 + name
                $record['apellido1'] = $tokens[0];
                $record['name']      = $tokens[1];
            }
            // count === 1: dejar como name solo
        }

        // 2. Convertir fechas Excel serial (números entre 25569 y 73050 = 1970..2099)
        $dateFields = ['fecha_nacimiento', 'fecha_formalizacion', 'fecha_pago'];
        foreach ($dateFields as $df) {
            if (isset($record[$df])) {
                $converted = $this->maybeExcelSerialToDate($record[$df]);
                if ($converted !== null) {
                    $record[$df] = $converted;
                }
            }
        }

        return $record;
    }

    /**
     * Si el valor parece un serial Excel (número entre 1970 y 2099), lo convierte a YYYY-MM-DD.
     * Si no, devuelve null (el campo se queda como vino).
     */
    private function maybeExcelSerialToDate(mixed $value): ?string
    {
        if (!is_numeric($value)) return null;
        $serial = (float) $value;
        // Excel serial: 1 = 1900-01-01, 73050 = 2099-12-31
        // Aceptamos cualquier serial razonable; el campo ya es de tipo fecha por contexto.
        if ($serial < 1 || $serial > 73050) return null;
        try {
            $dt = ExcelDate::excelToDateTimeObject($serial);
            return $dt->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
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
                $records[] = $this->postProcessRecord($record, $this->synonyms);
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

    // =======================================================================
    // PDF de Crédito (formato CREDIPEP "ESTADO DE LA OPERACION")
    // =======================================================================

    /**
     * Parsea un PDF de "Estado de la Operación" de CREDIPEP.
     * Retorna 1 crédito + N pagos extraídos del historial.
     *
     * @return array{creditos: array<int, array<string, mixed>>, pagos: array<int, array<string, mixed>>}
     */
    private function parseCreditoPdf(string $path): array
    {
        $pdf = (new PdfParser())->parseFile($path);
        $text = $pdf->getText();

        if (!str_contains($text, 'ESTADO DE LA OPERACION')) {
            throw new \RuntimeException(
                'El PDF no parece ser un "Estado de la Operación" de CREDIPEP. Verifica el formato.'
            );
        }

        $header = $this->parseCreditoPdfHeader($text);
        $pagos  = $this->parseCreditoPdfPagos($text, $header);

        return [
            'creditos' => [$header],
            'pagos'    => $pagos,
        ];
    }

    /**
     * Extrae los datos del header del crédito desde el texto del PDF.
     * Los valores aparecen en orden fijo antes de los labels:
     *  1. numero_operacion
     *  2. cedula
     *  3. linea (código)
     *  4. monto
     *  5. plazo
     *  6. nombre completo
     *  7. linea (nombre)
     *  8. saldo
     *  9. tasa
     *
     * @return array<string, mixed>
     */
    private function parseCreditoPdfHeader(string $text): array
    {
        $lines = array_values(array_filter(array_map('trim', explode("\n", $text)), fn($l) => $l !== ''));

        $val = fn($i) => $lines[$i] ?? null;

        // Valores principales en posiciones fijas
        $numeroOperacion = $val(0);
        $cedula          = preg_replace('/[^0-9]/', '', (string) $val(1)) ?: null;
        $monto           = $this->parseMoney($val(3));
        $plazo           = $val(4) !== null ? (int) trim($val(4)) : null;
        $saldo           = $this->parseMoney($val(7));
        $tasa            = $val(8) !== null ? (float) trim($val(8)) : null;

        // Fecha de formalización: formato MM/DD/YYYY en el texto (CREDIPEP usa US date)
        $fechaFormalizacion = null;
        if (preg_match('/(\d{2}\/\d{2}\/\d{4})/', $text, $m)) {
            // Convertir MM/DD/YYYY → YYYY-MM-DD
            $parts = explode('/', $m[1]);
            if (count($parts) === 3 && checkdate((int)$parts[0], (int)$parts[1], (int)$parts[2])) {
                $fechaFormalizacion = sprintf('%04d-%02d-%02d', $parts[2], $parts[0], $parts[1]);
            }
        }

        // Cuota: aparece como "44,825.90CUOTA" (valor pegado al label)
        $cuota = null;
        if (preg_match('/([\d,]+\.\d{2})CUOTA/', $text, $m)) {
            $cuota = $this->parseMoney($m[1]);
        }

        // INSTITUCION del PDF (ej: "MUNICIPALIDAD DE SAN JOSÉ") = donde labora la persona.
        // NO es la deductora. La deductora se infiere del prefijo del comprobante de pagos
        // (ej: M-SJ, CSG) que puede cambiar a lo largo de la vida del crédito.
        $institucion = null;
        if (preg_match('/PAGAR[ÉE]\s*\([^)]*\)\s*\n([^\n]+)/u', $text, $m)) {
            $institucion = trim($m[1]);
        }

        // Divisa: "COL" → "CRC", "USD" → "USD"
        $divisa = 'CRC';
        if (preg_match('/\b(COL|CRC|USD|EUR)\b\s*DIVISA/i', $text, $m)) {
            $divisa = strtoupper($m[1]) === 'COL' ? 'CRC' : strtoupper($m[1]);
        }

        return [
            'numero_operacion'    => $numeroOperacion ? (string) $numeroOperacion : null,
            'cedula'              => $cedula,
            'monto_credito'       => $monto,
            'plazo_meses'         => $plazo,
            'tasa_anual'          => $tasa,
            'cuota'               => $cuota,
            'fecha_formalizacion' => $fechaFormalizacion,
            // institucion_labora va al Person, NO a la Deductora del Crédito.
            // El creator usará este valor para actualizar Person.institucion_labora.
            'institucion_labora'  => $institucion,
            'deductora_nombre'    => null, // No se infiere del PDF; queda en null
            'divisa'              => $divisa,
            'saldo_actual'        => $saldo,
        ];
    }

    /**
     * Extrae las filas de pagos del PDF.
     * Cada fila aparece como:
     *  LINEA N.CUOTA PROCESO INT.COR INT.MOR CARGOS FECHA PRINCIPAL SALDO COMPROBANTE USUARIO MONTO POLIZAS
     *
     * El COMPROBANTE puede ser:
     *  - "MIGRA" (con split a "MIG\nRA\n" + número de comprobante) — migración legacy
     *  - "PLA<proceso>.<deductora>.CRD" — pago por planilla
     *  - "AJ <texto>" — ajuste manual
     *
     * @param array<string, mixed> $header
     * @return array<int, array<string, mixed>>
     */
    private function parseCreditoPdfPagos(string $text, array $header): array
    {
        // Normalizar el partido "MIG\nRA\nNUMERO" en "MIGRA NUMERO"
        $text = preg_replace('/MIG\s*\n+\s*RA\s*\n+\s*(\d+)/', 'MIGRA $1', $text);

        // El comprobante tiene 3 formatos exclusivos:
        //  - PLA<proceso>.<deductora>.CRD       → pago por planilla
        //  - MIGRA \d+                          → migración legacy
        //  - AJ <texto>                         → ajuste manual del sistema viejo
        // El usuario/caja va inmediatamente después (sin espacio) y termina en `/`.
        $comprobantePattern = '(PLA\d+\.[A-Z\-]+\.CRD|MIGRA\s+\d+|AJ[^\/]*?(?=[A-Z]+\/))';

        $pattern = '/'
            . '\s+(\d+\.\d{2})\s+(\d+)\s+(\d{6})\s+'              // 1=linea, 2=n_cuota, 3=proceso
            . '([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})' // 4=int.cor, 5=int.mor, 6=cargos
            . '(\d{1,2}\/\d{1,2}\/\d{4})\s+'                       // 7=fecha (d/m/Y)
            . '([\d,]+\.\d{2})\s+([\d,]+\.\d{2})'                  // 8=principal, 9=saldo
            . $comprobantePattern                                   // 10=comprobante
            . '([A-Z]+\/)\s+'                                      // 11=usuario/caja
            . '([\d,]+\.\d{2})\s+([\d,]+\.\d{2})'                  // 12=monto, 13=polizas
            . '/u';

        $pagos = [];
        preg_match_all($pattern, $text, $matches, PREG_SET_ORDER);

        foreach ($matches as $m) {
            // $m[10] = comprobante (limpio), $m[11] = usuario/caja
            $comprobante = trim($m[10]);
            $tipoPago = $this->mapComprobanteToTipoPago($comprobante);

            // Saltar ajustes (no son pagos reales, solo cambios de fecha en el sistema viejo)
            if ($tipoPago === null) {
                continue;
            }

            // Convertir fecha d/m/Y → Y-m-d
            $fechaParts = explode('/', $m[7]);
            $fechaPago = null;
            if (count($fechaParts) === 3 && checkdate((int)$fechaParts[1], (int)$fechaParts[0], (int)$fechaParts[2])) {
                $fechaPago = sprintf('%04d-%02d-%02d', $fechaParts[2], $fechaParts[1], $fechaParts[0]);
            }

            $opNum = $header['numero_operacion'] ?? '';
            $pagos[] = [
                'cedula'             => $header['cedula'] ?? null,
                'numero_operacion'   => $opNum ?: null,
                'fecha_pago'         => $fechaPago,
                'monto_total'        => $this->parseMoney($m[12]),
                'capital'            => $this->parseMoney($m[8]),
                'interes_corriente'  => $this->parseMoney($m[4]),
                'interes_moratorio'  => $this->parseMoney($m[5]),
                'poliza'             => $this->parseMoney($m[13]) ?? 0,  // columna POLIZAS
                'otros'              => $this->parseMoney($m[6]) ?? 0,   // columna CARGOS
                'tipo_pago'          => $tipoPago,
                'numero_cuota'       => (int) $m[2],
                // Referencia única por crédito+linea+comprobante para idempotencia
                'referencia_pago'    => "OP{$opNum}-L{$m[1]}-{$comprobante}",
            ];
        }

        return $pagos;
    }

    /**
     * Mapea el COMPROBANTE del PDF a un tipo_pago canónico.
     * Retorna null si el row debe saltarse (ajuste, no es un pago real).
     */
    private function mapComprobanteToTipoPago(string $comprobante): ?string
    {
        $c = strtoupper(trim($comprobante));
        if (str_starts_with($c, 'PLA')) return 'cuota_planilla';
        if (str_starts_with($c, 'MIGRA')) return 'cuota_planilla'; // migración histórica = planilla
        if (str_starts_with($c, 'AJ')) return null; // ajuste, no es pago
        return 'cuota_ventanilla'; // default
    }

    /**
     * Parsea un string como "1,250,000.00" a float.
     */
    private function parseMoney(mixed $value): ?float
    {
        if ($value === null) return null;
        $clean = preg_replace('/[^0-9.]/', '', (string) $value);
        return $clean === '' ? null : (float) $clean;
    }
}
