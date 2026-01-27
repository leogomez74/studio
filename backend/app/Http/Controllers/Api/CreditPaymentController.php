<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CreditPayment;
use App\Models\PlanDePago;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Credit;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\Csv;
use Carbon\Carbon;

class CreditPaymentController extends Controller
{
    /**
     * Listar todos los pagos
     */
    public function index()
    {
        $payments = CreditPayment::with('credit.lead')
            ->orderBy('created_at', 'desc')
            ->get();
        return response()->json($payments);
    }

    /**
     * Registrar pago normal (Ventanilla)
     * Usa la lógica de cascada estándar (Mora -> Interés -> Capital)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'credit_id' => 'required|exists:credits,id',
            'monto'     => 'required|numeric|min:0.01',
            'fecha'     => 'required|date',
            'origen'    => 'nullable|string',
        ]);

        $credit = Credit::findOrFail($validated['credit_id']);

        $payment = DB::transaction(function () use ($credit, $validated) {
            return $this->processPaymentTransaction(
                $credit,
                $validated['monto'],
                $validated['fecha'],
                $validated['origen'] ?? 'Ventanilla',
                $credit->lead->cedula ?? null
            );
        });

        return response()->json([
            'message' => 'Pago aplicado correctamente',
            'payment' => $payment,
            'credit_summary' => ['saldo_credito' => $credit->saldo]
        ], 201);
    }

    /**
     * Adelanto / Abono Extraordinario
     * Lógica optimizada: Aplicación directa a capital y regeneración de tabla.
     */
    public function adelanto(Request $request)
    {
        $validated = $request->validate([
            'credit_id' => 'required|exists:credits,id',
            'tipo'      => 'nullable|string',
            'monto'     => 'required|numeric|min:0.01',
            'fecha'     => 'required|date',
            'extraordinary_strategy' => 'nullable|required_if:tipo,extraordinario|in:reduce_amount,reduce_term',
            'cuotas'    => 'nullable|array', // IDs de cuotas seleccionadas para adelanto
        ]);

        $credit = Credit::findOrFail($validated['credit_id']);

        // CASO 1: PAGO NORMAL / ADELANTO SIMPLE (Sin Recálculo)
        if (($validated['tipo'] ?? '') !== 'extraordinario') {
            $result = DB::transaction(function () use ($credit, $validated) {
                // Si es adelanto y hay cuotas seleccionadas, pasar IDs
                $cuotasSeleccionadas = $validated['cuotas'] ?? null;
                return $this->processPaymentTransaction(
                    $credit,
                    $validated['monto'],
                    $validated['fecha'],
                    ($validated['tipo'] ?? '') === 'adelanto' ? 'Adelanto de Cuotas' : 'Adelanto Simple',
                    $credit->lead->cedula ?? null,
                    $cuotasSeleccionadas
                );
            });
            return response()->json([
                'message' => 'Pago aplicado correctamente.',
                'payment' => $result,
                'nuevo_saldo' => $credit->fresh()->saldo
            ]);
        }

        // CASO 2: ABONO EXTRAORDINARIO (Recálculo de Tabla)
        $result = DB::transaction(function () use ($credit, $validated) {
            $montoAbono = $validated['monto'];
            $fechaPago = $validated['fecha'];
            $strategy = $validated['extraordinary_strategy'];

            // 1. Identificar punto de partida (Primera cuota no pagada)
            $siguienteCuota = $credit->planDePagos()
                ->where('estado', '!=', 'Pagado')
                ->where('cuota', '>', 0)
                ->orderBy('numero_cuota', 'asc')
                ->first();

            if (!$siguienteCuota) {
                throw new \Exception("No hay cuotas pendientes amortizables (mayores a 0).");
            }

            $numeroCuotaInicio = $siguienteCuota->numero_cuota;

            // 2. Aplicar directo al Saldo (Capital Vivo)
            $saldoActual = (float) $credit->saldo;

            if ($montoAbono >= $saldoActual) {
                $montoAbono = $saldoActual;
                $nuevoCapitalBase = 0;
            } else {
                $nuevoCapitalBase = round($saldoActual - $montoAbono, 2);
            }

            $credit->saldo = $nuevoCapitalBase;
            $credit->save();

            // Recibo de abono a capital
            $paymentRecord = CreditPayment::create([
                'credit_id'      => $credit->id,
                'numero_cuota'   => 0,
                'fecha_pago'     => $fechaPago,
                'monto'          => $montoAbono,
                'saldo_anterior' => $saldoActual,
                'nuevo_saldo'    => $nuevoCapitalBase,
                'estado'         => 'Abono Extraordinario',
                'amortizacion'   => $montoAbono,
                'source'         => 'Extraordinario',
                'movimiento_total' => $montoAbono,
                'interes_corriente' => 0,
                'cedula'         => $credit->lead->cedula ?? null
            ]);

            // 3. Regenerar Proyección
            if ($nuevoCapitalBase > 0) {
                $this->regenerarProyeccion(
                    $credit,
                    $strategy,
                    $nuevoCapitalBase,
                    $numeroCuotaInicio,
                    $siguienteCuota->fecha_corte
                );
            } else {
                // Crédito finalizado
                PlanDePago::where('credit_id', $credit->id)
                    ->where('numero_cuota', '>=', $numeroCuotaInicio)
                    ->delete();
                $credit->status = 'Finalizado';
                $credit->save();
            }

            return $paymentRecord;
        });

        return response()->json([
            'message' => 'Abono extraordinario aplicado y plan regenerado.',
            'payment' => $result,
            'nuevo_saldo' => $credit->fresh()->saldo
        ]);
    }

