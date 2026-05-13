<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
        $records = [];

        foreach ($uploadedFiles as $file) {
            try {
                $parsedList = $parser->parse($file);
            } catch (\Throwable $e) {
                Log::error('ImportacionController: error al parsear archivo', [
                    'error' => $e->getMessage(),
                    'file'  => $file->getClientOriginalName(),
                ]);
                $records[] = [
                    'source_file' => $file->getClientOriginalName(),
                    'error'       => $e->getMessage(),
                    'extracted'   => [],
                    'filled'      => [],
                    'missing'     => [],
                    'already_exists' => false,
                    'existing'       => null,
                ];
                continue;
            }

            foreach ($parsedList as $rowIdx => $extracted) {
                $records[] = $this->buildRecordPreview(
                    $file->getClientOriginalName(),
                    $rowIdx + 1,
                    $extracted
                );
            }
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
     * @return array<string, mixed>
     */
    private function buildRecordPreview(string $sourceFile, int $rowNumber, array $extracted): array
    {
        $sanitized = $this->sanitizeExtracted($extracted);

        $existing = null;
        if (!empty($sanitized['cedula'])) {
            $existing = Person::query()
                ->withoutGlobalScopes()
                ->where('cedula', $sanitized['cedula'])
                ->first([
                    'id', 'cedula', 'name', 'apellido1', 'apellido2', 'person_type_id',
                    'email', 'phone', 'is_active',
                ]);
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

    public function crearCliente(Request $request): JsonResponse
    {
        return response()->json([
            'message' => 'Endpoint de creación aún no implementado en esta fase.',
        ], 501);
    }
}
