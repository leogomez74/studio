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
        {--solo-activos : Atajo: migrar SOLO créditos activos (sobreescribe --estado a A)}
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

    /**
     * Topes de usura anuales en COLONES, Costa Rica (Ley de Usura, vigente 2020-07-01+).
     * Clave 'YYYY-S': S=1 (enero-junio) / S=2 (julio-diciembre).
     * Solo COLONES (decisión usuario): no se usan dólares ni otras monedas.
     */
    private const USURA_COLONES = [
        '2020-2' => ['gral' => 37.69, 'micro' => 53.18],
        '2021-1' => ['gral' => 35.56, 'micro' => 50.22],
        '2021-2' => ['gral' => 33.66, 'micro' => 47.58],
        '2022-1' => ['gral' => 33.44, 'micro' => 47.27],
        '2022-2' => ['gral' => 33.41, 'micro' => 47.23],
        '2023-1' => ['gral' => 35.51, 'micro' => 50.16],
        '2023-2' => ['gral' => 38.16, 'micro' => 53.83],
        '2024-1' => ['gral' => 38.55, 'micro' => 54.37],
        '2024-2' => ['gral' => 38.98, 'micro' => 54.98],
        '2025-1' => ['gral' => 38.36, 'micro' => 54.11],
        '2025-2' => ['gral' => 36.65, 'micro' => 51.74],
        '2026-1' => ['gral' => 36.27, 'micro' => 51.21],
    ];

    /** Umbral monto: > 690.000 = gral; <= 690.000 = micro (decisión usuario). */
    private const MONTO_UMBRAL_GRAL = 690000.0;

    /** Días de gracia (calendario, en meses) antes de generar mora. */
    private const MORA_GRACIA_MESES = 2;

    /** Cache deductora_id por sufijo (CSG/CS/CN), resuelto de la tabla Studio. */
    private array $deductoraIdPorSufijo = [];

    public function handle(): int
    {
        $dryRun  = (bool) $this->option('dry-run');
        // --solo-activos es atajo: sobreescribe --estado a 'A'
        $estados = $this->option('solo-activos')
            ? ['A']
            : array_filter(array_map('trim', explode(',', (string) $this->option('estado'))));

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

        $creditos = $q->get()->map(fn ($r) => $this->normRow($r));
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
            $opLabel = "{$rc->codigo}/{$rc->id_solicitud}";
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
     * Determina si un crédito está dentro del scope del NUEVO cálculo de mora.
     *  - ESTADO='A' (Activo)
     *  - Formaliza >= 2020-07-01 (post Ley de Usura)
     *  - Tasa corriente > 0 (los 6 créditos con tasa 0% quedan fuera)
     *
     * Para créditos FUERA del scope, se preservan los valores legacy de
     * mora_dias e interes_moratorio tal cual.
     */
    private function aplicaNuevaMora(object $rc, string $fechaForm): bool
    {
        if (trim((string) $rc->estado) !== 'A') return false;
        if (Carbon::parse($fechaForm)->lt('2020-07-01')) return false;
        if ((float) $rc->tasa <= 0) return false;
        return true;
    }

    /**
     * Devuelve el tope de usura anual (%) en colones aplicable a un crédito
     * según su fecha de formalización (semestre) y su monto (gral/micro).
     * Si la fecha no está en la tabla, usa el semestre conocido más cercano.
     */
    private function usuraMaxParaCredito(string $fechaForm, float $monto): float
    {
        $d = Carbon::parse($fechaForm);
        $year = (int) $d->year;
        $half = (int) $d->month <= 6 ? 1 : 2;
        $key = "{$year}-{$half}";

        $tabla = self::USURA_COLONES;
        if (!isset($tabla[$key])) {
            ksort($tabla);
            $keys = array_keys($tabla);
            $key = $key < $keys[0] ? $keys[0] : end($keys);
        }
        $tipo = $monto > self::MONTO_UMBRAL_GRAL ? 'gral' : 'micro';
        return (float) $tabla[$key][$tipo];
    }

    /**
     * Detecta si un crédito legacy es BULLET (solo intereses + capital al final)
     * o AMORTIZABLE (cuota nivelada con amortización progresiva).
     *
     * Heurística sobre las filas del plan legacy (excluyendo desembolso y póliza):
     *  - Si >=80% de cuotas intermedias tienen PRINCIPAL=0 AND la última cuota
     *    tiene PRINCIPAL ≈ capital → BULLET
     *  - Si todas tienen PRINCIPAL>0 → AMORTIZABLE
     *
     * Solo es usado para logging/diagnóstico — el cálculo de mora usa
     * directamente `$p->cuota` de cada fila (que ya contiene el valor correcto
     * para bullet intermedia = interés, bullet final = capital+interés,
     * amortizable = cuota nivelada).
     */
    private function detectarTipoCredito($planRows, float $capital): string
    {
        $cuotas = $planRows->filter(fn ($p) => (int) $p->num_cuota > 0)->values();
        if ($cuotas->isEmpty()) return 'amortizable';

        $intermedias = $cuotas->slice(0, -1);
        $ultima = $cuotas->last();
        if ($intermedias->isEmpty()) return 'amortizable';

        $sinAmort = $intermedias->filter(fn ($p) => (float) $p->principal == 0.0)->count();
        $umbral = (int) ceil($intermedias->count() * 0.8);
        $ultimaConCapital = abs((float) $ultima->principal - $capital) < 1.0;

        return ($sinAmort >= $umbral && $ultimaConCapital) ? 'bullet' : 'amortizable';
    }

    /**
     * Calcula días de mora e interés moratorio para una fila del plan según
     * la Ley 9859 de Usura (CR). Aplica SOLO en script de migración legacy.
     *
     * Reglas:
     *  - Regla 1 (PRIORITARIA): si y_max ≤ 0 (caso x ≥ N) → mora = 0.
     *  - Regla 2: gracia de 2 meses calendario desde fecha_pago (Carbon
     *    addMonths(2)). Antes del fin de gracia → mora = 0.
     *  - Estados Pagada/Anulada → mora = 0 siempre.
     *  - Sub-líneas (linea no termina en .00) → mora = 0 (solo madre acumula).
     *
     * Fórmula (Ley 9859, art. 36 ter):
     *   interes_moratorio = monto_vencido_cuota × (y_max / 100) × (dias_mora / 360)
     *
     * Donde monto_vencido_cuota = `plan_row.cuota` del legacy, que ya contiene:
     *   - Bullet intermedia: el interés mensual (ej. 11.969)
     *   - Bullet final: capital + último interés (ej. 610.419)
     *   - Amortizable: cuota nivelada completa (amort + interés)
     *
     * @return array{0:int, 1:float} [dias_mora, interes_moratorio]
     */
    private function calcularMora(
        ?string $fechaPagoLegacy,
        string $estadoStudio,
        float $montoVencidoCuota,
        float $yMax,
        Carbon $ref,
        string $linea = '1.00'
    ): array {
        // Estados sin mora
        if (in_array($estadoStudio, ['Pagada', 'Anulada'], true)) {
            return [0, 0.0];
        }
        // Sub-líneas (X.01, X.02, …) no acumulan mora — solo la madre X.00
        if (!$this->esLineaMadre($linea)) {
            return [0, 0.0];
        }
        // Regla 1 (prioritaria): x = N → y = 0
        if ($yMax <= 0) {
            return [0, 0.0];
        }
        // Sin fecha de pago válida → sin mora
        $fp = $this->fechaValida($fechaPagoLegacy);
        if (!$fp) {
            return [0, 0.0];
        }
        $fechaPago = Carbon::parse($fp);
        $finGracia = $fechaPago->copy()->addMonths(self::MORA_GRACIA_MESES);

        // Aún en gracia
        if ($ref->lessThanOrEqualTo($finGracia)) {
            return [0, 0.0];
        }

        $diasMora = (int) $finGracia->diffInDays($ref);
        if ($diasMora <= 0) return [0, 0.0];

        // Fórmula Ley 9859: monto_vencido × tasa_moratoria × días / 360
        $intMor = round($montoVencidoCuota * ($yMax / 100) * ($diasMora / 360), 2);
        return [$diasMora, $intMor];
    }

    /** ¿La línea ID_SEQ termina en .00 (cuota madre)? Ej: '1.00' true, '1.01' false. */
    private function esLineaMadre(string $linea): bool
    {
        $f = (float) $linea;
        return abs($f - floor($f)) < 0.001;
    }

    /**
     * Normaliza las propiedades de una fila stdClass para que sean accesibles
     * con el case que el código espera. MySQL en Linux suele devolver columnas
     * en minúsculas o respetando el case del CREATE TABLE; MySQL en Windows
     * (Laragon) suele ser case-insensitive. Para no depender de eso:
     *
     *  - Los aliases que el código accede en lowercase (`ced`, `estado`,
     *    `tasa`, `inst`, `pref`) se preservan en lowercase.
     *  - Todas las demás columnas se normalizan a UPPERCASE.
     *
     * Aplicar via ->map() sobre el resultado de cada ->get() legacy.
     */
    private function normRow(object $row): object
    {
        // Normaliza TODAS las propiedades a LOWERCASE. La BD legacy en Linux
        // tiene columnas en minúsculas (id_seq, codigo, id_solicitud…); este
        // mapeo garantiza acceso uniforme en cualquier OS.
        $out = new \stdClass();
        foreach (get_object_vars($row) as $k => $v) {
            $out->{strtolower($k)} = $v;
        }
        return $out;
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

        $nuOp = (string) $rc->id_solicitud;

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

        // Cargar plan + transac legacy (TODAS las filas) — normalizar case
        // de propiedades porque MySQL Linux puede devolver columnas en minúsculas.
        $planRows = DB::connection('legacy')->table('crd_operacion_plan_pagos')
            ->where('CODIGO', $rc->codigo)->where('ID_SOLICITUD', $rc->id_solicitud)
            ->orderByRaw('CAST(ID_SEQ AS DECIMAL(10,2))')
            ->get()
            ->map(fn ($r) => $this->normRow($r));

        $transacRows = DB::connection('legacy')->table('crd_operacion_transac')
            ->where('CODIGO', $rc->codigo)->where('ID_SOLICITUD', $rc->id_solicitud)
            ->orderByRaw('CAST(ID_SEQ AS DECIMAL(10,2))')
            ->get()
            ->map(fn ($r) => $this->normRow($r));
        // Para JOIN plan↔transac (incluye filas con MOV_MONTO=0, ej. desembolso)
        $transacByIdSeq = $transacRows->keyBy(fn ($t) => $this->formatIdSeq($t->id_seq));
        // Para crear los CreditPayment + asientos: solo pagos reales
        $pagosReales = $transacRows->where('mov_monto', '>', 0)->values();

        if ($dryRun) {
            $cuotasDistintas = $planRows->pluck('num_cuota')->unique()->count();
            $this->newLine();
            $this->line("── {$rc->codigo}/{$rc->id_solicitud} ── ced=$cedula  monto=" . ($rc->montoapr ?: $rc->monto_girado) . "  cuota={$rc->cuota}  plazo={$rc->plazo}  tasa={$rc->tasa}  estado={$rc->estado}");
            $this->line("   plan_lineas=" . count($planRows) . "  cuotas_distintas=$cuotasDistintas  transac=" . count($transacRows) . "  pagos_reales=" . count($pagosReales));
            return ['success' => true, 'dry_run' => true];
        }

        // Resolver tasa, deductora del crédito, fecha formalización, institución
        $fechaForm = $this->fechaValida($rc->fecha_registro)
            ?: $this->fechaValida($rc->fechaforf)
            ?: $this->fechaValida($rc->fechasol)
            ?: now()->format('Y-m-d');

        $tasa = $this->resolverOCrearTasa((float) $rc->tasa, $fechaForm);

        $sufijoCredito = self::COD_DEDUCTORA_MAP[(int) $rc->cod_deductora] ?? null;
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
        $monto = (float) ($rc->montoapr ?: $rc->monto_girado);

        // ── Cálculo de mora (Ley 9859 — Ley de Usura CR) ──
        // Si SÍ aplica: calcular yMax una vez (= N - x). Si y_max <= 0 (x=N), todo el plan tendrá mora=0.
        // Si NO aplica (pre-Ley, tasa 0%, cancelado, anulado): se preservan los valores legacy.
        $aplicaMoraNueva = $this->aplicaNuevaMora($rc, $fechaForm);
        $yMaxCredito = 0.0;
        $tipoCredito = 'amortizable'; // default
        if ($aplicaMoraNueva) {
            $N = $this->usuraMaxParaCredito($fechaForm, $monto);
            $yMaxCredito = max(0.0, $N - (float) $rc->tasa);
            $tipoCredito = $this->detectarTipoCredito($planRows, $monto);

            // Guarda explícita: x + y_max ≤ N (siempre cumple por construcción,
            // pero protege ante futura tasa moratoria pactada custom)
            $tasaTotal = (float) $rc->tasa + $yMaxCredito;
            if ($tasaTotal > $N + 0.001) {
                Log::warning("MigrarCreditosLegacy [{$rc->codigo}/{$rc->id_solicitud}]: x+y_max ({$tasaTotal}) excede N ({$N}). Se acota.");
                $yMaxCredito = max(0.0, $N - (float) $rc->tasa);
            }
        }

        DB::transaction(function () use (
            $rc, $persona, $cedula, $fechaForm, $tasa, $deductoraId, $sufijoCredito,
            $planRows, $transacByIdSeq, $pagosReales, $monto, $nuOp,
            $aplicaMoraNueva, $yMaxCredito,
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
                'title'            => "Migrado {$rc->codigo}/{$rc->id_solicitud} - {$persona->name}",
                'status'           => $statusStudio,
                'lead_id'          => $persona->id,
                'opportunity_id'   => $opp?->id,
                'opened_at'        => $fechaForm,
                'description'      => trim('Migrado legacy ' . (string) $rc->observacion),
                'category'         => $rc->codigo,
                'numero_operacion' => $nuOp,
                'monto_credito'    => $monto,
                'cuota'            => (float) $rc->cuota,
                'plazo'            => (int) $rc->plazo,
                'tasa_id'          => $tasa->id,
                'tasa_anual'       => (float) $rc->tasa,
                'deductora_id'     => $deductoraId,
                'formalized_at'    => $fechaForm,
                'progrex'          => true, // Marca crédito migrado desde BD legacy CrediPEP
            ]);
            $creditId = $credit->id;

            // 3) Plan de pagos — COPIA 1:1 DEL SQL (1 fila por sub-línea ID_SEQ).
            // USO DB::table()->insert() para BYPASSEAR el ORM y SUS OBSERVERS.
            // Esto es crítico: PlanDePago tiene un observer en `static::created`
            // que cuando ve numero_cuota=0 auto-genera N cuotas con fórmula
            // francesa. `Model::withoutEvents()` debería suprimirlo pero en
            // algunos servidores (PHP/Laravel/instancia) no funciona. Con
            // DB::table->insert el observer NUNCA dispara — bypass del ORM
            // 100% garantizado.
            $now = now();
            $planInsert = [];
            foreach ($planRows as $p) {
                $idSeq = $this->formatIdSeq($p->id_seq);
                $t = $transacByIdSeq->get($idSeq);

                $estado = match (trim((string) $p->estado)) {
                    'C'     => 'Pagada',
                    'P'     => 'Pendiente',
                    'A'     => 'Vencida',
                    'N'     => 'Anulada',
                    default => 'Pendiente',
                };

                // Mora: si el crédito aplica nueva regla, recalcular según Ley 9859;
                // si no, preservar legacy.
                $saldoAnterior = (float) ($p->saldo_anterior ?? 0);
                if ($aplicaMoraNueva) {
                    // Base de mora = $p->cuota (monto vencido de la fila legacy).
                    // Para bullet intermedia: interés mensual.
                    // Para bullet final: capital + último interés.
                    // Para amortizable: cuota nivelada (amort + interés).
                    $montoVencido = (float) ($p->cuota ?? 0);
                    [$diasMoraFinal, $intMorFinal] = $this->calcularMora(
                        $p->fecha_pago,
                        $estado,
                        $montoVencido,
                        $yMaxCredito,
                        $now,
                        $idSeq
                    );
                } else {
                    $diasMoraFinal = (int) ($p->mora_dias ?? 0);
                    $intMorFinal = (float) ($p->intmor ?? 0);
                }

                $planInsert[] = [
                    'credit_id'         => $credit->id,
                    'linea'             => $idSeq,
                    'numero_cuota'      => (int) $p->num_cuota,
                    'proceso'           => $p->fecha_proceso ? (string) $p->fecha_proceso : null,
                    'fecha_inicio'      => $this->fechaValida($p->fecha_inicio),
                    'fecha_corte'       => $this->fechaValida($p->fecha_corte),
                    'fecha_pago'        => $t ? $this->fechaValida($t->mov_fecha) : $this->fechaValida($p->fecha_pago),
                    'tasa_actual'       => (float) ($p->tasa ?? 0),
                    'plazo_actual'      => (int) ($p->plazo ?? 0),
                    'cuota'             => (float) ($p->cuota ?? 0),
                    'cargos'            => (float) ($p->cargos ?? 0),
                    'poliza'            => (float) ($p->poliza ?? 0),
                    'interes_corriente' => (float) ($p->intcor ?? 0),
                    'interes_moratorio' => $intMorFinal,
                    'amortizacion'      => (float) ($p->principal ?? 0),
                    'saldo_anterior'    => $saldoAnterior,
                    'saldo_nuevo'       => (float) ($p->saldo_actual ?? 0),
                    'dias'              => (int) ($p->dias_calculo ?? 0),
                    'estado'            => $estado,
                    'dias_mora'         => $diasMoraFinal,
                    'fecha_movimiento'             => $t ? $this->fechaValida($t->mov_fecha) : null,
                    'movimiento_total'             => $t ? (float) $t->mov_monto : 0,
                    'movimiento_cargos'            => $t ? (float) $t->mov_cargos : 0,
                    'movimiento_poliza'            => $t ? (float) $t->mov_poliza : 0,
                    'movimiento_interes_corriente' => $t ? (float) $t->mov_intcor : 0,
                    'movimiento_interes_moratorio' => $t ? (float) $t->mov_intmor : 0,
                    'movimiento_principal'         => $t ? (float) $t->mov_principal : 0,
                    'movimiento_amortizacion'      => $t ? (float) $t->mov_principal : 0,
                    'movimiento_caja_usuario'      => $t ? ($t->mov_usuario ?: 'Migración Legacy') : null,
                    'tipo_documento'               => $p->tipo_documento ? trim((string) $p->tipo_documento) : null,
                    'numero_documento'             => $t ? $t->num_comprobante : $p->num_comprobante,
                    'concepto'                     => $p->cod_concepto ? trim((string) $p->cod_concepto) : null,
                    'created_at'                   => $now,
                    'updated_at'                   => $now,
                ];
                $stats['plan_lineas']++;
            }
            if (!empty($planInsert)) {
                // Insert masivo en chunks (MySQL tiene límite de placeholders)
                foreach (array_chunk($planInsert, 100) as $chunk) {
                    DB::table('plan_de_pagos')->insert($chunk);
                }
            }

            // 4) FORMALIZACION — asiento histórico en fecha de desembolso
            $sufijoFormalizacion = $pagosReales->isNotEmpty()
                ? $this->resolverSufijoDePago($pagosReales->first()->num_comprobante, $sufijoCredito)
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
                $idSeq = $this->formatIdSeq($t->id_seq);
                $sufijoPago = $this->resolverSufijoDePago($t->num_comprobante, $sufijoCredito);
                $pagoDeductoraId = $sufijoPago ? ($this->deductoraIdPorSufijo[$sufijoPago] ?? null) : null;
                $fechaPago = $this->fechaHibrida($t->num_comprobante, $t->mov_fecha, $fechaForm);

                $montoPago = (float) $t->mov_monto;
                $capital   = (float) $t->mov_principal;
                $saldoAnt  = $saldoActual;
                $saldoActual = max(0.0, round($saldoActual - $capital, 2));

                $referencia = $this->buildReferenciaPago($rc, $t, $sufijoPago);

                $payment = CreditPayment::create([
                    'credit_id'         => $credit->id,
                    'linea'             => $idSeq,
                    'numero_cuota'      => (int) $t->num_cuota,
                    'fecha_pago'        => $fechaPago,
                    'cuota'             => (float) $rc->cuota,
                    'monto'             => $montoPago,
                    'poliza'            => (float) $t->mov_poliza,
                    'interes_corriente' => (float) $t->mov_intcor,
                    'interes_moratorio' => (float) $t->mov_intmor,
                    'amortizacion'      => $capital,
                    'saldo_anterior'    => $saldoAnt,
                    'nuevo_saldo'       => $saldoActual,
                    'estado'            => 'Pagado',
                    'fecha_movimiento'  => $fechaPago,
                    'movimiento_total'  => $montoPago,
                    'movimiento_amortizacion' => $capital,
                    'tasa_actual'       => (float) $rc->tasa,
                    'plazo_actual'      => (int) $rc->plazo,
                    'source'            => $pagoDeductoraId ? 'Planilla' : 'Ventanilla',
                    'referencia'        => $referencia,
                    'cedula'            => $persona->cedula,
                ]);
                $stats['pagos']++;

                $cargos = (float) $t->mov_cargos;
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
                            'interes_corriente'        => (float) $t->mov_intcor,
                            'interes_moratorio'        => (float) $t->mov_intmor,
                            'poliza'                   => (float) $t->mov_poliza,
                            'capital'                  => $capital,
                            'sobrante'                 => 0,
                            'cargos_adicionales_total' => $cargos,
                            'cargos_adicionales'       => $cargos > 0 ? ['otros' => $cargos] : [],
                        ],
                    ],
                ];
            }

            // 6) Saldo + última fecha en Credit (faithful al legacy)
            $credit->saldo = (float) $rc->saldo;  // valor exacto del SQL
            if ($pagosReales->isNotEmpty()) {
                $credit->fecha_ultimo_pago = $this->fechaValida($pagosReales->last()->mov_fecha);
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
        $seqDigits = str_replace('.', '', $this->formatIdSeq($t->id_seq));
        if ($sufijo) {
            return "LEG-{$rc->codigo}-{$rc->id_solicitud}-{$seqDigits}-PLA{$seqDigits}.{$sufijo}.CRD";
        }
        return "LEG-{$rc->codigo}-{$rc->id_solicitud}-{$seqDigits}";
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
            ->get()
            ->map(fn ($r) => $this->normRow($r))
            ->keyBy('ced');

        $emailsCandidatos = array_filter($socios->map(
            fn ($s) => filter_var(strtolower(trim((string) ($s->af_email ?: $s->email_02))), FILTER_VALIDATE_EMAIL) ?: null
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
            'name'      => $this->limpiar($s->nombrev2) ?: $this->derivarNombres($s),
            'apellido1' => $this->limpiar($s->apellido1),
            'apellido2' => $this->limpiar($s->apellido2),
        ];

        $fnac = $this->fechaValida($s->fecha_nac);
        if ($fnac) $payload['fecha_nacimiento'] = $fnac;

        $genero = strtoupper(trim((string) $s->sexo));
        if ($genero === 'M') $payload['genero'] = 'Masculino';
        elseif ($genero === 'F') $payload['genero'] = 'Femenino';

        $dir = $this->limpiar($s->direccion);
        if ($dir) $payload['direccion1'] = $dir;

        $inst = $this->limpiar($s->inst);
        if ($inst) $payload['institucion_labora'] = $inst;

        $email = filter_var(strtolower(trim((string) ($s->af_email ?: $s->email_02))), FILTER_VALIDATE_EMAIL) ?: null;
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
        $full = trim((string) $s->nombre);
        $ap = trim(($s->apellido1 ?? '') . ' ' . ($s->apellido2 ?? ''));
        if ($ap !== '' && stripos($full, $ap) === 0) {
            return $this->limpiar(substr($full, strlen($ap)));
        }
        return $this->limpiar($full);
    }
}