    /**
     * Lógica de Regeneración (Paso 3)
     * Borra y recrea las cuotas futuras basándose en el nuevo saldo.
     */
    private function regenerarProyeccion(Credit $credit, $strategy, $nuevoCapital, $startCuotaNum, $fechaPrimerVencimiento)
    {
        if($startCuotaNum < 1){
            $startCuotaNum = 1;
        }

        // Capturar el valor de póliza ANTES de borrar las cuotas (se definió al formalizar)
        $polizaOriginal = PlanDePago::where('credit_id', $credit->id)
            ->where('numero_cuota', '>=', $startCuotaNum)
            ->value('poliza') ?? 0;

        // 1. LIMPIEZA: Borramos el plan desde la cuota actual en adelante.
        PlanDePago::where('credit_id', $credit->id)
            ->where('numero_cuota', '>=', $startCuotaNum)
            ->delete();

        $tasaAnual = (float) $credit->tasa_anual;
        $tasaMensual = ($tasaAnual / 100) / 12;

        // Arrancamos un mes antes de la fecha de corte actual para sumar 1 mes en el bucle
        $fechaIteracion = Carbon::parse($fechaPrimerVencimiento)->subMonth();

        // --- ESTRATEGIA: REDUCIR CUOTA (Mantener Plazo) ---
        if ($strategy === 'reduce_amount') {

            // Cuántas cuotas faltaban originalmente
            $cuotasRestantes = $credit->plazo - $startCuotaNum + 1;
            if ($cuotasRestantes < 1) $cuotasRestantes = 1; // Protección mínima

            // Calculamos nueva cuota fija
            if ($tasaMensual > 0) {
                $potencia = pow(1 + $tasaMensual, $cuotasRestantes);
                $nuevaCuotaMonto = $nuevoCapital * ($tasaMensual * $potencia) / ($potencia - 1);
            } else {
                $nuevaCuotaMonto = $nuevoCapital / $cuotasRestantes;
            }
            $nuevaCuotaMonto = round($nuevaCuotaMonto, 2);

            // Actualizamos la cuota fija en la cabecera
            $credit->cuota = $nuevaCuotaMonto;
            $credit->save();

            $saldo = $nuevoCapital;

            for ($i = 0; $i < $cuotasRestantes; $i++) {
                $numeroReal = $startCuotaNum + $i;
                $fechaIteracion->addMonth();

                $interes = round($saldo * $tasaMensual, 2);

                if ($i == $cuotasRestantes - 1) {
                    $amortizacion = $saldo;
                    $cuotaFinal = $saldo + $interes;
                } else {
                    $amortizacion = $nuevaCuotaMonto - $interes;
                    $cuotaFinal = $nuevaCuotaMonto;
                }

                $nuevoSaldo = round($saldo - $amortizacion, 2);

                $this->crearCuota($credit->id, $numeroReal, $fechaIteracion, $tasaAnual, $cuotaFinal, $interes, $amortizacion, $saldo, $nuevoSaldo, $polizaOriginal);

                $saldo = $nuevoSaldo;
            }
        }

        // --- ESTRATEGIA: REDUCIR PLAZO (Mantener Cuota) ---
        elseif ($strategy === 'reduce_term') {

            $cuotaFijaActual = (float) $credit->cuota;

            // Safety check: Si la cuota vieja es inválida, calculamos una mínima
            $interesMinimo = $nuevoCapital * $tasaMensual;
            if ($cuotaFijaActual <= $interesMinimo) {
                $cuotaFijaActual = $interesMinimo + 1.00;
            }

            $saldo = $nuevoCapital;
            $contadorCuota = $startCuotaNum;
            $maxLoops = 360;
            $loops = 0;

            // Descontamos continuamente mes a mes hasta que saldo llegue a 0
            while ($saldo > 0.05 && $loops < $maxLoops) {
                $fechaIteracion->addMonth();
                $loops++;

                $interes = round($saldo * $tasaMensual, 2);
                $amortizacion = $cuotaFijaActual - $interes;

                if ($saldo <= $amortizacion) {
                    $amortizacion = $saldo;
                    $cuotaReal = $saldo + $interes; // Última cuota ajustada
                    $nuevoSaldo = 0;
                } else {
                    $cuotaReal = $cuotaFijaActual;
                    $nuevoSaldo = round($saldo - $amortizacion, 2);
                }

                $this->crearCuota($credit->id, $contadorCuota, $fechaIteracion, $tasaAnual, $cuotaReal, $interes, $amortizacion, $saldo, $nuevoSaldo, $polizaOriginal);

                $saldo = $nuevoSaldo;
                $contadorCuota++;
            }

            // Actualizamos el plazo total del crédito
            $credit->plazo = $contadorCuota - 1;
            $credit->save();
        }
    }

