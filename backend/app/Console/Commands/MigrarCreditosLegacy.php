<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Client;
use App\Models\Credit;
use App\Models\Person;
use App\Services\ImportacionCreditoCreator;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Migración histórica de créditos desde la BD legacy CrediPEP (`progrex_new`,
 * conexión `legacy`) al sistema Studio.
 *
 * REUSA `ImportacionCreditoCreator::crear()` SIN MODIFICARLO: este comando solo
 * arma los arrays (creditoData / pagosData / planPagos) con la MISMA forma que
 * produce el parser de PDF y delega TODO (crédito, plan, pagos, asientos en fecha
 * histórica) al motor existente. No toca ningún otro flujo del sistema.
 *
 * Decisiones del usuario (cerradas):
 *  1. Migrar ESTADO 'A' (activas) + 'C' (canceladas). Anuladas 'N' / NULL fuera.
 *  2. numero_operacion = solo ID_SOLICITUD (el CODIGO/producto se preserva en
 *     `category` para no perder la identidad real CODIGO+ID_SOLICITUD).
 *  3. Fecha de asiento HÍBRIDA: si NUM_COMPROBANTE trae período YYYYMM
 *     (planilla coope, formato `YYYYMM.coope.CRD`) → ese mes; si no → MOV_FECHA.
 */
class MigrarCreditosLegacy extends Command
{
    protected $signature = 'migrar:creditos-legacy
        {--estado=A,C : Estados de reg_creditos a migrar (coma-separados)}
        {--codigo= : Filtrar por producto (CODIGO), ej. MCEL}
        {--id-solicitud= : Filtrar por ID_SOLICITUD exacto (pruebas)}
        {--cedula= : Filtrar por cédula}
        {--limit= : Máximo de créditos a procesar}
        {--offset=0 : Saltar N créditos (reanudar)}
        {--dry-run : No escribe nada; arma e imprime los arrays}
        {--solo-clientes : Solo crea/verifica clientes, no créditos}
        {--skip-clientes : Asume que los clientes ya existen}
        {--incluir-anomalos : Migra también créditos con monto/cuota/plazo inválidos (por defecto se saltan)}';

    protected $description = 'Migra créditos históricos desde la BD legacy CrediPEP reusando ImportacionCreditoCreator';

    /** Mapa código coope del legacy → sufijo que entiende el creator (regex PLA\d+\.SUF\.CRD). */
    private const COOPE_MAP = [
        'CSG' => 'CSG',  // CoopeSanGabriel  → Studio "Coope San Gabriel"
        'CS'  => 'CS',   // CoopeServicios   → Studio "COOPESERVICIOS"
        'CNA' => 'CN',   // CoopeNacional    → Studio "COOPENACIONAL"
    ];

    /** Fallback: reg_creditos.COD_DEDUCTORA (= instituciones.COD_INSTITUCION) → sufijo. */
    private const COD_DEDUCTORA_MAP = [
        10008 => 'CSG',
        10007 => 'CS',
        10025 => 'CN',
        10022 => 'CN',
        10036 => 'CN',
    ];

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $estados = array_filter(array_map('trim', explode(',', (string) $this->option('estado'))));

        // 1. Verificar conexión legacy
        try {
            DB::connection('legacy')->getPdo();
        } catch (\Throwable $e) {
            $this->error('No se pudo conectar a la BD legacy (conexión `legacy`): ' . $e->getMessage());
            $this->line('Configura LEGACY_DB_* en .env o asegúrate de que `progrex_new` esté disponible.');
            return self::FAILURE;
        }

        $this->info('Conexión legacy OK. Estados a migrar: ' . implode(',', $estados) . ($dryRun ? '  [DRY-RUN]' : ''));

        // 2. Query base de créditos en alcance
        $q = DB::connection('legacy')->table('reg_creditos')
            ->selectRaw("CODIGO, ID_SOLICITUD, TRIM(CEDULA) AS ced, MONTOAPR, MONTO_GIRADO, PLAZO, `INT` AS tasa, CUOTA, SALDO, TRIM(ESTADO) AS estado, COD_DEDUCTORA, FECHA_REGISTRO, FECHAFORF, FECHASOL, OBSERVACION, CATEGORIA_PERSONA")
            ->whereRaw('TRIM(ESTADO) IN (' . implode(',', array_fill(0, count($estados), '?')) . ')', $estados)
            ->orderBy('CODIGO')->orderBy('ID_SOLICITUD');

