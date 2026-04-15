<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use App\Models\Lead;
use App\Models\Analisis;

class ActualizarAnalisis extends Command
{
    protected $signature = 'actualizar:analisis
                            {archivo : Ruta al archivo .xlsx}
                            {--dry-run : Solo valida sin modificar}';

    protected $description = 'Actualiza analisis existentes y carga manchas, juicios y embargos desde Excel (4 hojas: ANALISIS, MANCHAS, JUICIOS, EMBARGOS)';

    private array $actualizados = [];
    private array $errores      = [];

    public function handle(): int
    {
        $archivo = $this->argument('archivo');
        $dryRun  = $this->option('dry-run');

        if (!file_exists($archivo)) {
            $this->error("Archivo no encontrado: {$archivo}");
            return 1;
        }

        $this->info("Leyendo: {$archivo}");

        if ($dryRun) {
            $this->warn('⚠  MODO DRY-RUN — no se modificará nada en la BD.');
        }

        $spreadsheet = IOFactory::load($archivo);

        // Leer las 4 hojas
        $filasAnalisis = $this->leerHoja($spreadsheet, 'ANALISIS');
        $filasManchas  = $this->leerHoja($spreadsheet, 'MANCHAS');
        $filasJuicios  = $this->leerHoja($spreadsheet, 'JUICIOS');
        $filasEmbargos = $this->leerHoja($spreadsheet, 'EMBARGOS');

        if (empty($filasAnalisis)) {
            $this->error('No se encontraron filas en la hoja ANALISIS.');
            return 1;
        }

        // Agrupar detalle por cédula para acceso rápido
        $manchasPorCedula  = $this->agruparPorCedula($filasManchas);
        $juiciosPorCedula  = $this->agruparPorCedula($filasJuicios);
        $embargosPorCedula = $this->agruparPorCedula($filasEmbargos);

        $this->info('Filas ANALISIS : ' . count($filasAnalisis));
        $this->info('Filas MANCHAS  : ' . count($filasManchas));
        $this->info('Filas JUICIOS  : ' . count($filasJuicios));
        $this->info('Filas EMBARGOS : ' . count($filasEmbargos));
        $this->newLine();

        $bar = $this->output->createProgressBar(count($filasAnalisis));
        $bar->start();

        foreach ($filasAnalisis as $numFila => $fila) {
            try {
                DB::transaction(function () use ($fila, $numFila, $dryRun, $manchasPorCedula, $juiciosPorCedula, $embargosPorCedula) {
                    $this->procesarFila($fila, $numFila, $dryRun, $manchasPorCedula, $juiciosPorCedula, $embargosPorCedula);
                });
            } catch (\Throwable $e) {
                $this->errores[] = [
                    'fila'   => $numFila,
                    'cedula' => $fila['cedula'] ?? '?',
                    'error'  => $e->getMessage(),
                ];
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->imprimirResumen();

        return empty($this->errores) ? 0 : 1;
    }

    // ─── Procesamiento ──────────────────────────────────────────────────────────

    private function procesarFila(
        array $fila,
        int   $numFila,
        bool  $dryRun,
        array $manchasPorCedula,
        array $juiciosPorCedula,
        array $embargosPorCedula
    ): void {
        $cedula = trim($fila['cedula'] ?? '');
        // Acepta 'referencia_oportunidad' (nombre canónico) o el alias legacy 'referencia_analisis'
        $anaRef = trim($fila['referencia_oportunidad'] ?? $fila['referencia_analisis'] ?? $fila['analisis_reference'] ?? '');

        // ── Localizar analisis ──────────────────────────────────────────────────
        // Prioridad 1: cédula + referencia oportunidad (evita ambigüedad si una persona tiene varios analisis)
        // Prioridad 2: solo referencia oportunidad (opportunity_id es único por analisis)
        // Prioridad 3: solo cédula (toma el analisis más reciente del lead)
        $analisis = null;

        if ($cedula && $anaRef) {
            $lead = Lead::withoutGlobalScope('is_lead')->where('cedula', $cedula)->first();
            if ($lead) {
                $analisis = Analisis::where('lead_id', $lead->id)
                    ->where('opportunity_id', $anaRef)
                    ->first();
            }
        }

        if (!$analisis && $anaRef) {
            $analisis = Analisis::where('opportunity_id', $anaRef)->first();
        }

        if (!$analisis && $cedula) {
            $lead = Lead::withoutGlobalScope('is_lead')->where('cedula', $cedula)->first();
            if ($lead) {
                // Si hay múltiples analisis para este lead, toma el más reciente
                $analisis = Analisis::where('lead_id', $lead->id)
                    ->orderByDesc('id')
                    ->first();
            }
        }

        if (!$analisis) {
            throw new \InvalidArgumentException(
                "No se encontró analisis para cedula='{$cedula}'" . ($anaRef ? " / referencia='{$anaRef}'" : '')
            );
        }

        // ── Campos a actualizar en analisis ────────────────────────────────────
        $updateData = $this->mapearActualizacion($fila);

        // ── Detalle por cédula ──────────────────────────────────────────────────
        $manchas  = $manchasPorCedula[$cedula]  ?? [];
        $juicios  = $juiciosPorCedula[$cedula]  ?? [];
        $embargos = $embargosPorCedula[$cedula] ?? [];

        // Sincronizar contadores con lo que realmente se va a insertar
        if (!empty($manchas))  $updateData['numero_manchas']  = count($manchas);
        if (!empty($juicios))  $updateData['numero_juicios']  = count($juicios);
        if (!empty($embargos)) $updateData['numero_embargos'] = count($embargos);

        if (!$dryRun) {
            // Actualizar analisis (solo campos con valor en el Excel)
            if (!empty($updateData)) {
                $updateData['updated_at'] = now();
                DB::table('analisis')->where('id', $analisis->id)->update($updateData);
            }

            // Sincronizar monto_sugerido → opportunity.amount
            if (!empty($updateData['monto_sugerido']) && $analisis->opportunity_id) {
                DB::table('opportunities')
                    ->where('id', $analisis->opportunity_id)
                    ->update(['amount' => $updateData['monto_sugerido'], 'updated_at' => now()]);
            }

            // Manchas: borrar las existentes y reinsertar
            if (!empty($manchas)) {
                DB::table('mancha_detalles')->where('analisis_id', $analisis->id)->delete();
                foreach ($manchas as $m) {
                    $fechaInicio = $this->fecha($m['fecha_inicio'] ?? null);
                    if (!$fechaInicio) {
                        // fecha_inicio es NOT NULL — usar hoy como fallback
                        $fechaInicio = now()->toDateString();
                    }
                    DB::table('mancha_detalles')->insert([
                        'analisis_id'  => $analisis->id,
                        'fecha_inicio' => $fechaInicio,
                        'fecha_fin'    => $this->fecha($m['fecha_fin'] ?? null),
                        'descripcion'  => trim($m['descripcion'] ?? ''),
                        'monto'        => $this->numero($m['monto'] ?? 0),
                        'created_at'   => now(),
                        'updated_at'   => now(),
                    ]);
                }
            }

            // Juicios
            if (!empty($juicios)) {
                DB::table('juicio_detalles')->where('analisis_id', $analisis->id)->delete();
                foreach ($juicios as $j) {
                    $fechaInicio = $this->fecha($j['fecha_inicio'] ?? null);
                    if (!$fechaInicio) {
                        $fechaInicio = now()->toDateString();
                    }
                    DB::table('juicio_detalles')->insert([
                        'analisis_id'  => $analisis->id,
                        'fecha_inicio' => $fechaInicio,
                        'fecha_fin'    => $this->fecha($j['fecha_fin'] ?? null),
                        'estado'       => trim($j['estado'] ?? 'activo') ?: 'activo',
                        'expediente'   => trim($j['expediente'] ?? '') ?: null,
                        'monto'        => $this->numero($j['monto'] ?? 0),
                        'created_at'   => now(),
                        'updated_at'   => now(),
                    ]);
                }
            }

            // Embargos
            if (!empty($embargos)) {
                DB::table('embargo_detalles')->where('analisis_id', $analisis->id)->delete();
                foreach ($embargos as $e) {
                    $fechaInicio = $this->fecha($e['fecha_inicio'] ?? null);
                    if (!$fechaInicio) {
                        $fechaInicio = now()->toDateString();
                    }
                    DB::table('embargo_detalles')->insert([
                        'analisis_id'  => $analisis->id,
                        'fecha_inicio' => $fechaInicio,
                        'fecha_fin'    => $this->fecha($e['fecha_fin'] ?? null),
                        'motivo'       => trim($e['motivo'] ?? '') ?: null,
                        'monto'        => $this->numero($e['monto'] ?? 0),
                        'created_at'   => now(),
                        'updated_at'   => now(),
                    ]);
                }
            }
        }

        $this->actualizados[] = [
            'fila'        => $numFila,
            'cedula'      => $cedula,
            'analisis_id' => $analisis->id,
            'manchas'     => count($manchas),
            'juicios'     => count($juicios),
            'embargos'    => count($embargos),
        ];
    }

    // ─── Mapeo de campos ────────────────────────────────────────────────────────

    private function mapearActualizacion(array $f): array
    {
        $data = [];

        // Campos numéricos (decimales)
        $numericos = [
            'ingreso_bruto', 'ingreso_neto',
            'ingreso_bruto_2', 'ingreso_neto_2',
            'ingreso_bruto_3', 'ingreso_neto_3',
            'ingreso_bruto_4', 'ingreso_neto_4',
            'ingreso_bruto_5', 'ingreso_neto_5',
            'ingreso_bruto_6', 'ingreso_neto_6',
            'ingreso_bruto_7', 'ingreso_neto_7',
            'ingreso_bruto_8', 'ingreso_neto_8',
            'ingreso_bruto_9', 'ingreso_neto_9',
            'ingreso_bruto_10', 'ingreso_neto_10',
            'ingreso_bruto_11', 'ingreso_neto_11',
            'ingreso_bruto_12', 'ingreso_neto_12',
            'monto_solicitado', 'monto_sugerido', 'cuota',
        ];

        foreach ($numericos as $campo) {
            $v = $f[$campo] ?? null;
            if ($v !== null && trim((string)$v) !== '') {
                $data[$campo] = $this->numero($v);
            }
        }

        // Enteros
        foreach (['plazo', 'numero_manchas', 'numero_juicios', 'numero_embargos'] as $campo) {
            $v = $f[$campo] ?? null;
            if ($v !== null && trim((string)$v) !== '') {
                $data[$campo] = (int)$v;
            }
        }

        // Textos cortos / largos
        $textos = [
            'cargo', 'nombramiento', 'propuesta', 'description',
            'estado_pep', 'estado_cliente', 'divisa', 'category',
        ];

        foreach ($textos as $campo) {
            $v = $f[$campo] ?? null;
            if ($v !== null && trim((string)$v) !== '') {
                $data[$campo] = trim((string)$v);
            }
        }

        return $data;
    }

    // ─── Lectura de hojas ───────────────────────────────────────────────────────

    private function leerHoja(\PhpOffice\PhpSpreadsheet\Spreadsheet $spreadsheet, string $nombre): array
    {
        $sheet = $spreadsheet->getSheetByName($nombre);

        if (!$sheet) {
            $this->warn("Hoja '{$nombre}' no encontrada — se omite.");
            return [];
        }

        $rows = $sheet->toArray(null, true, true, false);

        if (count($rows) < 2) {
            return [];
        }

        $headers = array_map(fn($h) => $this->normalizarHeader($h), $rows[0]);
        $filas   = [];

        foreach (array_slice($rows, 1) as $idx => $row) {
            // Ignorar filas completamente vacías
            $row = array_map(fn($v) => $v === null ? '' : $v, $row);
            if (empty(array_filter($row, fn($v) => trim((string)$v) !== ''))) {
                continue;
            }
            $fila = array_combine($headers, $row);
            $filas[$idx + 2] = $fila;
        }

        return $filas;
    }

    private function agruparPorCedula(array $filas): array
    {
        $grupos = [];
        foreach ($filas as $fila) {
            $cedula = trim($fila['cedula'] ?? '');
            if (!$cedula) continue;
            $grupos[$cedula][] = $fila;
        }
        return $grupos;
    }

    private function normalizarHeader(?string $h): string
    {
        if (!$h) return '';
        $h = trim(str_replace(['*', '(nombre)', '(1=Si, 0=No)'], '', $h));
        $h = mb_strtolower($h, 'UTF-8');
        $h = preg_replace('/\s+/', '_', $h);
        return $h;
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private function numero(mixed $v): float
    {
        if ($v === null || $v === '') return 0.0;
        return (float) preg_replace('/[^\d.]/', '', str_replace(',', '', (string)$v));
    }

    private function fecha(mixed $v): ?string
    {
        if (!$v || trim((string)$v) === '' || trim((string)$v) === '0') return null;
        $str = trim((string)$v);

        // Numérico de Excel
        if (is_numeric($str)) {
            try {
                return \Carbon\Carbon::instance(
                    \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float)$str)
                )->toDateString();
            } catch (\Throwable) {}
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $str)) return $str;
        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $str, $m)) return "{$m[3]}-{$m[2]}-{$m[1]}";

        try {
            return \Carbon\Carbon::parse($str)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    // ─── Resumen ────────────────────────────────────────────────────────────────

    private function imprimirResumen(): void
    {
        $this->info('══════════════════════════════════════════════');
        $this->info('  RESUMEN DE ACTUALIZACIÓN');
        $this->info('══════════════════════════════════════════════');
        $this->info('  ✅ Actualizados : ' . count($this->actualizados));
        $this->error('  ❌ Errores     : ' . count($this->errores));
        $this->info('══════════════════════════════════════════════');

        if (!empty($this->errores)) {
            $this->newLine();
            $this->error('DETALLE DE ERRORES:');
            $this->table(
                ['Fila', 'Cédula', 'Error'],
                array_map(fn($e) => [$e['fila'], $e['cedula'], $e['error']], $this->errores)
            );
        }

        if (!empty($this->actualizados)) {
            $this->newLine();
            $this->info('REGISTROS ACTUALIZADOS:');
            $this->table(
                ['Fila', 'Cédula', 'Analisis ID', 'Manchas', 'Juicios', 'Embargos'],
                array_map(fn($i) => [
                    $i['fila'], $i['cedula'], $i['analisis_id'],
                    $i['manchas'], $i['juicios'], $i['embargos'],
                ], $this->actualizados)
            );
        }
    }
}
