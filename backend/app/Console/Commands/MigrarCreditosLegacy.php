<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Client;
use App\Models\Credit;
use App\Models\CreditPayment;
use App\Models\Opportunity;
use App\Models\Person;
use App\Models\PlanDePago;
use App\Models\Tasa;
use App\Traits\AccountingTrigger;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Migración histórica de créditos desde la BD legacy CrediPEP (`progrex_new`,
 * conexión `legacy`) al sistema Studio.
 *
 * v2 (COPIA FIEL): copia 1:1 el plan de pagos legacy (incluyendo sub-líneas
 * X.00 / X.01 / X.02 por cuota) y rellena los campos `movimiento_*` con
 * los pagos reales (JOIN por ID_SEQ). NUNCA usa fórmula francesa.
 *
 * Decisiones del usuario (cerradas):
 *  1. Migrar ESTADO 'A' (activas) + 'C' (canceladas). Anuladas 'N' fuera por defecto.
 *  2. numero_operacion = solo ID_SOLICITUD. CODIGO preservado en `category`.
 *  3. Fecha asiento HÍBRIDA: período YYYYMM del comprobante (planilla coope)
 *     o MOV_FECHA (ventanilla). Decisión confirmada.
 *  4. Deductora HÍBRIDO REFINADO: coope del comprobante → esa coope;
 *     numérico suelto → deductora del crédito; M-SJ/AJ/FND → ventanilla.
 *  5. Plan = COPIA 1:1 del SQL — una fila de Studio plan_de_pagos por cada
 *     fila de crd_operacion_plan_pagos (preservando ID_SEQ en `linea`).
 *
 * NO modifica `ImportacionCreditoCreator` (intacto para flujo PDF).
 * Usa el trait `AccountingTrigger` directamente para los asientos históricos.
 */
class MigrarCreditosLegacy extends Command
{
    use AccountingTrigger;

    protected $signature = 'migrar:creditos-legacy
        {--estado=A,C : Estados de reg_creditos a migrar (coma-separados)}
        {--codigo= : Filtrar por producto (CODIGO), ej. MCEL}
        {--id-solicitud= : Filtrar por ID_SOLICITUD exacto (pruebas)}
        {--cedula= : Filtrar por cédula}
        {--limit= : Máximo de créditos a procesar}
        {--offset=0 : Saltar N créditos (reanudar)}
        {--dry-run : No escribe nada; muestra resumen estructural por crédito}
        {--solo-clientes : Solo crea/verifica clientes, no créditos}
        {--skip-clientes : Asume que los clientes ya existen}
        {--sin-asientos : Crea credit + plan + pagos en Studio pero NO dispara asientos al ERP (para pruebas locales)}
        {--reemplazar : Si el crédito ya existe, lo borra (plan + pagos + credit) y lo recrea (Studio-side; los asientos ERP existentes NO se borran)}';

    protected $description = 'Migra créditos históricos desde la BD legacy CrediPEP — copia 1:1 del plan + pagos (v2)';

    /** Sufijos coope reconocidos en el comprobante legacy → key del map del trait. */
    private const COOPE_MAP = [
        'CSG' => 'CSG', // CoopeSanGabriel  → Studio "Coope San Gabriel"
        'CS'  => 'CS',  // CoopeServicios   → Studio "COOPESERVICIOS"
        'CNA' => 'CN',  // CoopeNacional    → Studio "COOPENACIONAL"
    ];

    /** Fallback: reg_creditos.COD_DEDUCTORA → sufijo coope. */
    private const COD_DEDUCTORA_MAP = [
        10008 => 'CSG',
        10007 => 'CS',
        10025 => 'CN',
        10022 => 'CN',
        10036 => 'CN',
    ];

    /** Cache deductora_id por sufijo (CSG/CS/CN), resuelto de la tabla Studio. */
    private array $deductoraIdPorSufijo = [];