        if ($this->option('codigo'))        $q->where('CODIGO', $this->option('codigo'));
        if ($this->option('id-solicitud'))  $q->where('ID_SOLICITUD', (int) $this->option('id-solicitud'));
        if ($this->option('cedula'))        $q->whereRaw('TRIM(CEDULA) = ?', [preg_replace('/[^0-9]/', '', (string) $this->option('cedula'))]);
        if ($this->option('offset'))        $q->offset((int) $this->option('offset'));
        if ($this->option('limit'))         $q->limit((int) $this->option('limit'));

        $creditos = $q->get();
        $this->info("Créditos en alcance: {$creditos->count()}");
        if ($creditos->isEmpty()) {
            $this->warn('Nada que migrar con esos filtros.');
            return self::SUCCESS;
        }

        // 3. FASE A — asegurar clientes
        if (!$this->option('skip-clientes')) {
            $this->faseClientes($creditos->pluck('ced')->unique()->values()->all(), $dryRun);
            if ($this->option('solo-clientes')) {
                $this->info('--solo-clientes: terminado.');
                return self::SUCCESS;
            }
        }

        // 4. FASE B — créditos
        $creator = new ImportacionCreditoCreator();
        $incluirAnomalos = (bool) $this->option('incluir-anomalos');
        $stats = ['creados' => 0, 'fallidos' => 0, 'saltados' => 0, 'anomalos' => 0, 'pagos' => 0, 'asientos_ok' => 0, 'asientos_fail' => 0];
        $bar = $this->output->createProgressBar($creditos->count());
        $bar->start();

