<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use App\Models\Lead;
use App\Models\Opportunity;
use App\Models\Analisis;
use App\Models\Credit;
use App\Models\Deductora;
use App\Models\LoanConfiguration;

class ImportarCargaMasiva extends Command
{
    protected $signature = 'importar:carga-masiva
                            {archivo : Ruta al archivo .xlsx o .csv}
                            {--dry-run : Solo valida, no inserta}
                            {--fila= : Insertar solo la fila N (para debug)}';

    protected $description = 'Importa leads, oportunidades, análisis y créditos desde la plantilla de carga masiva';

    private array $errores   = [];
    private array $insertados = [];
    private array $omitidos  = [];

    public function handle(): int
    {
        $archivo = $this->argument('archivo');
        $dryRun  = $this->option('dry-run');
        $soloFila = $this->option('fila') ? (int) $this->option('fila') : null;

        if (!file_exists($archivo)) {
            $this->error("Archivo no encontrado: {$archivo}");
            return 1;
        }

        $this->info("Leyendo: {$archivo}");
        $filas = $this->leerArchivo($archivo);

        if (empty($filas)) {
            $this->error('No se encontraron filas de datos.');
            return 1;
        }

        $this->info('Filas encontradas: ' . count($filas));
        if ($dryRun) {
            $this->warn('⚠  MODO DRY-RUN — no se insertará nada.');
        }

        $bar = $this->output->createProgressBar(count($filas));
        $bar->start();

        foreach ($filas as $numFila => $fila) {
            if ($soloFila && $numFila !== $soloFila) {
                $bar->advance();
                continue;
            }

            try {
                DB::transaction(function () use ($fila, $numFila, $dryRun) {
                    $this->procesarFila($fila, $numFila, $dryRun);
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

    // ─── LECTURA ────────────────────────────────────────────────────────────────

    private function leerArchivo(string $ruta): array
    {
        $ext = strtolower(pathinfo($ruta, PATHINFO_EXTENSION));

        if ($ext === 'csv') {
            return $this->leerCsv($ruta);
        }

        // xlsx / xls
        $spreadsheet = IOFactory::load($ruta);
        $sheet = $spreadsheet->getSheetByName('DATOS') ?? $spreadsheet->getActiveSheet();
        $rows  = $sheet->toArray(null, true, true, false);

        // Fila 1 = banners de sección, Fila 2 = encabezados, Fila 3+ = datos
        if (count($rows) < 3) return [];

        $headers = array_map(fn($h) => $this->normalizarHeader($h), $rows[1]);
        $filas   = [];

        foreach (array_slice($rows, 2) as $idx => $row) {
            $fila = array_combine($headers, $row);
            // Omitir filas completamente vacías
            if (empty(array_filter($fila))) continue;
            $filas[$idx + 3] = $fila; // número de fila real en Excel
        }

        return $filas;
    }

    private function leerCsv(string $ruta): array
    {
        $handle = fopen($ruta, 'r');
        $rows   = [];
        while (($row = fgetcsv($handle)) !== false) {
            $rows[] = $row;
        }
        fclose($handle);

        if (count($rows) < 2) return [];

        $headers = array_map(fn($h) => $this->normalizarHeader($h), $rows[0]);
        $filas   = [];

        foreach (array_slice($rows, 1) as $idx => $row) {
            $fila = array_combine($headers, $row);
            if (empty(array_filter($fila))) continue;
            $filas[$idx + 2] = $fila;
        }

        return $filas;
    }

    private function normalizarHeader(?string $header): string
    {
        if (!$header) return '';
        // Quitar asteriscos, espacios extras, pasar a snake_case básico
        $h = trim(str_replace(['*', '(nombre)', '(1=Si, 0=No)'], '', $header));
        $h = mb_strtolower($h);
        $h = preg_replace('/\s+/', '_', $h);
        return $h;
    }

    // ─── PROCESAMIENTO POR FILA ─────────────────────────────────────────────────

    private function procesarFila(array $fila, int $numFila, bool $dryRun): void
    {
        $cedula = trim($fila['cedula'] ?? '');
        if (!$cedula) {
            throw new \InvalidArgumentException('Cedula vacía.');
        }

        // ── 1. LEAD ─────────────────────────────────────────────────────────────
        // Buscar sin Global Scope para encontrar también clientes (person_type_id=2)
        $lead = Lead::withoutGlobalScope('is_lead')->where('cedula', $cedula)->first();

        if (!$lead) {
            $leadData = $this->mapearLead($fila);
            if (!$dryRun) {
                $lead = Lead::create($leadData);
            } else {
                $lead = new Lead($leadData);
                $lead->id = 0; // placeholder para dry-run
            }
        }

        // ── 2. OPORTUNIDAD ──────────────────────────────────────────────────────
        $oppData = $this->mapearOportunidad($fila, $cedula);

        $opp = null;
        if (!$dryRun) {
            $opp = Opportunity::create($oppData);
        } else {
            $opp = new Opportunity($oppData);
            $opp->id = 'DRY-RUN';
        }

        // ── 3. ANÁLISIS ─────────────────────────────────────────────────────────
        $analisisData = $this->mapearAnalisis($fila, $lead->id, $dryRun ? 'DRY-RUN' : $opp->id);

        $analisis = null;
        if (!$dryRun) {
            $analisis = Analisis::create($analisisData);
        }

        // ── 4. CRÉDITO ──────────────────────────────────────────────────────────
        $creditData = $this->mapearCredito($fila, $lead->id, $dryRun ? 'DRY-RUN' : $opp->id);

        if (!$dryRun) {
            Credit::create($creditData);
        }

        $this->insertados[] = [
            'fila'    => $numFila,
            'cedula'  => $cedula,
            'nombre'  => trim(($fila['nombre'] ?? '') . ' ' . ($fila['apellido1'] ?? '')),
            'lead_id' => $lead->id ?? 'new',
            'opp_id'  => $dryRun ? 'DRY-RUN' : $opp->id,
        ];
    }

    // ─── MAPEOS ─────────────────────────────────────────────────────────────────

    private function mapearLead(array $f): array
    {
        return array_filter([
            'cedula'             => trim($f['cedula'] ?? ''),
            'email'              => trim($f['email'] ?? ''),
            'phone'              => trim($f['telefono'] ?? $f['telefono_principal'] ?? ''),
            'name'               => trim($f['nombre'] ?? ''),
            'apellido1'          => trim($f['apellido1'] ?? ''),
            'apellido2'          => trim($f['apellido2'] ?? ''),
            'fecha_nacimiento'   => $this->fecha($f['fecha_nacimiento'] ?? ''),
            'genero'             => trim($f['genero'] ?? ''),
            'estado_civil'       => trim($f['estado_civil'] ?? ''),
            'nacionalidad'       => trim($f['nacionalidad'] ?? ''),
            'whatsapp'           => trim($f['whatsapp'] ?? ''),
            'tel_casa'           => trim($f['tel._casa'] ?? $f['tel_casa'] ?? ''),
            'province'           => trim($f['provincia'] ?? ''),
            'canton'             => trim($f['canton'] ?? ''),
            'distrito'           => trim($f['distrito'] ?? ''),
            'direccion1'         => trim($f['direccion'] ?? $f['direccion1'] ?? ''),
            'ocupacion'          => trim($f['ocupacion'] ?? ''),
            'institucion_labora' => trim($f['institucion_laboral'] ?? ''),
            'puesto'             => trim($f['puesto'] ?? ''),
            'estado_puesto'      => trim($f['estado_puesto'] ?? ''),
            'sector'             => trim($f['sector'] ?? ''),
            'nivel_academico'    => trim($f['nivel_academico'] ?? ''),
            'profesion'          => trim($f['profesion'] ?? ''),
            'source'             => trim($f['fuente'] ?? $f['source'] ?? ''),
            'person_type_id'     => 1,
            'status'             => 'Nuevo',
            'is_active'          => true,
        ], fn($v) => $v !== '' && $v !== null);
    }

    private function mapearOportunidad(array $f, string $cedula): array
    {
        return array_filter([
            'lead_cedula'        => $cedula,
            'amount'             => $this->numero($f['monto_solicitado'] ?? $f['opp_amount'] ?? 0),
            'opportunity_type'   => trim($f['tipo_oportunidad'] ?? $f['opp_type'] ?? 'Credito Personal'),
            'vertical'           => trim($f['vertical/institucion'] ?? $f['opp_vertical'] ?? ''),
            'status'             => trim($f['estado_oportunidad'] ?? $f['opp_status'] ?? 'Pendiente'),
            'expected_close_date'=> $this->fecha($f['fecha_cierre_esperada'] ?? $f['opp_close_date'] ?? ''),
            'comments'           => trim($f['comentarios_opp.'] ?? $f['opp_comments'] ?? ''),
        ], fn($v) => $v !== '' && $v !== null);
    }

    private function mapearAnalisis(array $f, int $leadId, string $oppId): array
    {
        $cedula = trim($f['cedula'] ?? '');
        $nombre = trim(($f['nombre'] ?? '') . ' ' . ($f['apellido1'] ?? ''));
        return array_filter([
            'lead_id'          => $leadId,
            'opportunity_id'   => $oppId,
            'reference'        => 'ANA-' . strtoupper(substr(md5($cedula . now()->timestamp . rand()), 0, 8)),
            'title'            => "Análisis - {$nombre}",
            'monto_solicitado' => $this->numero($f['monto_analisis'] ?? $f['ana_monto_solicitado'] ?? 0),
            'monto_sugerido'   => $this->numero($f['monto_sugerido'] ?? $f['ana_monto_sugerido'] ?? $f['monto_analisis'] ?? $f['ana_monto_solicitado'] ?? 0),
            'plazo'            => (int) ($f['plazo_(meses)'] ?? $f['ana_plazo'] ?? 0),
            'cuota'            => $this->numero($f['cuota_estimada'] ?? $f['ana_cuota'] ?? 0),
            'divisa'           => trim($f['divisa'] ?? $f['ana_divisa'] ?? 'CRC'),
            'ingreso_bruto'    => $this->numero($f['ingreso_bruto'] ?? $f['ana_ingreso_bruto'] ?? 0),
            'ingreso_neto'     => $this->numero($f['ingreso_neto'] ?? $f['ana_ingreso_neto'] ?? 0),
            'ingreso_bruto_2'  => $this->numero($f['ingreso_bruto_2'] ?? $f['ana_ingreso_bruto_2'] ?? 0),
            'ingreso_neto_2'   => $this->numero($f['ingreso_neto_2'] ?? $f['ana_ingreso_neto_2'] ?? 0),
            'ingreso_bruto_3'  => $this->numero($f['ingreso_bruto_3'] ?? $f['ana_ingreso_bruto_3'] ?? 0),
            'ingreso_neto_3'   => $this->numero($f['ingreso_neto_3'] ?? $f['ana_ingreso_neto_3'] ?? 0),
            'cargo'            => trim($f['cargo_credid'] ?? $f['ana_cargo'] ?? ''),
            'nombramiento'     => trim($f['nombramiento'] ?? $f['ana_nombramiento'] ?? ''),
            'numero_manchas'   => (int) ($f['num._manchas'] ?? $f['ana_numero_manchas'] ?? 0),
            'numero_juicios'   => (int) ($f['num._juicios'] ?? $f['ana_numero_juicios'] ?? 0),
            'numero_embargos'  => (int) ($f['num._embargos'] ?? $f['ana_numero_embargos'] ?? 0),
            'estado_pep'       => trim($f['estado_pep'] ?? $f['ana_estado_pep'] ?? 'Pendiente'),
            'propuesta'        => trim($f['propuesta'] ?? $f['ana_propuesta'] ?? ''),
            'description'      => trim($f['descripcion_analisis'] ?? $f['ana_description'] ?? ''),
            'opened_at'        => now()->toDateString(),
        ], fn($v) => $v !== '' && $v !== null && $v !== 0);
    }

    private function mapearCredito(array $f, int $leadId, string $oppId): array
    {
        // Resolver deductora
        $deductoraId = null;
        $deductoraName = trim($f['deductora_(nombre)'] ?? $f['cred_deductora'] ?? '');
        if ($deductoraName) {
            $deductora = Deductora::where('nombre', 'like', "%{$deductoraName}%")->first();
            $deductoraId = $deductora?->id;
        }

        // Resolver tasa_id desde LoanConfiguration
        $tipoCredito = trim($f['tipo_credito'] ?? $f['cred_tipo'] ?? 'Personal');
        $config = LoanConfiguration::where('tipo', $tipoCredito)->where('activo', true)->first()
               ?? LoanConfiguration::where('activo', true)->first();
        $tasaId = $config?->tasa_id ?? \App\Models\Tasa::vigente(now())->first()?->id;

        if (!$tasaId) {
            throw new \InvalidArgumentException('No se encontró tasa vigente. Verifique la configuración de tasas.');
        }

        $tasaAnual = $this->numero($f['tasa_anual_%'] ?? $f['cred_tasa_anual'] ?? 0);
        $cedula = trim($f['cedula'] ?? '');
        $nombre = trim(($f['nombre'] ?? '') . ' ' . ($f['apellido1'] ?? ''));

        return array_filter([
            'lead_id'                 => $leadId,
            'opportunity_id'          => $oppId,
            'reference'               => 'CRED-' . strtoupper(substr(md5($cedula . now()->timestamp . rand()), 0, 8)),
            'title'                   => "Crédito - {$nombre}",
            'monto_credito'           => $this->numero($f['monto_credito'] ?? $f['cred_monto'] ?? 0),
            'cuota'                   => $this->numero($f['cuota'] ?? $f['cred_cuota'] ?? 0),
            'plazo'                   => (int) ($f['plazo_(meses)_2'] ?? $f['plazo_(meses)'] ?? $f['cred_plazo'] ?? 0),
            'tasa_id'                 => $tasaId,
            'tasa_anual'              => $tasaAnual ?: null,
            'tipo_credito'            => $tipoCredito,
            'deductora_id'            => $deductoraId,
            'poliza'                  => isset($f['poliza_(1=si,_0=no)']) ? (bool)(int)$f['poliza_(1=si,_0=no)'] : (isset($f['cred_poliza']) ? (bool)(int)$f['cred_poliza'] : false),
            'garantia'                => trim($f['garantia'] ?? $f['cred_garantia'] ?? ''),
            'status'                  => trim($f['estado_credito'] ?? $f['cred_status'] ?? 'Activo'),
            'description'             => trim($f['descripcion_credito'] ?? $f['cred_description'] ?? ''),
            'formalized_at'           => $this->fecha($f['fecha_formalizacion'] ?? $f['cred_formalized_at'] ?? ''),
            'fecha_culminacion_credito'=> $this->fecha($f['fecha_vencimiento'] ?? $f['cred_fecha_culminacion'] ?? ''),
            'opened_at'               => now()->toDateString(),
        ], fn($v) => $v !== '' && $v !== null);
    }

    // ─── HELPERS ────────────────────────────────────────────────────────────────

    private function numero(mixed $v): float
    {
        if ($v === null || $v === '') return 0;
        return (float) preg_replace('/[^\d.]/', '', str_replace(',', '', (string) $v));
    }

    private function fecha(mixed $v): ?string
    {
        if (!$v) return null;
        $str = trim((string) $v);
        if (!$str) return null;
        // Soporte YYYY-MM-DD y DD/MM/YYYY
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $str)) return $str;
        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $str, $m)) {
            return "{$m[3]}-{$m[2]}-{$m[1]}";
        }
        try {
            return \Carbon\Carbon::parse($str)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    // ─── RESUMEN ────────────────────────────────────────────────────────────────

    private function imprimirResumen(): void
    {
        $this->info("══════════════════════════════════════");
        $this->info("  RESUMEN DE IMPORTACIÓN");
        $this->info("══════════════════════════════════════");
        $this->info("  ✅ Insertados : " . count($this->insertados));
        $this->warn("  ⚠  Omitidos  : " . count($this->omitidos));
        $this->error("  ❌ Errores   : " . count($this->errores));
        $this->info("══════════════════════════════════════");

        if (!empty($this->errores)) {
            $this->newLine();
            $this->error('DETALLE DE ERRORES:');
            $headers = ['Fila', 'Cédula', 'Error'];
            $rows    = array_map(fn($e) => [$e['fila'], $e['cedula'], $e['error']], $this->errores);
            $this->table($headers, $rows);
        }

        if (!empty($this->insertados)) {
            $this->newLine();
            $this->info('REGISTROS INSERTADOS:');
            $headers = ['Fila', 'Cédula', 'Nombre', 'Lead ID', 'Opp ID'];
            $rows    = array_map(fn($i) => [$i['fila'], $i['cedula'], $i['nombre'], $i['lead_id'], $i['opp_id']], $this->insertados);
            $this->table($headers, $rows);
        }
    }
}