    public function handle(): int
    {
        $dryRun  = (bool) $this->option('dry-run');
        $estados = array_filter(array_map('trim', explode(',', (string) $this->option('estado'))));

        try {
            DB::connection('legacy')->getPdo();
        } catch (\Throwable $e) {
            $this->error('No se pudo conectar a la BD legacy (conexión `legacy`): ' . $e->getMessage());
            $this->line('Configura LEGACY_DB_* en .env o asegúrate de que `progrex_new` esté disponible.');
            return self::FAILURE;
        }

        $this->info('Conexión legacy OK. Estados: ' . implode(',', $estados) . ($dryRun ? '  [DRY-RUN]' : ''));
        $this->cargarDeductorasStudio();

        // Query base
        // EXCLUSIÓN FIJA: créditos cuya FECHA_REGISTRO cae en 2026 NO se migran
        // (decisión del usuario, May 2026). Los créditos del 2026 se manejan
        // directamente en Studio, no vienen de la BD legacy.
        $q = DB::connection('legacy')->table('reg_creditos')
            ->selectRaw("CODIGO, ID_SOLICITUD, TRIM(CEDULA) AS ced, MONTOAPR, MONTO_GIRADO, PLAZO, `INT` AS tasa, CUOTA, SALDO, TRIM(ESTADO) AS estado, COD_DEDUCTORA, FECHA_REGISTRO, FECHAFORF, FECHASOL, OBSERVACION, CATEGORIA_PERSONA")
            ->whereRaw('TRIM(ESTADO) IN (' . implode(',', array_fill(0, count($estados), '?')) . ')', $estados)
            ->whereRaw('(FECHA_REGISTRO IS NULL OR YEAR(FECHA_REGISTRO) < 2026)')
            ->orderBy('CODIGO')->orderBy('ID_SOLICITUD');

        if ($this->option('codigo'))       $q->where('CODIGO', $this->option('codigo'));
        if ($this->option('id-solicitud')) $q->where('ID_SOLICITUD', (int) $this->option('id-solicitud'));
        if ($this->option('cedula'))       $q->whereRaw('TRIM(CEDULA) = ?', [preg_replace('/[^0-9]/', '', (string) $this->option('cedula'))]);
        if ($this->option('offset'))       $q->offset((int) $this->option('offset'));
        if ($this->option('limit'))        $q->limit((int) $this->option('limit'));

        $creditos = $q->get();
        $this->info("Créditos en alcance: {$creditos->count()}");
        if ($creditos->isEmpty()) {
            $this->warn('Nada que migrar con esos filtros.');
            return self::SUCCESS;
        }

        // FASE A: clientes
        if (!$this->option('skip-clientes')) {
            $this->faseClientes($creditos->pluck('ced')->unique()->values()->all(), $dryRun);
            if ($this->option('solo-clientes')) {
                $this->info('--solo-clientes: terminado.');
                return self::SUCCESS;
            }
        }

        // FASE B: créditos
        $stats = ['creados' => 0, 'saltados' => 0, 'fallidos' => 0,
                  'plan_lineas' => 0, 'pagos' => 0,
                  'asientos_ok' => 0, 'asientos_fail' => 0];
        $bar = $this->output->createProgressBar($creditos->count());
        $bar->start();

        foreach ($creditos as $rc) {
            $opLabel = "{$rc->CODIGO}/{$rc->ID_SOLICITUD}";
            try {
                $res = $this->procesarCredito($rc, $stats, $dryRun);
                if ($res['saltado'] ?? false) {
                    $stats['saltados']++;
                } elseif ($res['success'] ?? false) {
                    $stats['creados']++;
                } else {
                    $stats['fallidos']++;
                    $this->newLine();
                    $this->error("[$opLabel] {$res['error']}");
                }
            } catch (\Throwable $e) {
                $stats['fallidos']++;
                $this->newLine();
                $this->error("[$opLabel] EXCEPCIÓN: {$e->getMessage()}");
                Log::error("MigrarCreditosLegacy [$opLabel]", ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info('Resumen:');
        $this->table(
            ['Creados', 'Saltados', 'Fallidos', 'Plan líneas', 'Pagos', 'Asientos OK', 'Asientos fail'],
            [[$stats['creados'], $stats['saltados'], $stats['fallidos'], $stats['plan_lineas'], $stats['pagos'], $stats['asientos_ok'], $stats['asientos_fail']]]
        );

        return $stats['fallidos'] > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Pre-carga las 3 deductoras coope conocidas de Studio (CSG/CS/CN → deductora_id).
     */
    private function cargarDeductorasStudio(): void
    {
        $patrones = [
            'CSG' => 'coope san gabriel',
            'CS'  => 'coopeservicios',
            'CN'  => 'coopenacional',
        ];
        foreach ($patrones as $suf => $patron) {
            $d = \App\Models\Deductora::whereRaw('LOWER(nombre) LIKE ?', ['%' . $patron . '%'])->first();
            if ($d) $this->deductoraIdPorSufijo[$suf] = $d->id;
        }
    }

    /** Convierte ID_SEQ legacy (decimal 5,2) a string canónico "2.01" / "127.00". */
    private function formatIdSeq($v): string
    {
        return number_format((float) $v, 2, '.', '');
    }

    /**
     * Procesa un crédito legacy: crea (o reemplaza) Credit + plan_de_pagos
     * + credit_payments + dispara asientos.
     */
    private function procesarCredito(object $rc, array &$stats, bool $dryRun): array
    {
        $cedula = preg_replace('/[^0-9]/', '', (string) $rc->ced);
        $persona = Person::query()->withoutGlobalScopes()->where('cedula', $cedula)->first();
        if (!$persona) {
            return ['success' => false, 'error' => "Cliente cédula $cedula no existe (correr fase clientes primero)"];
        }
        if ((int) $persona->person_type_id !== 2) {
            $persona->person_type_id = 2;
            $persona->save();
        }

        $nuOp = (string) $rc->ID_SOLICITUD;

        // Dedup / reemplazo
        $existente = Credit::where('numero_operacion', $nuOp)->first();
        if ($existente) {
            if ($this->option('reemplazar')) {
                if (!$dryRun) {
                    DB::transaction(function () use ($existente) {
                        PlanDePago::where('credit_id', $existente->id)->delete();
                        CreditPayment::where('credit_id', $existente->id)->delete();
                        $existente->delete();
                    });
                }
            } else {
                return ['success' => false, 'saltado' => true, 'error' => "Ya existe credit #{$existente->id} numero_operacion=$nuOp"];
            }
        }

        // Cargar plan + transac legacy (TODAS las filas)
        $planRows = DB::connection('legacy')->table('crd_operacion_plan_pagos')
            ->where('CODIGO', $rc->CODIGO)->where('ID_SOLICITUD', $rc->ID_SOLICITUD)
            ->orderByRaw('CAST(ID_SEQ AS DECIMAL(10,2))')
            ->get();

        $transacRows = DB::connection('legacy')->table('crd_operacion_transac')
            ->where('CODIGO', $rc->CODIGO)->where('ID_SOLICITUD', $rc->ID_SOLICITUD)
            ->orderByRaw('CAST(ID_SEQ AS DECIMAL(10,2))')
            ->get();
        // Para JOIN plan↔transac (incluye filas con MOV_MONTO=0, ej. desembolso)
        $transacByIdSeq = $transacRows->keyBy(fn ($t) => $this->formatIdSeq($t->ID_SEQ));
        // Para crear los CreditPayment + asientos: solo pagos reales
        $pagosReales = $transacRows->where('MOV_MONTO', '>', 0)->values();

        if ($dryRun) {
            $cuotasDistintas = $planRows->pluck('NUM_CUOTA')->unique()->count();
            $this->newLine();
            $this->line("── {$rc->CODIGO}/{$rc->ID_SOLICITUD} ── ced=$cedula  monto=" . ($rc->MONTOAPR ?: $rc->MONTO_GIRADO) . "  cuota={$rc->CUOTA}  plazo={$rc->PLAZO}  tasa={$rc->tasa}  estado={$rc->estado}");
            $this->line("   plan_lineas=" . count($planRows) . "  cuotas_distintas=$cuotasDistintas  transac=" . count($transacRows) . "  pagos_reales=" . count($pagosReales));
            return ['success' => true, 'dry_run' => true];
        }

        // Resolver tasa, deductora del crédito, fecha formalización, institución
        $fechaForm = $this->fechaValida($rc->FECHA_REGISTRO)
            ?: $this->fechaValida($rc->FECHAFORF)
            ?: $this->fechaValida($rc->FECHASOL)
            ?: now()->format('Y-m-d');

        $tasa = $this->resolverOCrearTasa((float) $rc->tasa, $fechaForm);

        $sufijoCredito = self::COD_DEDUCTORA_MAP[(int) $rc->COD_DEDUCTORA] ?? null;
        $deductoraId = $sufijoCredito ? ($this->deductoraIdPorSufijo[$sufijoCredito] ?? null) : null;

        // institucion_labora del socio si la persona no la tiene
        $inst = DB::connection('legacy')->table('socios as s')
            ->leftJoin('instituciones as i', 'i.COD_INSTITUCION', '=', 's.COD_INSTITUCION')
            ->whereRaw('TRIM(s.CEDULA) = ?', [$cedula])
            ->value('i.DESC_CORTA');
        if ($inst && empty($persona->institucion_labora)) {
            $persona->institucion_labora = trim($inst);
            $persona->save();
        }

        // Crear todo en transacción y RECOLECTAR specs de asientos
        $asientoSpecs = [];
        $creditId = null;
        $reference = null;
        $monto = (float) ($rc->MONTOAPR ?: $rc->MONTO_GIRADO);

        DB::transaction(function () use (
            $rc, $persona, $cedula, $fechaForm, $tasa, $deductoraId, $sufijoCredito,
            $planRows, $transacByIdSeq, $pagosReales, $monto, $nuOp,
            &$asientoSpecs, &$creditId, &$reference, &$stats
        ) {
            // 1) Opportunity placeholder (mismo patrón que el creator existente)
            $opp = $this->crearOpportunity($persona, $monto, $fechaForm);

            // 2) Credit
            $statusStudio = match ($rc->estado) {
                'C'     => 'Cancelado',
                'N'     => 'Anulado',
                default => 'Formalizado',
            };
            $reference = $nuOp;

            $credit = Credit::create([
                'reference'        => $reference,
                'title'            => "Migrado {$rc->CODIGO}/{$rc->ID_SOLICITUD} - {$persona->name}",
                'status'           => $statusStudio,
                'lead_id'          => $persona->id,
                'opportunity_id'   => $opp?->id,
                'opened_at'        => $fechaForm,
                'description'      => trim('Migrado legacy ' . (string) $rc->OBSERVACION),
                'category'         => $rc->CODIGO,
                'numero_operacion' => $nuOp,
                'monto_credito'    => $monto,
                'cuota'            => (float) $rc->CUOTA,
                'plazo'            => (int) $rc->PLAZO,
                'tasa_id'          => $tasa->id,
                'tasa_anual'       => (float) $rc->tasa,
                'deductora_id'     => $deductoraId,
                'formalized_at'    => $fechaForm,
                'progrex'          => true, // Marca crédito migrado desde BD legacy CrediPEP
            ]);
            $creditId = $credit->id;

            // 3) Plan de pagos — COPIA 1:1 DEL SQL (1 fila por sub-línea ID_SEQ)
            PlanDePago::withoutEvents(function () use ($planRows, $transacByIdSeq, $credit, &$stats) {
                foreach ($planRows as $p) {
                    $idSeq = $this->formatIdSeq($p->ID_SEQ);
                    $t = $transacByIdSeq->get($idSeq);

                    $estado = match (trim((string) $p->ESTADO)) {
                        'C'     => 'Pagada',
                        'P'     => 'Pendiente',
                        'A'     => 'Vencida',
                        'N'     => 'Anulada',
                        default => 'Pendiente',
                    };

                    $row = new PlanDePago();
                    $row->forceFill([
                        'credit_id'         => $credit->id,
                        'linea'             => $idSeq,
                        'numero_cuota'      => (int) $p->NUM_CUOTA,
                        'proceso'           => $p->FECHA_PROCESO ? (string) $p->FECHA_PROCESO : null,
                        'fecha_inicio'      => $this->fechaValida($p->FECHA_INICIO),
                        'fecha_corte'       => $this->fechaValida($p->FECHA_CORTE),
                        'fecha_pago'        => $t ? $this->fechaValida($t->MOV_FECHA) : $this->fechaValida($p->FECHA_PAGO),
                        'tasa_actual'       => (float) ($p->TASA ?? 0),
                        'plazo_actual'      => (int) ($p->PLAZO ?? 0),
                        'cuota'             => (float) ($p->CUOTA ?? 0),
                        'cargos'            => (float) ($p->CARGOS ?? 0),
                        'poliza'            => (float) ($p->POLIZA ?? 0),
                        'interes_corriente' => (float) ($p->INTCOR ?? 0),
                        'interes_moratorio' => (float) ($p->INTMOR ?? 0),
                        'amortizacion'      => (float) ($p->PRINCIPAL ?? 0),
                        'saldo_anterior'    => (float) ($p->SALDO_ANTERIOR ?? 0),
                        'saldo_nuevo'       => (float) ($p->SALDO_ACTUAL ?? 0),
                        'dias'              => (int) ($p->DIAS_CALCULO ?? 0),
                        'estado'            => $estado,
                        'dias_mora'         => (int) ($p->MORA_DIAS ?? 0),
                        // ── MOVIMIENTO (lado derecho del UI legacy) ──
                        'fecha_movimiento'             => $t ? $this->fechaValida($t->MOV_FECHA) : null,
                        'movimiento_total'             => $t ? (float) $t->MOV_MONTO : 0,
                        'movimiento_cargos'            => $t ? (float) $t->MOV_CARGOS : 0,
                        'movimiento_poliza'            => $t ? (float) $t->MOV_POLIZA : 0,
                        'movimiento_interes_corriente' => $t ? (float) $t->MOV_INTCOR : 0,
                        'movimiento_interes_moratorio' => $t ? (float) $t->MOV_INTMOR : 0,
                        'movimiento_principal'         => $t ? (float) $t->MOV_PRINCIPAL : 0,
                        'movimiento_amortizacion'      => $t ? (float) $t->MOV_PRINCIPAL : 0,
                        'movimiento_caja_usuario'      => $t ? ($t->MOV_USUARIO ?: 'Migración Legacy') : null,
                        'tipo_documento'               => $p->TIPO_DOCUMENTO ? trim((string) $p->TIPO_DOCUMENTO) : null,
                        'numero_documento'             => $t ? $t->NUM_COMPROBANTE : $p->NUM_COMPROBANTE,
                        'concepto'                     => $p->COD_CONCEPTO ? trim((string) $p->COD_CONCEPTO) : null,
                    ]);
                    $row->save();
                    $stats['plan_lineas']++;
                }
            });

            // 4) FORMALIZACION — asiento histórico en fecha de desembolso
            $sufijoFormalizacion = $pagosReales->isNotEmpty()
                ? $this->resolverSufijoDePago($pagosReales->first()->NUM_COMPROBANTE, $sufijoCredito)
                : $sufijoCredito;
            $deductoraFormalizacion = $sufijoFormalizacion ? ($this->deductoraIdPorSufijo[$sufijoFormalizacion] ?? null) : null;

            $asientoSpecs[] = [
                'type'      => 'FORMALIZACION',
                'amount'    => $monto,
                'reference' => $reference,
                'context'   => [
                    'reference'        => $reference,
                    'credit_id'        => $reference,
                    'credit_numeric_id'=> $credit->id,
                    'cedula'           => $persona->cedula,
                    'clienteNombre'    => $persona->name,
                    'deductora_id'     => $deductoraFormalizacion,
                    'entry_date'       => $fechaForm,
                    'amount_breakdown' => [
                        'total'                    => $monto,
                        'interes_corriente'        => 0,
                        'interes_moratorio'        => 0,
                        'poliza'                   => 0,
                        'capital'                  => $monto,
                        'sobrante'                 => 0,
                        'cargos_adicionales_total' => 0,
                        'cargos_adicionales'       => [],
                    ],
                ],
            ];

            // 5) CreditPayment + spec asiento por cada pago real (MOV_MONTO>0)
            $saldoActual = $monto;
            foreach ($pagosReales as $t) {
                $idSeq = $this->formatIdSeq($t->ID_SEQ);
                $sufijoPago = $this->resolverSufijoDePago($t->NUM_COMPROBANTE, $sufijoCredito);
                $pagoDeductoraId = $sufijoPago ? ($this->deductoraIdPorSufijo[$sufijoPago] ?? null) : null;
                $fechaPago = $this->fechaHibrida($t->NUM_COMPROBANTE, $t->MOV_FECHA, $fechaForm);

                $montoPago = (float) $t->MOV_MONTO;
                $capital   = (float) $t->MOV_PRINCIPAL;
                $saldoAnt  = $saldoActual;
                $saldoActual = max(0.0, round($saldoActual - $capital, 2));

                $referencia = $this->buildReferenciaPago($rc, $t, $sufijoPago);

                $payment = CreditPayment::create([
                    'credit_id'         => $credit->id,
                    'linea'             => $idSeq,
                    'numero_cuota'      => (int) $t->NUM_CUOTA,
                    'fecha_pago'        => $fechaPago,
                    'cuota'             => (float) $rc->CUOTA,
                    'monto'             => $montoPago,
                    'poliza'            => (float) $t->MOV_POLIZA,
                    'interes_corriente' => (float) $t->MOV_INTCOR,
                    'interes_moratorio' => (float) $t->MOV_INTMOR,
                    'amortizacion'      => $capital,
                    'saldo_anterior'    => $saldoAnt,
                    'nuevo_saldo'       => $saldoActual,
                    'estado'            => 'Pagado',
                    'fecha_movimiento'  => $fechaPago,
                    'movimiento_total'  => $montoPago,
                    'movimiento_amortizacion' => $capital,
                    'tasa_actual'       => (float) $rc->tasa,
                    'plazo_actual'      => (int) $rc->PLAZO,
                    'source'            => $pagoDeductoraId ? 'Planilla' : 'Ventanilla',
                    'referencia'        => $referencia,
                    'cedula'            => $persona->cedula,
                ]);
                $stats['pagos']++;

                $cargos = (float) $t->MOV_CARGOS;
                $asientoSpecs[] = [
                    'type'      => $pagoDeductoraId ? 'PAGO_PLANILLA' : 'PAGO_VENTANILLA',
                    'amount'    => $montoPago,
                    'reference' => "{$reference}-PAY-{$payment->id}",
                    'context'   => [
                        'reference'         => $reference,
                        'credit_id'         => $reference,
                        'credit_numeric_id' => $credit->id,
                        'payment_id'        => $payment->id,
                        'cedula'            => $persona->cedula,
                        'clienteNombre'     => $persona->name,
                        'deductora_id'      => $pagoDeductoraId,
                        'entry_date'        => $fechaPago,
                        'amount_breakdown'  => [
                            'total'                    => $montoPago,
                            'interes_corriente'        => (float) $t->MOV_INTCOR,
                            'interes_moratorio'        => (float) $t->MOV_INTMOR,
                            'poliza'                   => (float) $t->MOV_POLIZA,
                            'capital'                  => $capital,
                            'sobrante'                 => 0,
                            'cargos_adicionales_total' => $cargos,
                            'cargos_adicionales'       => $cargos > 0 ? ['otros' => $cargos] : [],
                        ],
                    ],
                ];
            }

            // 6) Saldo + última fecha en Credit (faithful al legacy)
            $credit->saldo = (float) $rc->SALDO;  // valor exacto del SQL
            if ($pagosReales->isNotEmpty()) {
                $credit->fecha_ultimo_pago = $this->fechaValida($pagosReales->last()->MOV_FECHA);
            }
            $credit->save();
        });

        // FUERA de la transacción: disparar asientos (con pacing)
        if (!$this->option('sin-asientos')) {
            $delayMs = (int) config('services.erp.asiento_delay_ms', 250);
            foreach ($asientoSpecs as $spec) {
                $res = $this->triggerAccountingEntry($spec['type'], $spec['amount'], $spec['reference'], $spec['context']);
                ($res['success'] ?? false) ? $stats['asientos_ok']++ : $stats['asientos_fail']++;
                if ($delayMs > 0) usleep($delayMs * 1000);
            }
        }

        return ['success' => true, 'credit_id' => $creditId, 'numero_operacion' => $reference];
    }

    /**
     * Crea Opportunity placeholder (mismo patrón que `ImportacionCreditoCreator`).
     */
    private function crearOpportunity(Person $cliente, float $monto, string $fechaForm): ?Opportunity
    {
        try {
            $opportunity = new Opportunity();
            $opportunity->forceFill([
                'name'        => "Migrado - {$cliente->name}",
                'lead_cedula' => $cliente->cedula,
                'amount'      => $monto,
                'stage'       => 'Formalizado',
                'close_date'  => $fechaForm,
            ])->save();
            return $opportunity;
        } catch (\Throwable $e) {
            Log::warning('Migrar: no se pudo crear opportunity', ['cedula' => $cliente->cedula, 'error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Match exacto de tasa (a 2 decimales) o crea "Tasa Histórica X%" inactiva.
     */
    private function resolverOCrearTasa(float $tasaAnual, string $fechaInicio): Tasa
    {
        $t = round($tasaAnual, 2);
        $tasa = Tasa::whereRaw('ROUND(tasa, 2) = ?', [$t])->first();
        if ($tasa) return $tasa;

        return Tasa::create([
            'nombre'      => "Tasa Histórica {$t}%",
            'tasa'        => $t,
            'tasa_maxima' => $t * 1.3,
            'inicio'      => $fechaInicio,
            'fin'         => null,
            'activo'      => false,
        ]);
    }

    /**
     * HÍBRIDO REFINADO: devuelve sufijo coope CSG/CS/CN o null.
     *  - Comprobante `YYYYMM.{CSG|CS|CNA}.CRD` → ese sufijo (CNA→CN).
     *  - Numérico suelto / vacío → fallback del crédito (lote inicial planilla).
     *  - Textual no-coope (M-SJ, AJ, FND, MIGRA, APL…) → null → ventanilla.
     */
    private function resolverSufijoDePago(?string $comprobante, ?string $fallbackCredito): ?string
    {
        $c = strtoupper(trim((string) $comprobante));
        if ($c !== '' && preg_match('/^\d{6}\.([A-Z]+)\.CRD$/', $c, $m)) {
            return self::COOPE_MAP[$m[1]] ?? null;
        }
        if ($c === '' || ctype_digit($c)) {
            return $fallbackCredito;
        }
        return null; // textual no-coope → ventanilla
    }

    /**
     * Fecha de asiento HÍBRIDA:
     *  - Comprobante con período YYYYMM → último día de ese mes.
     *  - Si no → MOV_FECHA si es válida.
     *  - Si no → fecha de formalización.
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

    /** Devuelve Y-m-d si la fecha es real (descarta 1899/1900 = NULL SQL Server). */
    private function fechaValida($v): ?string
    {
        if (empty($v)) return null;
        try {
            $d = Carbon::parse((string) $v);
        } catch (\Throwable) {
            return null;
        }
        $y = (int) $d->format('Y');
        if ($y < 1920 || $y > 2100) return null;
        return $d->format('Y-m-d');
    }

    /**
     * Referencia única por pago, compatible con el regex de detección de coope:
     *  - Planilla: `LEG-{COD}-{IDSOL}-{seqDigits}-PLA{seqDigits}.{SUF}.CRD`
     *  - Ventanilla: `LEG-{COD}-{IDSOL}-{seqDigits}` (no resuelve coope)
     */
    private function buildReferenciaPago(object $rc, object $t, ?string $sufijo): string
    {
        $seqDigits = str_replace('.', '', $this->formatIdSeq($t->ID_SEQ));
        if ($sufijo) {
            return "LEG-{$rc->CODIGO}-{$rc->ID_SOLICITUD}-{$seqDigits}-PLA{$seqDigits}.{$sufijo}.CRD";
        }
        return "LEG-{$rc->CODIGO}-{$rc->ID_SOLICITUD}-{$seqDigits}";
    }

    // ============================================================
    // FASE A — CLIENTES (sin cambios respecto a v1)
    // ============================================================

    /** @param array<int, string> $cedulas */
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
                $this->line("   [cliente] $ced  {$payload['name']} {$payload['apellido1']} {$payload['apellido2']}");
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

    private function limpiar($v): ?string
    {
        $v = trim((string) $v);
        return $v === '' ? null : $v;
    }

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
