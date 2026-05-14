<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Person;
use App\Services\ImportacionFileParser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ImportacionController extends Controller
{
    /**
     * Campos canónicos de la tabla persons que la importación intenta poblar.
     */
    private const CANONICAL_FIELDS = [
        'cedula',
        'name',
        'apellido1',
        'apellido2',
        'fecha_nacimiento',
        'estado_civil',
        'genero',
        'nacionalidad',
        'email',
        'phone',
        'whatsapp',
        'tel_casa',
        'province',
        'canton',
        'distrito',
        'direccion1',
        'direccion2',
        'ocupacion',
        'profesion',
        'institucion_labora',
        'puesto',
        'nivel_academico',
        'nombramientos',
    ];

    private const FIELD_LABELS = [
        'cedula'             => 'Cédula',
        'name'               => 'Nombre',
        'apellido1'          => 'Primer apellido',
        'apellido2'          => 'Segundo apellido',
        'fecha_nacimiento'   => 'Fecha de nacimiento',
        'estado_civil'       => 'Estado civil',
        'genero'             => 'Género',
        'nacionalidad'       => 'Nacionalidad',
        'email'              => 'Email',
        'phone'              => 'Teléfono',
        'whatsapp'           => 'WhatsApp',
        'tel_casa'           => 'Tel. casa',
        'province'           => 'Provincia',
        'canton'             => 'Cantón',
        'distrito'           => 'Distrito',
        'direccion1'         => 'Dirección',
        'direccion2'         => 'Otra dirección',
        'ocupacion'          => 'Ocupación',
        'profesion'          => 'Profesión',
        'institucion_labora' => 'Institución donde labora',
        'puesto'             => 'Puesto',
        'nivel_academico'    => 'Nivel académico',
        'nombramientos'      => 'Nombramientos',
    ];

    /**
     * Lee uno o varios archivos y devuelve un preview con todos los records detectados.
     * - Excel/CSV: cada fila = 1 record (solo se acepta UN archivo Excel/CSV por request)
     * - PDF: cada archivo = 1 record (se aceptan múltiples PDFs)
     */
    public function previewCliente(Request $request): JsonResponse
    {
        $request->validate([
            'files'   => 'required|array|min:1|max:30',
            'files.*' => 'file|mimes:xlsx,xls,csv,pdf|max:10240',
        ]);

        @set_time_limit(0);
        @ini_set('memory_limit', '512M');

        $uploadedFiles = $request->file('files') ?? [];

        // Si hay un Excel/CSV no puede venir mezclado con PDFs ni otros Excel
        $exts = array_map(fn($f) => strtolower($f->getClientOriginalExtension()), $uploadedFiles);
        $hasSheet = (bool) array_intersect($exts, ['xlsx', 'xls', 'csv']);
        if ($hasSheet && count($uploadedFiles) > 1) {
            return response()->json([
                'message' => 'Solo se permite UN archivo Excel/CSV por importación. Para múltiples registros, usa varias filas en el mismo archivo.',
            ], 422);
        }

        $parser = new ImportacionFileParser();
        // Recolectar todos los records parseados de todos los archivos primero,
        // luego hacer UNA sola query para detectar duplicados (mucho más rápido para 2000+ records).
        $parsedAll = [];

        foreach ($uploadedFiles as $file) {
            try {
                $parsedList = $parser->parse($file);
                foreach ($parsedList as $rowIdx => $extracted) {
                    $parsedAll[] = [
                        'source_file' => $file->getClientOriginalName(),
                        'row_number'  => $rowIdx + 1,
                        'extracted'   => $extracted,
                    ];
                }
            } catch (\Throwable $e) {
                Log::error('ImportacionController: error al parsear archivo', [
                    'error' => $e->getMessage(),
                    'file'  => $file->getClientOriginalName(),
                ]);
                $parsedAll[] = [
                    'source_file' => $file->getClientOriginalName(),
                    'row_number'  => null,
                    'error'       => $e->getMessage(),
                ];
            }
        }

        // Batch lookup de cédulas existentes (1 query para todos)
        $cedulasBuscadas = [];
        foreach ($parsedAll as $p) {
            $ced = preg_replace('/[^0-9]/', '', (string)($p['extracted']['cedula'] ?? ''));
            if ($ced !== '') $cedulasBuscadas[] = $ced;
        }
        $existingMap = [];
        if (!empty($cedulasBuscadas)) {
            $existingMap = Person::query()->withoutGlobalScopes()
                ->whereIn('cedula', array_unique($cedulasBuscadas))
                ->get(['id', 'cedula', 'name', 'apellido1', 'apellido2', 'person_type_id', 'email', 'phone', 'is_active'])
                ->keyBy('cedula');
        }

        $records = [];
        foreach ($parsedAll as $p) {
            if (!empty($p['error'])) {
                $records[] = [
                    'source_file' => $p['source_file'],
                    'error'       => $p['error'],
                    'extracted'   => [],
                    'filled'      => [],
                    'missing'     => [],
                    'already_exists' => false,
                    'existing'       => null,
                ];
                continue;
            }
            $records[] = $this->buildRecordPreview(
                $p['source_file'],
                $p['row_number'] ?? 0,
                $p['extracted'],
                $existingMap
            );
        }

        // Resumen agregado
        $summary = [
            'total'           => count($records),
            'new'             => 0,
            'already_exists'  => 0,
            'no_cedula'       => 0,
            'parse_errors'    => 0,
        ];
        foreach ($records as $r) {
            if (!empty($r['error'])) {
                $summary['parse_errors']++;
                continue;
            }
            if ($r['already_exists']) {
                $summary['already_exists']++;
            } elseif (empty($r['extracted']['cedula'])) {
                $summary['no_cedula']++;
            } else {
                $summary['new']++;
            }
        }

        return response()->json([
            'success' => true,
            'summary' => $summary,
            'records' => $records,
        ]);
    }

    /**
     * Construye el preview de un único record.
     *
     * @param array<string, mixed> $extracted
     * @param \Illuminate\Support\Collection<string, \App\Models\Person>|array<string, \App\Models\Person> $existingMap
     *        Mapa cedula → Person para evitar N queries.
     * @return array<string, mixed>
     */
    private function buildRecordPreview(string $sourceFile, int $rowNumber, array $extracted, $existingMap = []): array
    {
        $sanitized = $this->sanitizeExtracted($extracted);

        $existing = null;
        if (!empty($sanitized['cedula'])) {
            $existing = is_array($existingMap)
                ? ($existingMap[$sanitized['cedula']] ?? null)
                : $existingMap->get($sanitized['cedula']);
        }

        $filled  = [];
        $missing = [];
        foreach (self::CANONICAL_FIELDS as $field) {
            $value = $sanitized[$field] ?? null;
            $entry = [
                'field' => $field,
                'label' => self::FIELD_LABELS[$field] ?? $field,
                'value' => $value,
            ];
            if ($value !== null && $value !== '') {
                $filled[] = $entry;
            } else {
                $missing[] = $entry;
            }
        }

        return [
            'source_file'    => $sourceFile,
            'row_number'     => $rowNumber,
            'extracted'      => $sanitized,
            'filled'         => $filled,
            'missing'        => $missing,
            'filled_count'   => count($filled),
            'missing_count'  => count($missing),
            'already_exists' => $existing !== null,
            'existing'       => $existing ? [
                'id'              => $existing->id,
                'cedula'          => $existing->cedula,
                'nombre_completo' => trim("{$existing->name} {$existing->apellido1} {$existing->apellido2}"),
                'person_type_id'  => $existing->person_type_id,
                'tipo'            => $existing->person_type_id === 2 ? 'Cliente' : 'Lead',
                'email'           => $existing->email,
                'phone'           => $existing->phone,
                'is_active'       => (bool) $existing->is_active,
            ] : null,
            'error' => null,
        ];
    }

    /**
     * @param array<string, mixed> $extracted
     * @return array<string, mixed>
     */
    private function sanitizeExtracted(array $extracted): array
    {
        $clean = [];

        foreach (self::CANONICAL_FIELDS as $field) {
            $val = $extracted[$field] ?? null;
            if ($val === null) {
                $clean[$field] = null;
                continue;
            }
            $val = is_string($val) ? trim($val) : $val;
            if ($val === '') {
                $clean[$field] = null;
                continue;
            }

            $clean[$field] = match ($field) {
                'cedula'           => preg_replace('/[^0-9]/', '', (string) $val) ?: null,
                'phone', 'whatsapp', 'tel_casa' => preg_replace('/[^0-9+]/', '', (string) $val) ?: null,
                'email'            => filter_var(strtolower((string) $val), FILTER_VALIDATE_EMAIL) ?: null,
                'fecha_nacimiento' => $this->normalizeDate((string) $val),
                default            => (string) $val,
            };
        }

        return $clean;
    }

    private function normalizeDate(string $raw): ?string
    {
        $raw = trim($raw);
        if ($raw === '') return null;

        $formats = ['Y-m-d', 'd/m/Y', 'd-m-Y', 'm/d/Y', 'd.m.Y', 'd/m/y'];
        foreach ($formats as $fmt) {
            $dt = \DateTime::createFromFormat($fmt, $raw);
            if ($dt && $dt->format($fmt) === $raw) {
                return $dt->format('Y-m-d');
            }
        }

        try {
            $dt = new \DateTime($raw);
            return $dt->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Crea clientes en lote a partir del payload validado en el preview.
     * El frontend envía los registros confirmados; aquí se persisten en `persons`
     * con person_type_id = 2 (Cliente directo).
     */
    public function crearCliente(Request $request): JsonResponse
    {
        $request->validate([
            'clientes'              => 'required|array|min:1',
            'clientes.*.cedula'     => 'required|string',
            'clientes.*.name'       => 'required|string|max:100',
            'clientes.*.apellido1'  => 'nullable|string|max:100',
            'clientes.*.apellido2'  => 'nullable|string|max:100',
        ]);

        // Lotes grandes (2000+ records) requieren más tiempo y memoria
        @set_time_limit(0);
        @ini_set('memory_limit', '512M');

        $clientes = $request->input('clientes', []);

        // Pre-cargar todas las cédulas existentes en UNA query (idempotencia rápida)
        $cedulasInput = array_filter(array_map(
            fn($c) => preg_replace('/[^0-9]/', '', (string)($c['cedula'] ?? '')),
            $clientes
        ));
        $existingMap = [];
        if (!empty($cedulasInput)) {
            $existingMap = Person::query()->withoutGlobalScopes()
                ->whereIn('cedula', array_unique($cedulasInput))
                ->pluck('id', 'cedula')
                ->toArray();
        }

        // Pre-cargar emails ya usados en la BD (constraint UNIQUE en persons.email).
        // Si el email del archivo ya está usado por otra persona, lo omitimos para evitar fallar.
        $emailsInput = array_filter(array_map(
            fn($c) => filter_var(strtolower((string)($c['email'] ?? '')), FILTER_VALIDATE_EMAIL) ?: null,
            $clientes
        ));
        $emailsTomados = [];
        if (!empty($emailsInput)) {
            $emailsTomados = array_flip(
                Person::query()->withoutGlobalScopes()
                    ->whereIn('email', array_unique($emailsInput))
                    ->pluck('email')
                    ->toArray()
            );
        }

        // Track emails ya usados DENTRO del mismo lote (para que 2 filas con mismo email
        // no fallen entre sí: la primera se crea con email, la segunda sin email).
        $emailsUsadosEnLote = [];

        $results = [];
        $stats = ['creados' => 0, 'omitidos' => 0, 'fallidos' => 0, 'email_omitidos' => 0];

        foreach ($clientes as $idx => $data) {
            try {
                $cedula = preg_replace('/[^0-9]/', '', (string) ($data['cedula'] ?? ''));
                if (empty($cedula)) {
                    $results[] = [
                        'index'   => $idx,
                        'cedula'  => $data['cedula'] ?? null,
                        'success' => false,
                        'error'   => 'Cédula inválida',
                    ];
                    $stats['fallidos']++;
                    continue;
                }

                // Idempotencia rápida con el mapa pre-cargado
                if (isset($existingMap[$cedula])) {
                    $results[] = [
                        'index'   => $idx,
                        'cedula'  => $cedula,
                        'success' => false,
                        'omitido' => true,
                        'error'   => "Ya existe (id #{$existingMap[$cedula]})",
                    ];
                    $stats['omitidos']++;
                    continue;
                }

                // Construir payload limpio: solo campos mappeados.
                // Client::create() asigna person_type_id=2 automáticamente vía boot.
                $payload = ['cedula' => $cedula, 'is_active' => true];
                $allowed = [
                    'name', 'apellido1', 'apellido2', 'fecha_nacimiento', 'estado_civil',
                    'genero', 'nacionalidad', 'email', 'phone', 'whatsapp', 'tel_casa',
                    'province', 'canton', 'distrito', 'direccion1', 'direccion2',
                    'ocupacion', 'profesion', 'institucion_labora', 'puesto',
                    'nivel_academico', 'nombramientos',
                ];
                $emailOmitido = false;
                foreach ($allowed as $field) {
                    if (!empty($data[$field])) {
                        // Si el email ya está tomado por otra persona (BD o lote actual), omitirlo.
                        if ($field === 'email') {
                            $emailLower = strtolower(trim((string) $data[$field]));
                            if (isset($emailsTomados[$emailLower]) || isset($emailsUsadosEnLote[$emailLower])) {
                                $emailOmitido = true;
                                continue;
                            }
                            $emailsUsadosEnLote[$emailLower] = true;
                            $payload[$field] = $emailLower;
                            continue;
                        }
                        $payload[$field] = $data[$field];
                    }
                }

                $person = Client::create($payload);

                $results[] = [
                    'index'         => $idx,
                    'cedula'        => $cedula,
                    'success'       => true,
                    'id'            => $person->id,
                    'nombre'        => trim("{$person->name} {$person->apellido1} {$person->apellido2}"),
                    'email_omitido' => $emailOmitido,
                ];
                $stats['creados']++;
                if ($emailOmitido) $stats['email_omitidos']++;
            } catch (\Throwable $e) {
                Log::error('ImportacionController: error creando cliente', [
                    'cedula' => $data['cedula'] ?? null,
                    'error'  => $e->getMessage(),
                ]);
                $results[] = [
                    'index'   => $idx,
                    'cedula'  => $data['cedula'] ?? null,
                    'success' => false,
                    'error'   => $e->getMessage(),
                ];
                $stats['fallidos']++;
            }
        }

        return response()->json([
            'success' => true,
            'stats'   => $stats,
            'results' => $results,
        ]);
    }

    // -----------------------------------------------------------------------
    // CRÉDITOS
    // -----------------------------------------------------------------------

    private const CREDITO_REQUIRED_FIELDS = [
        'cedula', 'monto_credito', 'plazo_meses', 'tasa_anual', 'cuota', 'fecha_formalizacion',
    ];

    private const PAGO_REQUIRED_FIELDS = [
        'fecha_pago', 'monto_total', 'capital', 'interes_corriente', 'tipo_pago',
    ];

    /**
     * Preview de importación de créditos.
     * Lee Excel con hojas "Creditos" y "Pagos", valida y devuelve preview agrupado.
     */
    public function previewCreditos(Request $request): JsonResponse
    {
        $request->validate([
            'files'   => 'required|array|min:1|max:100',
            'files.*' => 'file|mimes:xlsx,xls,csv,pdf|max:20480',
        ]);

        @set_time_limit(0);
        @ini_set('memory_limit', '512M');

        $uploadedFiles = $request->file('files') ?? [];

        $parser = new ImportacionFileParser();
        $creditos = [];
        $fileErrors = [];

        foreach ($uploadedFiles as $file) {
            try {
                $parsed = $parser->parseCreditos($file);
            } catch (\Throwable $e) {
                Log::error('ImportacionController: error parseando créditos', [
                    'error' => $e->getMessage(),
                    'file'  => $file->getClientOriginalName(),
                ]);
                $fileErrors[] = [
                    'file'  => $file->getClientOriginalName(),
                    'error' => $e->getMessage(),
                ];
                continue;
            }

            // Indexar pagos por cedula/numero_operacion para vincularlos al crédito
            $pagosByKey = [];
            foreach ($parsed['pagos'] as $pago) {
                $key = $this->pagoKey($pago);
                if ($key === null) continue;
                $pagosByKey[$key] = $pagosByKey[$key] ?? [];
                $pagosByKey[$key][] = $pago;
            }

            foreach ($parsed['creditos'] as $credito) {
                $sanitized = $this->sanitizeCredito($credito);

                // Vincular pagos al crédito
                $creditoKeys = array_filter([
                    $sanitized['cedula'] ?? null,
                    $sanitized['numero_operacion'] ?? null,
                ]);
                $pagosVinculados = [];
                foreach ($creditoKeys as $k) {
                    if (isset($pagosByKey[$k])) {
                        foreach ($pagosByKey[$k] as $p) {
                            $pagosVinculados[] = $this->sanitizePago($p);
                        }
                    }
                }

                // Buscar cliente por cédula
                $cliente = null;
                if (!empty($sanitized['cedula'])) {
                    $cliente = Person::query()
                        ->withoutGlobalScopes()
                        ->where('cedula', $sanitized['cedula'])
                        ->first([
                            'id', 'cedula', 'name', 'apellido1', 'apellido2',
                            'person_type_id', 'is_active',
                        ]);
                }

                // Crédito ya existe? Verificación en 2 niveles:
                //   1. Por numero_operacion (match exacto del PDF)
                //   2. Por cedula + monto + plazo + fecha_formalizacion (mismo crédito con distinto numero)
                $creditoExistente = null;
                $duplicadoTipo = null; // 'numero_operacion' | 'datos_coinciden'

                if (!empty($sanitized['numero_operacion'])) {
                    $creditoExistente = \App\Models\Credit::query()
                        ->where('numero_operacion', $sanitized['numero_operacion'])
                        ->first(['id', 'numero_operacion', 'monto_credito', 'formalized_at', 'lead_id', 'plazo']);
                    if ($creditoExistente) $duplicadoTipo = 'numero_operacion';
                }

                // Si no encontró por numero_operacion, buscar por datos coincidentes:
                // mismo cliente + mismo monto + mismo plazo + misma fecha formalización.
                if (!$creditoExistente && $cliente && !empty($sanitized['fecha_formalizacion'])) {
                    $creditoExistente = \App\Models\Credit::query()
                        ->where('lead_id', $cliente->id)
                        ->where('monto_credito', $sanitized['monto_credito'])
                        ->where('plazo', $sanitized['plazo_meses'])
                        ->whereDate('formalized_at', $sanitized['fecha_formalizacion'])
                        ->first(['id', 'numero_operacion', 'monto_credito', 'formalized_at', 'lead_id', 'plazo']);
                    if ($creditoExistente) $duplicadoTipo = 'datos_coinciden';
                }

                // Detectar pagos duplicados: la `referencia_pago` del archivo se compara
                // contra la columna `referencia` de credit_payments (que ya existe).
                $pagosDuplicados = [];
                $referenciasFile = array_filter(array_column($pagosVinculados, 'referencia_pago'));
                if (!empty($referenciasFile)) {
                    $pagosDuplicados = \App\Models\CreditPayment::query()
                        ->whereIn('referencia', $referenciasFile)
                        ->pluck('referencia')
                        ->toArray();
                }

                // Validar campos requeridos del crédito
                $errors = [];
                foreach (self::CREDITO_REQUIRED_FIELDS as $req) {
                    if (empty($sanitized[$req]) && $sanitized[$req] !== 0 && $sanitized[$req] !== '0') {
                        $errors[] = "Falta {$req}";
                    }
                }

                // Validar cliente
                if (!empty($sanitized['cedula']) && !$cliente) {
                    $errors[] = "Cliente con cédula {$sanitized['cedula']} no existe en el sistema";
                }

                // Validar pagos
                $pagoErrors = [];
                foreach ($pagosVinculados as $idxPago => $pago) {
                    foreach (self::PAGO_REQUIRED_FIELDS as $req) {
                        if (empty($pago[$req]) && $pago[$req] !== 0 && $pago[$req] !== '0') {
                            $pagoErrors[$idxPago][] = "Falta {$req}";
                        }
                    }
                }

                $creditos[] = [
                    'source_file'        => $file->getClientOriginalName(),
                    'row_number'         => $credito['__row'] ?? null,
                    'extracted'          => $sanitized,
                    'cliente'            => $cliente ? [
                        'id'              => $cliente->id,
                        'cedula'          => $cliente->cedula,
                        'nombre_completo' => trim("{$cliente->name} {$cliente->apellido1} {$cliente->apellido2}"),
                        'person_type_id'  => $cliente->person_type_id,
                        'tipo'            => $cliente->person_type_id === 2 ? 'Cliente' : 'Lead',
                        'is_active'       => (bool) $cliente->is_active,
                    ] : null,
                    'cliente_existe'     => $cliente !== null,
                    'credito_ya_existe'  => $creditoExistente !== null,
                    'duplicado_tipo'     => $duplicadoTipo,
                    'credito_existente'  => $creditoExistente ? [
                        'id'                  => $creditoExistente->id,
                        'numero_operacion'    => $creditoExistente->numero_operacion,
                        'monto_credito'       => (float) $creditoExistente->monto_credito,
                        'fecha_formalizacion' => $creditoExistente->formalized_at?->format('Y-m-d'),
                    ] : null,
                    'pagos'              => $pagosVinculados,
                    'pagos_count'        => count($pagosVinculados),
                    'pagos_duplicados'   => array_values($pagosDuplicados),
                    'pagos_a_importar'   => count($pagosVinculados) - count($pagosDuplicados),
                    'pago_errors'        => $pagoErrors,
                    'errors'             => $errors,
                    'ready_to_import'    => empty($errors) && $cliente !== null && $creditoExistente === null,
                ];
            }
        }

        // Resumen
        $summary = [
            'total'              => count($creditos),
            'ready'              => 0,
            'cliente_faltante'   => 0,
            'credito_existente'  => 0,
            'con_errores'        => 0,
            'pagos_total'        => 0,
            'pagos_duplicados'   => 0,
            'pagos_a_importar'   => 0,
            'file_errors'        => count($fileErrors),
        ];
        foreach ($creditos as $c) {
            $summary['pagos_total']      += $c['pagos_count'];
            $summary['pagos_duplicados'] += count($c['pagos_duplicados']);
            $summary['pagos_a_importar'] += $c['pagos_a_importar'];

            if ($c['ready_to_import']) {
                $summary['ready']++;
            } elseif (!$c['cliente_existe']) {
                $summary['cliente_faltante']++;
            } elseif ($c['credito_ya_existe']) {
                $summary['credito_existente']++;
            } else {
                $summary['con_errores']++;
            }
        }

        return response()->json([
            'success'      => true,
            'summary'      => $summary,
            'creditos'     => $creditos,
            'file_errors'  => $fileErrors,
        ]);
    }

    /**
     * @param array<string, mixed> $extracted
     * @return array<string, mixed>
     */
    private function sanitizeCredito(array $extracted): array
    {
        return [
            'cedula'              => isset($extracted['cedula']) ? preg_replace('/[^0-9]/', '', (string) $extracted['cedula']) : null,
            'numero_operacion'    => isset($extracted['numero_operacion']) ? trim((string) $extracted['numero_operacion']) : null,
            'monto_credito'       => isset($extracted['monto_credito']) ? (float) preg_replace('/[^0-9.]/', '', (string) $extracted['monto_credito']) : null,
            'plazo_meses'         => isset($extracted['plazo_meses']) ? (int) $extracted['plazo_meses'] : null,
            'tasa_anual'          => isset($extracted['tasa_anual']) ? (float) preg_replace('/[^0-9.]/', '', (string) $extracted['tasa_anual']) : null,
            'cuota'               => isset($extracted['cuota']) ? (float) preg_replace('/[^0-9.]/', '', (string) $extracted['cuota']) : null,
            'fecha_formalizacion' => isset($extracted['fecha_formalizacion']) ? $this->normalizeDate((string) $extracted['fecha_formalizacion']) : null,
            'deductora_nombre'    => isset($extracted['deductora_nombre']) ? trim((string) $extracted['deductora_nombre']) : null,
            'divisa'              => isset($extracted['divisa']) ? strtoupper(trim((string) $extracted['divisa'])) : 'CRC',
            'categoria'           => isset($extracted['categoria']) ? trim((string) $extracted['categoria']) : null,
            'descripcion'         => isset($extracted['descripcion']) ? trim((string) $extracted['descripcion']) : null,
        ];
    }

    /**
     * @param array<string, mixed> $extracted
     * @return array<string, mixed>
     */
    private function sanitizePago(array $extracted): array
    {
        return [
            'cedula'             => isset($extracted['cedula']) ? preg_replace('/[^0-9]/', '', (string) $extracted['cedula']) : null,
            'numero_operacion'   => isset($extracted['numero_operacion']) ? trim((string) $extracted['numero_operacion']) : null,
            'fecha_pago'         => isset($extracted['fecha_pago']) ? $this->normalizeDate((string) $extracted['fecha_pago']) : null,
            'monto_total'        => isset($extracted['monto_total']) ? (float) preg_replace('/[^0-9.]/', '', (string) $extracted['monto_total']) : null,
            'capital'            => isset($extracted['capital']) ? (float) preg_replace('/[^0-9.]/', '', (string) $extracted['capital']) : 0.0,
            'interes_corriente'  => isset($extracted['interes_corriente']) ? (float) preg_replace('/[^0-9.]/', '', (string) $extracted['interes_corriente']) : 0.0,
            'interes_moratorio'  => isset($extracted['interes_moratorio']) ? (float) preg_replace('/[^0-9.]/', '', (string) $extracted['interes_moratorio']) : 0.0,
            'otros'              => isset($extracted['otros']) ? (float) preg_replace('/[^0-9.]/', '', (string) $extracted['otros']) : 0.0,
            'tipo_pago'          => isset($extracted['tipo_pago']) ? strtolower(trim((string) $extracted['tipo_pago'])) : 'cuota_regular',
            'numero_cuota'       => isset($extracted['numero_cuota']) ? (int) $extracted['numero_cuota'] : null,
            'referencia_pago'    => isset($extracted['referencia_pago']) ? trim((string) $extracted['referencia_pago']) : null,
            'nota'               => isset($extracted['nota']) ? trim((string) $extracted['nota']) : null,
            'row_number'         => $extracted['__row'] ?? null,
        ];
    }

    /**
     * Construye una clave para vincular pagos a su crédito.
     * Usa numero_operacion como preferencia, cédula como fallback.
     */
    private function pagoKey(array $pago): ?string
    {
        if (!empty($pago['numero_operacion'])) {
            return trim((string) $pago['numero_operacion']);
        }
        if (!empty($pago['cedula'])) {
            return preg_replace('/[^0-9]/', '', (string) $pago['cedula']);
        }
        return null;
    }

    /**
     * Crea los créditos del payload (post-preview): genera credit + plan de pagos
     * con cuota override del archivo y dispara los asientos contables en la fecha histórica.
     * Los pagos del archivo se importan y disparan sus asientos respectivos.
     */
    public function crearCreditos(Request $request): JsonResponse
    {
        $request->validate([
            'creditos'                          => 'required|array|min:1',
            'creditos.*.credito'                => 'required|array',
            'creditos.*.credito.cedula'         => 'required|string',
            'creditos.*.credito.monto_credito'  => 'required|numeric|min:0.01',
            'creditos.*.credito.plazo_meses'    => 'required|integer|min:1',
            'creditos.*.credito.tasa_anual'     => 'required|numeric|min:0',
            'creditos.*.credito.cuota'          => 'required|numeric|min:0.01',
            'creditos.*.credito.fecha_formalizacion' => 'required|date',
            'creditos.*.pagos'                  => 'sometimes|array',
        ]);

        @set_time_limit(0);
        @ini_set('memory_limit', '512M');

        $creator = new \App\Services\ImportacionCreditoCreator();
        $results = [];
        $stats = ['creados' => 0, 'fallidos' => 0, 'pagos_creados' => 0, 'pagos_saltados' => 0];

        foreach ($request->input('creditos', []) as $idx => $item) {
            $creditoData = $item['credito'] ?? [];
            $pagosData   = $item['pagos']   ?? [];

            $result = $creator->crear($creditoData, $pagosData);

            $results[] = array_merge(['index' => $idx, 'cedula' => $creditoData['cedula'] ?? null], $result);

            if ($result['success'] ?? false) {
                $stats['creados']++;
                $stats['pagos_creados'] += $result['pagos_creados'] ?? 0;
                $stats['pagos_saltados'] += $result['pagos_saltados'] ?? 0;
            } else {
                $stats['fallidos']++;
            }
        }

        return response()->json([
            'success' => true,
            'stats'   => $stats,
            'results' => $results,
        ]);
    }
}