    /**
     * Helper para crear el registro en la BD
     * $poliza: Monto de póliza por cuota (se mantiene desde la formalización)
     */
    private function crearCuota($creditId, $numero, $fecha, $tasa, $cuota, $interes, $amortizacion, $saldoAnt, $saldoNuevo, $poliza = 0)
    {
        PlanDePago::create([
            'credit_id'         => $creditId,
            'numero_cuota'      => $numero,
            'fecha_inicio'      => $fecha->copy()->subMonth(),
            'fecha_corte'       => $fecha->copy(),
            'tasa_actual'       => $tasa,
            'cuota'             => $cuota + $poliza,
            'poliza'            => $poliza,
            'interes_corriente' => $interes,
            'amortizacion'      => $amortizacion,
            'saldo_anterior'    => max(0, $saldoAnt),
            'saldo_nuevo'       => max(0, $saldoNuevo),
            'estado'            => 'Pendiente',
            'movimiento_total'  => 0,
            'movimiento_poliza' => 0,
            'movimiento_principal' => 0,
            'movimiento_interes_corriente' => 0,
            'movimiento_interes_moratorio' => 0
        ]);
    }

    /**
     * Lógica "Cascada" (Waterfall) para pagos regulares
     * IMPUTACIÓN: Mora -> Interés -> Cargos -> Capital
     */
    private function processPaymentTransaction(Credit $credit, $montoEntrante, $fecha, $source, $cedulaRef = null, $cuotasSeleccionadas = null)
    {
        $dineroDisponible = $montoEntrante;

        $query = $credit->planDePagos()
            ->where('estado', '!=', 'Pagado')
            ->where('numero_cuota', '>', 0);
        if (is_array($cuotasSeleccionadas) && count($cuotasSeleccionadas) > 0) {
            $query->whereIn('id', $cuotasSeleccionadas);
        }
        $cuotas = $query->orderBy('numero_cuota', 'asc')->get();

        $primerCuotaAfectada = null;
        $saldoAnteriorSnapshot = 0;
        $saldoCreditoAntes = $credit->saldo;

        $carryInteres = 0.0;
        $carryAmort = 0.0;
        $cuotasArr = $cuotas->all();
        $cuotasCount = count($cuotasArr);

        // --- CORRECCIÓN: Variable para acumular solo lo amortizado HOY ---
        $capitalAmortizadoHoy = 0.0;

        foreach ($cuotasArr as $i => $cuota) {
            if ($dineroDisponible <= 0.005) break;

            if (!$primerCuotaAfectada) {
                $primerCuotaAfectada = $cuota;
                $saldoAnteriorSnapshot = ($cuota->cuota + $cuota->interes_moratorio) - $cuota->movimiento_total;
            }

            // A. Pendientes
            $pendienteMora = max(0.0, $cuota->interes_moratorio - $cuota->movimiento_interes_moratorio);
            $pendienteInteres = max(0.0, $cuota->interes_corriente - $cuota->movimiento_interes_corriente) + $carryInteres;
            $pendientePoliza = max(0.0, $cuota->poliza - $cuota->movimiento_poliza);
            $pendientePrincipal = max(0.0, $cuota->amortizacion - $cuota->movimiento_principal) + $carryAmort;

            // B. Aplicar Pagos
            $pagoMora = min($dineroDisponible, $pendienteMora);
            $cuota->movimiento_interes_moratorio += $pagoMora;
            $dineroDisponible -= $pagoMora;

            $pagoInteres = 0;
            if ($dineroDisponible > 0) {
                $pagoInteres = min($dineroDisponible, $pendienteInteres);
                $cuota->movimiento_interes_corriente += $pagoInteres;
                $dineroDisponible -= $pagoInteres;
            }

            $pagoPoliza = 0;
            if ($dineroDisponible > 0) {
                $pagoPoliza = min($dineroDisponible, $pendientePoliza);
                $cuota->movimiento_poliza += $pagoPoliza;
                $dineroDisponible -= $pagoPoliza;
            }

            $pagoPrincipal = 0;
            if ($dineroDisponible > 0) {
                $pagoPrincipal = min($dineroDisponible, $pendientePrincipal);
                $cuota->movimiento_principal += $pagoPrincipal;
                $dineroDisponible -= $pagoPrincipal;

                // ACUMULAR PARA EL DESCUENTO DE SALDO
                $capitalAmortizadoHoy += $pagoPrincipal;
            }

            // Calculate carry-over for next cuota
            $leftInteres = $pendienteInteres - $pagoInteres;
            $leftAmort = $pendientePrincipal - $pagoPrincipal;
            // Only carry to next cuota, not last
            if ($i < $cuotasCount - 1) {
                $carryInteres = max(0.0, $leftInteres);
                $carryAmort = max(0.0, $leftAmort);
            } else {
                $carryInteres = 0.0;
                $carryAmort = 0.0;
            }

            $totalPagadoEnEstaTransaccion = $pagoMora + $pagoInteres + $pagoPoliza + $pagoPrincipal;
            $cuota->movimiento_total += $totalPagadoEnEstaTransaccion;
            $cuota->movimiento_amortizacion += $pagoPrincipal;
            $cuota->fecha_movimiento = $fecha;

            $totalExigible = $cuota->cuota + $cuota->interes_moratorio + $cuota->poliza;

            if ($cuota->movimiento_total >= ($totalExigible - 0.05)) {
                $cuota->estado = 'Pagado';
                $cuota->fecha_pago = $fecha;
                $cuota->concepto = 'Pago registrado';
            } else {
                $cuota->estado = 'Parcial';
                $cuota->concepto = 'Pago parcial';
            }

            $cuota->save();
        }

        // --- CORRECCIÓN: Actualizar Saldo de forma INCREMENTAL ---
        // Restamos lo que se amortizó HOY al saldo que tenía el crédito ANTES de la transacción
        $credit->saldo = max(0.0, $credit->saldo - $capitalAmortizadoHoy);
        $credit->save();

        // Recibo
        $paymentRecord = CreditPayment::create([
            'credit_id'      => $credit->id,
            'numero_cuota'   => $primerCuotaAfectada ? $primerCuotaAfectada->numero_cuota : 0,
            'fecha_cuota'    => $primerCuotaAfectada ? $primerCuotaAfectada->fecha_corte : null,
            'fecha_pago'     => $fecha,
            'monto'          => $montoEntrante,
            'cuota'          => $saldoAnteriorSnapshot,
            'saldo_anterior' => $saldoCreditoAntes,
            'nuevo_saldo'    => $credit->saldo,
            'estado'         => 'Aplicado',
            'interes_corriente' => $credit->planDePagos()->sum('movimiento_interes_corriente'),
            'amortizacion'      => $credit->planDePagos()->sum('movimiento_amortizacion'),
            'source'            => $source,
            'movimiento_total'  => $dineroDisponible > 0 ? $dineroDisponible : 0,
            'cedula'            => $cedulaRef
        ]);

        return $paymentRecord;
    }