        foreach ($creditos as $rc) {
            $opLabel = "{$rc->CODIGO}/{$rc->ID_SOLICITUD}";

            try {
                [$creditoData, $pagosData, $planPagos] = $this->armarPayload($rc);
            } catch (\Throwable $e) {
                $stats['fallidos']++;
                $this->newLine();
                $this->error("[$opLabel] error armando payload: {$e->getMessage()}");
                $bar->advance();
                continue;
            }

            // Guard de sanidad: data legacy anómala (monto/cuota/plazo inválidos)
            // generaría planes/asientos basura. Por defecto se salta y se reporta.
            $motivoAnomalo = $this->motivoAnomalo($creditoData);
            if ($motivoAnomalo && !$incluirAnomalos) {
                $stats['anomalos']++;
                $this->newLine();
                $this->warn("[$opLabel] ANÓMALO ($motivoAnomalo) — saltado. Usa --incluir-anomalos para forzar.");
                $bar->advance();
                continue;
            }

            if ($dryRun) {
                $this->newLine();
                $this->line("── $opLabel ──" . ($motivoAnomalo ? " [ANÓMALO: $motivoAnomalo]" : '') . " ced={$creditoData['cedula']} monto={$creditoData['monto_credito']} plazo={$creditoData['plazo_meses']} tasa={$creditoData['tasa_anual']} cuota={$creditoData['cuota']} formaliza={$creditoData['fecha_formalizacion']}");
                $this->line("   pagos=" . count($pagosData) . "  plan_pagos=" . count($planPagos)
                    . "  | 1er pago ref=" . ($pagosData[0]['referencia_pago'] ?? '—')
                    . " fecha=" . ($pagosData[0]['fecha_pago'] ?? '—'));
                $bar->advance();
                continue;
            }

            $res = $creator->crear($creditoData, $pagosData, function (bool $ok) use (&$stats) {
                $ok ? $stats['asientos_ok']++ : $stats['asientos_fail']++;
            }, $planPagos);

            if ($res['success'] ?? false) {
                $stats['creados']++;
                $stats['pagos'] += $res['pagos_creados'] ?? 0;

                // Post-update SOLO de status según estado legacy (no toca el motor).
                $statusLegacy = match ($rc->estado) {
                    'C'     => 'Cancelado',
                    'N'     => 'Anulado',
                    default => null,
                };
                if ($statusLegacy && !empty($res['credit_id'])) {
                    Credit::where('id', $res['credit_id'])->update(['status' => $statusLegacy]);
                }
            } else {
                // "Ya existe" = idempotente (re-corrida), no es fallo real.
                if (str_contains((string) ($res['error'] ?? ''), 'Ya existe')) {
                    $stats['saltados']++;
                } else {
                    $stats['fallidos']++;
                    $this->newLine();
                    $this->error("[$opLabel] {$res['error']}");
                }
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info('Resumen migración créditos:');
        $this->table(
            ['Creados', 'Saltados (ya existían)', 'Anómalos', 'Fallidos', 'Pagos creados', 'Asientos OK', 'Asientos fail'],
            [[$stats['creados'], $stats['saltados'], $stats['anomalos'], $stats['fallidos'], $stats['pagos'], $stats['asientos_ok'], $stats['asientos_fail']]]
        );

        return $stats['fallidos'] > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * FASE A: crea los clientes (person_type_id=2) que aún no existan, desde `socios`.
     *
     * @param array<int, string> $cedulas
     */
    private function faseClientes(array $cedulas, bool $dryRun): void
    {
        $cedulasNorm = array_values(array_unique(array_filter(array_map(
            fn ($c) => preg_replace('/[^0-9]/', '', (string) $c),
            $cedulas
        ))));

        $existentes = Person::query()->withoutGlobalScopes()
            ->whereIn('cedula', $cedulasNorm)->pluck('cedula')->flip();

        $faltantes = array_values(array_filter($cedulasNorm, fn ($c) => !$existentes->has($c)));
        $this->info('Clientes: ' . count($cedulasNorm) . ' en alcance, ' . count($faltantes) . ' por crear.');

        if (empty($faltantes)) return;

        $socios = DB::connection('legacy')->table('socios as s')
            ->leftJoin('instituciones as i', 'i.COD_INSTITUCION', '=', 's.COD_INSTITUCION')
            ->selectRaw("TRIM(s.CEDULA) AS ced, s.NOMBRE, s.NOMBREV2, s.APELLIDO1, s.APELLIDO2, s.FECHA_NAC, s.SEXO, s.AF_EMAIL, s.EMAIL_02, s.DIRECCION, i.DESC_CORTA AS inst")
            ->whereRaw('TRIM(s.CEDULA) IN (' . implode(',', array_fill(0, count($faltantes), '?')) . ')', $faltantes)
            ->get()->keyBy('ced');

        // Emails ya tomados (constraint UNIQUE persons.email)
        $emailsCandidatos = array_filter($socios->map(
            fn ($s) => filter_var(strtolower(trim((string) ($s->AF_EMAIL ?: $s->EMAIL_02))), FILTER_VALIDATE_EMAIL) ?: null
        )->all());
        $emailsTomados = $emailsCandidatos
            ? array_flip(Person::query()->withoutGlobalScopes()->whereIn('email', array_unique($emailsCandidatos))->pluck('email')->all())
            : [];
        $emailsLote = [];

        $creados = 0; $sinSocio = 0;
        $bar = $this->output->createProgressBar(count($faltantes));
        $bar->start();

        foreach ($faltantes as $ced) {
            $s = $socios->get($ced);
            if (!$s) { $sinSocio++; $bar->advance(); continue; }

            $payload = $this->armarClientePayload($s, $emailsTomados, $emailsLote);

            if ($dryRun) {
                $this->newLine();
                $this->line("   [cliente] $ced  {$payload['name']} {$payload['apellido1']} {$payload['apellido2']}  email=" . ($payload['email'] ?? '—'));
            } else {
                try {
                    Client::create($payload);
                    $creados++;
                } catch (\Throwable $e) {
                    $this->newLine();
                    $this->error("   [cliente $ced] {$e->getMessage()}");
                }
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Clientes creados: $creados" . ($sinSocio ? "  (sin socio en legacy: $sinSocio)" : ''));
    }

    /**
     * Construye el payload de Client desde una fila de `socios`.
     *
     * @param object $s
     * @param array<string,int> $emailsTomados
     * @param array<string,bool> $emailsLote
     * @return array<string,mixed>
     */
    private function armarClientePayload(object $s, array $emailsTomados, array &$emailsLote): array
    {
        $payload = [
            'cedula'    => preg_replace('/[^0-9]/', '', (string) $s->ced),
            'is_active' => true,
            'name'      => $this->limpiar($s->NOMBREV2) ?: $this->derivarNombres($s),
            'apellido1' => $this->limpiar($s->APELLIDO1),
            'apellido2' => $this->limpiar($s->APELLIDO2),
        ];

        $fnac = $this->fechaValida($s->FECHA_NAC);
        if ($fnac) $payload['fecha_nacimiento'] = $fnac;

        $genero = strtoupper(trim((string) $s->SEXO));
        if ($genero === 'M') $payload['genero'] = 'Masculino';
        elseif ($genero === 'F') $payload['genero'] = 'Femenino';

        $dir = $this->limpiar($s->DIRECCION);
        if ($dir) $payload['direccion1'] = $dir;

        $inst = $this->limpiar($s->inst);
        if ($inst) $payload['institucion_labora'] = $inst;

        $email = filter_var(strtolower(trim((string) ($s->AF_EMAIL ?: $s->EMAIL_02))), FILTER_VALIDATE_EMAIL) ?: null;
        if ($email && !isset($emailsTomados[$email]) && !isset($emailsLote[$email])) {
            $emailsLote[$email] = true;
            $payload['email'] = $email;
        }

        return $payload;
    }

    /**
     * Arma los 3 arrays que espera ImportacionCreditoCreator::crear().
     *
     * @param object $rc Fila de reg_creditos
     * @return array{0:array<string,mixed>,1:array<int,array<string,mixed>>,2:array<int,array<string,mixed>>}
     */
    private function armarPayload(object $rc): array
    {
        $cedula = preg_replace('/[^0-9]/', '', (string) $rc->ced);

        // institucion_labora desde socios → instituciones.DESC_CORTA
        $inst = DB::connection('legacy')->table('socios as s')
            ->leftJoin('instituciones as i', 'i.COD_INSTITUCION', '=', 's.COD_INSTITUCION')
            ->whereRaw('TRIM(s.CEDULA) = ?', [$cedula])
            ->value('i.DESC_CORTA');

        $monto = (float) ($rc->MONTOAPR ?: $rc->MONTO_GIRADO);
        $fechaForm = $this->fechaValida($rc->FECHA_REGISTRO)
            ?: $this->fechaValida($rc->FECHAFORF)
            ?: $this->fechaValida($rc->FECHASOL)
            ?: now()->format('Y-m-d');

        $creditoData = [
            'cedula'              => $cedula,
            'numero_operacion'    => (string) $rc->ID_SOLICITUD,        // decisión 2: solo el número
            'monto_credito'       => $monto,
            'plazo_meses'         => (int) $rc->PLAZO,
            'tasa_anual'          => (float) $rc->tasa,
            'cuota'               => (float) $rc->CUOTA,
            'fecha_formalizacion' => $fechaForm,
            'institucion_labora'  => $this->limpiar($inst) ?: null,
            'categoria'           => $rc->CODIGO,                       // preserva producto (identidad real)
            'descripcion'         => trim("Migrado legacy {$rc->CODIGO}/{$rc->ID_SOLICITUD}. " . (string) $rc->OBSERVACION),
        ];

        // Sufijo coope a nivel de crédito (fallback si el pago no trae período)
        $sufijoCredito = self::COD_DEDUCTORA_MAP[(int) $rc->COD_DEDUCTORA] ?? null;

        // ── Pagos: crd_operacion_transac con MOV_MONTO > 0 ──
        $transac = DB::connection('legacy')->table('crd_operacion_transac')
            ->selectRaw("ID_SEQ, NUM_CUOTA, MOV_MONTO, MOV_PRINCIPAL, MOV_INTCOR, MOV_INTMOR, MOV_CARGOS, MOV_POLIZA, MOV_FECHA, NUM_COMPROBANTE")
            ->where('CODIGO', $rc->CODIGO)->where('ID_SOLICITUD', $rc->ID_SOLICITUD)
            ->where('MOV_MONTO', '>', 0)
            ->orderBy('MOV_FECHA')->orderBy('ID_SEQ')
            ->get();

        $pagosData = [];
        foreach ($transac as $t) {
            // Resolución de deductora — HÍBRIDO REFINADO (decisión del usuario):
            //  1. Comprobante `YYYYMM.{CSG|CS|CNA}.CRD` → esa coope (PLANILLA).
            //  2. Comprobante numérico suelto (lote inicial de planilla, ej. 4158)
            //     o vacío → deductora del crédito (reg_creditos.COD_DEDUCTORA).
            //  3. Cualquier marcador textual no-coope (M-SJ, AJ, FND, MIGRA, APL…)
            //     → null → PAGO_VENTANILLA. Nunca contamina ajustes.
            $sufijo = $this->resolverSufijo($t->NUM_COMPROBANTE);
            if ($sufijo === null && $this->esLoteNumerico($t->NUM_COMPROBANTE)) {
                $sufijo = $sufijoCredito;
            }
            $seqDigits = str_replace('.', '', number_format((float) $t->ID_SEQ, 2, '.', ''));

            // referencia_pago: única por pago Y resoluble por el regex del creator
            // (regex: /PLA\d+\.([A-Z\-]+)\.CRD/ — busca el substring en cualquier parte).
            if ($sufijo) {
                $ref = "LEG-{$rc->CODIGO}-{$rc->ID_SOLICITUD}-{$seqDigits}-PLA{$seqDigits}.{$sufijo}.CRD";
            } else {
                $ref = "LEG-{$rc->CODIGO}-{$rc->ID_SOLICITUD}-{$seqDigits}"; // no match → PAGO_VENTANILLA
            }

            $pagosData[] = [
                'referencia_pago'   => $ref,
                'fecha_pago'        => $this->fechaHibrida($t->NUM_COMPROBANTE, $t->MOV_FECHA, $fechaForm),
                'monto_total'       => (float) $t->MOV_MONTO,
                'capital'           => (float) $t->MOV_PRINCIPAL,
                'interes_corriente' => (float) $t->MOV_INTCOR,
                'interes_moratorio' => (float) $t->MOV_INTMOR,
                'poliza'            => (float) $t->MOV_POLIZA,
                'otros'             => (float) $t->MOV_CARGOS,
                'numero_cuota'      => (int) $t->NUM_CUOTA,
                'tipo_pago'         => $sufijo ? 'planilla' : 'ventanilla',
            ];
        }

        // ── Plan: crd_operacion_plan_pagos. Cuotas NO pagadas/anuladas (en tránsito + vencidas).
        //    Mismo rol que la sección "CUOTAS EN TRANSITO Y VENCIDAS" del PDF. ──
        $plan = DB::connection('legacy')->table('crd_operacion_plan_pagos')
            ->selectRaw("NUM_CUOTA, FECHA_CORTE, FECHA_PROCESO, CUOTA, PRINCIPAL, INTCOR, INTMOR, CARGOS, POLIZA, TRIM(ESTADO) AS est, MORA_DIAS")
            ->where('CODIGO', $rc->CODIGO)->where('ID_SOLICITUD', $rc->ID_SOLICITUD)
            ->whereRaw('NUM_CUOTA > 0')
            ->whereRaw("TRIM(ESTADO) IN ('A','P')")   // A = vencida/atraso, P = pendiente. C/N fuera.
            ->orderBy('NUM_CUOTA')
            ->get();

        $planPagos = [];
        foreach ($plan as $p) {
            $planPagos[] = [
                'numero_cuota'      => (int) $p->NUM_CUOTA,
                'cuota'             => (float) $p->CUOTA,
                'poliza'            => (float) $p->POLIZA,
                'cargos'            => (float) $p->CARGOS,
                'interes_corriente' => (float) $p->INTCOR,
                'interes_moratorio' => (float) $p->INTMOR,
                'amortizacion'      => (float) $p->PRINCIPAL,
                'estado'            => $p->est === 'A' ? 'Vencida' : 'Pendiente',
                'dias_mora'         => (int) $p->MORA_DIAS,
                'fecha_corte'       => $this->fechaValida($p->FECHA_CORTE),
                'proceso'           => $p->FECHA_PROCESO ? substr((string) $p->FECHA_PROCESO, 0, 6) : null,
            ];
        }

        return [$creditoData, $pagosData, $planPagos];
    }

    /**
     * Extrae el sufijo coope (CSG/CS/CN) del NUM_COMPROBANTE legacy
     * (formato `YYYYMM.CODE.CRD`). Devuelve null si no es planilla coope.
     */
    private function resolverSufijo(?string $comprobante): ?string
    {
        $c = strtoupper(trim((string) $comprobante));
        if ($c === '') return null;
        if (preg_match('/^\d{6}\.([A-Z]+)\.CRD$/', $c, $m)) {
            return self::COOPE_MAP[$m[1]] ?? null;
        }
        return null;
    }

    /**
     * Devuelve el motivo si el crédito es anómalo (data legacy incompleta que
     * generaría plan/asientos basura), o null si es sano.
     *
     * @param array<string,mixed> $c
     */
    private function motivoAnomalo(array $c): ?string
    {
        if ((float) $c['monto_credito'] <= 0)          return 'monto<=0';
        if ((float) $c['cuota'] <= 0)                  return 'cuota<=0';
        if ((int) $c['plazo_meses'] < 1)               return 'plazo<1';
        if ((float) $c['tasa_anual'] < 0)              return 'tasa<0';
        // Cuota mayor al monto total = error de captura legacy (ej. CHPT/4554)
        if ((float) $c['cuota'] > (float) $c['monto_credito']) return 'cuota>monto';
        return null;
    }

    /**
     * ¿El comprobante es un "lote numérico" (número suelto, ej. 4158/1222) o vacío?
     * En ese caso = lote inicial de planilla → se usa la deductora del crédito.
     * Los marcadores textuales no-coope (M-SJ, AJ-MIGRA, APL.FND…) NO entran aquí.
     */
    private function esLoteNumerico(?string $comprobante): bool
    {
        $c = trim((string) $comprobante);
        return $c === '' || ctype_digit($c);
    }

    /**
     * Fecha de asiento HÍBRIDA (decisión 3):
     *  - Si NUM_COMPROBANTE trae período YYYYMM (planilla coope) → último día de ese mes.
     *  - Si no → MOV_FECHA (si es válida) → si no → fecha de formalización.
     */
    private function fechaHibrida(?string $comprobante, $movFecha, string $fechaForm): string
    {
        $c = strtoupper(trim((string) $comprobante));
        if (preg_match('/^(\d{4})(\d{2})\./', $c, $m)) {
            $y = (int) $m[1]; $mo = (int) $m[2];
            if ($y >= 2000 && $y <= 2100 && $mo >= 1 && $mo <= 12) {
                return Carbon::create($y, $mo, 1)->endOfMonth()->format('Y-m-d');
            }
        }
        return $this->fechaValida($movFecha) ?: $fechaForm;
    }

    /**
     * Devuelve 'Y-m-d' si la fecha es real (descarta nulos/centinela 1899-1900),
     * o null si no lo es.
     */
    private function fechaValida($valor): ?string
    {
        if (empty($valor)) return null;
        try {
            $d = Carbon::parse((string) $valor);
        } catch (\Throwable) {
            return null;
        }
        $y = (int) $d->format('Y');
        if ($y < 1920 || $y > 2100) return null; // 1899-12-30 / 1900-01-01 = NULL de SQL Server
        return $d->format('Y-m-d');
    }

    private function limpiar($v): ?string
    {
        $v = trim((string) $v);
        return $v === '' ? null : $v;
    }

    /** Deriva nombres de pila desde NOMBRE completo quitando apellidos. */
    private function derivarNombres(object $s): ?string
    {
        $full = trim((string) $s->NOMBRE);
        $ap = trim(($s->APELLIDO1 ?? '') . ' ' . ($s->APELLIDO2 ?? ''));
        if ($ap !== '' && stripos($full, $ap) === 0) {
            return $this->limpiar(substr($full, strlen($ap)));
        }
        return $this->limpiar($full);
    }
}