    /**
     * Carga masiva (Se mantiene igual, utiliza processPaymentTransaction)
     */
    public function upload(Request $request)
    {
        $validated = $request->validate([
            'file' => 'required|file',
        ]);

        $fechaPago = now();

        $file = $request->file('file');
        $path = $file->store('uploads/planillas', 'public');
        $fullPath = storage_path('app/public/' . $path);
        $results = [];
        $delimiter = ',';

        try {
            $readerType = IOFactory::identify($fullPath);
            $reader = IOFactory::createReader($readerType);
            if ($readerType === 'Csv') {
                $handle = fopen($fullPath, 'r');
                if ($handle) {
                    $sample = ''; $lineCount = 0;
                    while (($line = fgets($handle)) !== false && $lineCount < 5) { $sample .= $line; $lineCount++; }
                    fclose($handle);
                    if (substr_count($sample, ';') > substr_count($sample, ',')) $delimiter = ';';
                }
                if ($reader instanceof Csv) $reader->setDelimiter($delimiter);
            }
            $spreadsheet = $reader->load($fullPath);
            $rows = $spreadsheet->getActiveSheet()->toArray(null, true, true, true);
            $header = reset($rows);
            $montoCol = null; $cedulaCol = null;
            foreach ($header as $col => $val) {
                $v = mb_strtolower(trim((string)$val));
                if (str_contains($v, 'monto')) $montoCol = $col;
                if (str_contains($v, 'cedula') || str_contains($v, 'cédula')) $cedulaCol = $col;
            }
            if (!$montoCol || !$cedulaCol || $montoCol === $cedulaCol) {
                return response()->json(['message' => 'Error de columnas'], 422);
            }
            $rowIndex = 0;
            foreach ($rows as $row) {
                $rowIndex++;
                if ($rowIndex === 1) continue;
                $rawCedula = trim((string)($row[$cedulaCol] ?? ''));
                $rawMonto  = trim((string)($row[$montoCol] ?? ''));
                $cleanCedula = preg_replace('/[^0-9]/', '', $rawCedula);
                if ($cleanCedula === '' || $rawMonto === '') {
                    $results[] = ['cedula' => $rawCedula, 'status' => 'skipped']; continue;
                }
                $credit = Credit::whereHas('lead', function($q) use ($rawCedula, $cleanCedula) {
                    $q->where('cedula', $rawCedula)->orWhere('cedula', $cleanCedula);
                })->first();
                if ($credit) {
                    // Detectar formato: europeo (8.167,97) vs americano (8,167.97)
                    $lastComma = strrpos($rawMonto, ',');
                    $lastDot = strrpos($rawMonto, '.');
                    if ($lastComma !== false && $lastDot !== false) {
                        if ($lastComma > $lastDot) {
                            // Formato europeo: 8.167,97 → quitar puntos, coma a punto
                            $cleanMonto = str_replace('.', '', $rawMonto);
                            $cleanMonto = str_replace(',', '.', $cleanMonto);
                        } else {
                            // Formato americano: 8,167.97 → quitar comas
                            $cleanMonto = str_replace(',', '', $rawMonto);
                        }
                    } elseif ($lastComma !== false && $lastDot === false) {
                        // Solo coma: 8167,97 → coma a punto
                        $cleanMonto = str_replace(',', '.', $rawMonto);
                    } else {
                        // Solo punto o sin separadores: 8167.97 o 8167
                        $cleanMonto = $rawMonto;
                    }
                    $montoPagado = (float) preg_replace('/[^0-9\.]/', '', $cleanMonto);
                    if ($montoPagado > 0) {
                        $payment = DB::transaction(function () use ($credit, $montoPagado, $fechaPago, $rawCedula) {
                            return $this->processPaymentTransaction($credit, $montoPagado, $fechaPago, 'Planilla', $rawCedula);
                        });
                        if ($payment) {
                            $results[] = ['cedula' => $rawCedula, 'monto' => $montoPagado, 'status' => 'applied', 'lead' => $credit->lead->name ?? 'N/A'];
                        } else {
                            $results[] = ['cedula' => $rawCedula, 'status' => 'paid_or_error'];
                        }
                    } else { $results[] = ['cedula' => $rawCedula, 'status' => 'zero_amount']; }
                } else { $results[] = ['cedula' => $rawCedula, 'status' => 'not_found']; }
            }
            return response()->json(['message' => 'Proceso completado', 'results' => $results]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error', 'error' => $e->getMessage()], 500);
        }
    }

    public function show(string $id) { return response()->json([], 200); }
    public function update(Request $request, string $id) { return response()->json([], 200); }
    public function destroy(string $id) { return response()->json([], 200); }
}
