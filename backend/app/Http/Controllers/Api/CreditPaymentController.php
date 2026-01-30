<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CreditPayment;
use App\Models\PlanDePago;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Credit;
use App\Models\LoanConfiguration;
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

        $payment = DB::transaction(function () use ($validated) {
            // 🔒 LOCK: Obtener crédito con bloqueo pesimista para prevenir race conditions
            $credit = Credit::lockForUpdate()->findOrFail($validated['credit_id']);

            return $this->processPaymentTransaction(
                $credit,
                $validated['monto'],
                $validated['fecha'],
                $validated['origen'] ?? 'Ventanilla',
                $credit->lead->cedula ?? null
            );
        });

        // Recargar el crédito actualizado
        $credit = Credit::find($validated['credit_id']);

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

        // CASO 1: PAGO NORMAL / ADELANTO SIMPLE (Sin Recálculo)
        if (($validated['tipo'] ?? '') !== 'extraordinario') {
            $result = DB::transaction(function () use ($validated) {
                // 🔒 LOCK: Obtener crédito con bloqueo pesimista
                $credit = Credit::lockForUpdate()->findOrFail($validated['credit_id']);

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

            $credit = Credit::find($validated['credit_id']);
            return response()->json([
                'message' => 'Pago aplicado correctamente.',
                'payment' => $result,
                'nuevo_saldo' => $credit->saldo
            ]);
        }

        // CASO 2: ABONO EXTRAORDINARIO (Recálculo de Tabla)
        $result = DB::transaction(function () use ($validated) {
            // 🔒 LOCK: Obtener crédito con bloqueo pesimista
            $credit = Credit::lockForUpdate()->findOrFail($validated['credit_id']);
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
            'nuevo_saldo' => Credit::find($validated['credit_id'])->saldo
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
            while ($saldo > 0.01 && $loops < $maxLoops) {
                $fechaIteracion->addMonth();
                $loops++;

                $interes = round($saldo * $tasaMensual, 2);
                $amortizacion = $cuotaFijaActual - $interes;

                // Validar: Si la amortización es negativa o cero, ajustar
                if ($amortizacion <= 0) {
                    // La cuota no alcanza para cubrir ni el interés - liquidar en esta cuota
                    $cuotaReal = $saldo + $interes;
                    $amortizacion = $saldo;
                    $nuevoSaldo = 0;
                } elseif ($saldo <= $amortizacion) {
                    $amortizacion = $saldo;
                    $cuotaReal = $saldo + $interes; // Última cuota ajustada
                    $nuevoSaldo = 0;
                } else {
                    $cuotaReal = $cuotaFijaActual;
                    $nuevoSaldo = round($saldo - $amortizacion, 2);
                }

                // Protección final: Si estamos cerca del límite y queda saldo residual, liquidarlo
                if ($loops >= $maxLoops - 1 && $nuevoSaldo > 0) {
                    $cuotaReal += $nuevoSaldo;
                    $amortizacion += $nuevoSaldo;
                    $nuevoSaldo = 0;
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

        // Obtener cuotas en orden: primero las que están en "Mora", luego "Pendiente" o "Parcial"
        // Esto asegura que el pago se aplique primero a las deudas más antiguas/atrasadas
        $query = $credit->planDePagos()
            ->whereIn('estado', ['Mora', 'Pendiente', 'Parcial'])
            ->where('numero_cuota', '>', 0);
        if (is_array($cuotasSeleccionadas) && count($cuotasSeleccionadas) > 0) {
            $query->whereIn('id', $cuotasSeleccionadas);
        }
        // Ordenar: Mora primero, luego Parcial, luego Pendiente, y dentro de cada grupo por numero_cuota
        $cuotas = $query->orderByRaw("FIELD(estado, 'Mora', 'Parcial', 'Pendiente')")
            ->orderBy('numero_cuota', 'asc')
            ->get();

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

            // Separar pendientes de interés corriente y vencido
            $pendienteIntVencido = max(0.0, ($cuota->int_corriente_vencido ?? 0) - ($cuota->movimiento_int_corriente_vencido ?? 0));
            $pendienteIntCorriente = max(0.0, ($cuota->interes_corriente ?? 0) - ($cuota->movimiento_interes_corriente ?? 0));

            // Sumar carry de interés al pendiente vencido primero
            $pendienteIntVencido += $carryInteres;

            $pendientePoliza = max(0.0, $cuota->poliza - $cuota->movimiento_poliza);
            $pendientePrincipal = max(0.0, $cuota->amortizacion - $cuota->movimiento_principal) + $carryAmort;

            // B. Aplicar Pagos
            $pagoMora = min($dineroDisponible, $pendienteMora);
            $cuota->movimiento_interes_moratorio += $pagoMora;
            $dineroDisponible -= $pagoMora;

            // Pagar primero interés corriente vencido
            $pagoIntVencido = 0;
            if ($dineroDisponible > 0 && $pendienteIntVencido > 0) {
                $pagoIntVencido = min($dineroDisponible, $pendienteIntVencido);
                $cuota->movimiento_int_corriente_vencido = ($cuota->movimiento_int_corriente_vencido ?? 0) + $pagoIntVencido;
                $dineroDisponible -= $pagoIntVencido;
            }

            // Luego pagar interés corriente
            $pagoIntCorriente = 0;
            if ($dineroDisponible > 0 && $pendienteIntCorriente > 0) {
                $pagoIntCorriente = min($dineroDisponible, $pendienteIntCorriente);
                $cuota->movimiento_interes_corriente += $pagoIntCorriente;
                $dineroDisponible -= $pagoIntCorriente;
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
            $leftIntVencido = $pendienteIntVencido - $pagoIntVencido;
            $leftIntCorriente = $pendienteIntCorriente - $pagoIntCorriente;
            $leftAmort = $pendientePrincipal - $pagoPrincipal;

            // Only carry to next cuota, not last
            if ($i < $cuotasCount - 1) {
                // Carry suma ambos tipos de interés pendientes
                $carryInteres = max(0.0, $leftIntVencido + $leftIntCorriente);
                $carryAmort = max(0.0, $leftAmort);
            } else {
                $carryInteres = 0.0;
                $carryAmort = 0.0;
            }

            $totalPagadoEnEstaTransaccion = $pagoMora + $pagoIntVencido + $pagoIntCorriente + $pagoPoliza + $pagoPrincipal;
            $cuota->movimiento_total += $totalPagadoEnEstaTransaccion;
            $cuota->movimiento_amortizacion += $pagoPrincipal;
            $cuota->fecha_movimiento = $fecha;

            // Calcular total exigible incluyendo int_corriente_vencido
            $totalExigible = $cuota->interes_corriente
                           + $cuota->int_corriente_vencido
                           + $cuota->interes_moratorio
                           + $cuota->poliza
                           + $cuota->amortizacion;

            if ($cuota->movimiento_total >= ($totalExigible - 0.05)) {
                // Si la cuota tenía mora, marcar como Pagado/Mora para distinguir
                $teniaMora = ((float) ($cuota->int_corriente_vencido ?? 0) > 0) || ((float) ($cuota->interes_moratorio ?? 0) > 0) || ((int) ($cuota->dias_mora ?? 0) > 0);
                $cuota->estado = $teniaMora ? 'Pagado/Mora' : 'Pagado';
                $cuota->fecha_pago = $fecha;
                $cuota->concepto = $teniaMora ? 'Pago registrado (mora)' : 'Pago registrado';
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
     * Carga masiva de planilla con cálculo de mora
     *
     * Flujo:
     * 1. Procesa pagos para personas EN la lista (de la deductora seleccionada)
     * 2. Calcula mora para créditos de ESA deductora que NO están en la lista
     */
    public function upload(Request $request)
    {
        $validated = $request->validate([
            'file' => 'required|file',
            'deductora_id' => 'required|exists:deductoras,id',
            'fecha_test' => 'nullable|date', // Solo para pruebas en localhost
        ]);

        $deductoraId = $request->input('deductora_id');

        // Usar fecha de prueba si se proporciona (solo para desarrollo/testing)
        $fechaTest = $request->input('fecha_test');
        $fechaPago = $fechaTest ? Carbon::parse($fechaTest) : now();

        // Mes que se está pagando (planillas llegan 1 mes después)
        $mesPago = $fechaPago->copy()->subMonth();
        $diasDelMes = $mesPago->daysInMonth;

        // Tasa de mora desde configuración (loan_configurations.tasa_anual)
        $config = LoanConfiguration::where('activo', true)->first();
        $tasaMora = $config ? (float) $config->tasa_anual : 33.5;

        $file = $request->file('file');
        $path = $file->store('uploads/planillas', 'public');
        $fullPath = storage_path('app/public/' . $path);
        $results = [];
        $delimiter = ',';

        // IDs de créditos que SÍ pagaron (para excluir del cálculo de mora)
        $creditosQuePagaron = [];

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

            // PASO 1: Procesar pagos de personas EN la lista
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

                // Buscar crédito SOLO de la deductora seleccionada
                $credit = Credit::where('deductora_id', $deductoraId)
                    ->whereHas('lead', function($q) use ($rawCedula, $cleanCedula) {
                        $q->where('cedula', $rawCedula)->orWhere('cedula', $cleanCedula);
                    })->first();

                if ($credit) {
                    // Registrar que este crédito SÍ pagó
                    $creditosQuePagaron[] = $credit->id;

                    // Detectar formato: europeo (8.167,97) vs americano (8,167.97)
                    $lastComma = strrpos($rawMonto, ',');
                    $lastDot = strrpos($rawMonto, '.');
                    if ($lastComma !== false && $lastDot !== false) {
                        if ($lastComma > $lastDot) {
                            $cleanMonto = str_replace('.', '', $rawMonto);
                            $cleanMonto = str_replace(',', '.', $cleanMonto);
                        } else {
                            $cleanMonto = str_replace(',', '', $rawMonto);
                        }
                    } elseif ($lastComma !== false && $lastDot === false) {
                        $cleanMonto = str_replace(',', '.', $rawMonto);
                    } else {
                        $cleanMonto = $rawMonto;
                    }
                    $montoPagado = (float) preg_replace('/[^0-9\.]/', '', $cleanMonto);
                    if ($montoPagado > 0) {
                        $creditId = $credit->id;
                        $payment = DB::transaction(function () use ($creditId, $montoPagado, $fechaPago, $rawCedula) {
                            // 🔒 LOCK: Obtener crédito con bloqueo pesimista dentro de la transacción
                            $credit = Credit::lockForUpdate()->findOrFail($creditId);
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

            // PASO 2: Calcular mora para créditos de ESTA deductora que NO pagaron
            $moraResults = $this->calcularMoraAusentes($deductoraId, $creditosQuePagaron, $mesPago, $diasDelMes, $tasaMora);

            return response()->json([
                'message' => 'Proceso completado',
                'results' => $results,
                'mora_aplicada' => $moraResults
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Calcula mora para créditos formalizados de una deductora que NO están en la planilla
     *
     * Lógica:
     * 1. Marca la cuota pendiente más antigua como "Mora" SIN modificar montos originales
     * 2. Mueve interes_corriente → int_corriente_vencido
     * 3. Si tasa_anual = tasa_maxima → interes_moratorio = 0
     * 4. Agrega cuota desplazada al final del plan para que el saldo llegue a 0
     * 5. NO recalcula cuotas siguientes
     */
    private function calcularMoraAusentes($deductoraId, $creditosQuePagaron, $mesPago, $diasDelMes, $tasaMora)
    {
        $moraResults = [];

        $creditosSinPago = Credit::whereIn('status', ['Formalizado', 'En Mora'])
            ->where('deductora_id', $deductoraId)
            ->whereNotNull('formalized_at')
            ->whereNotIn('id', $creditosQuePagaron)
            ->get();

        foreach ($creditosSinPago as $credit) {
            $inicioMora = Carbon::parse($credit->formalized_at)
                ->startOfMonth()
                ->addMonth();

            if ($mesPago->lt($inicioMora)) {
                $moraResults[] = [
                    'credit_id' => $credit->id,
                    'lead' => $credit->lead->name ?? 'N/A',
                    'status' => 'muy_nuevo',
                    'mensaje' => 'Crédito muy nuevo, aún no genera mora'
                ];
                continue;
            }

            // Buscar cuota pendiente más antigua
            $cuota = $credit->planDePagos()
                ->where('numero_cuota', '>', 0)
                ->where('estado', 'Pendiente')
                ->orderBy('numero_cuota')
                ->first();

            if (!$cuota) {
                $moraResults[] = [
                    'credit_id' => $credit->id,
                    'lead' => $credit->lead->name ?? 'N/A',
                    'status' => 'sin_cuotas_pendientes'
                ];
                continue;
            }

            // Tasa congelada del crédito
            $tasaBase = (float) ($credit->tasa_anual ?? 0);
            $tasaMaxima = (float) ($credit->tasa_maxima ?? 0);
            $diferenciaTasa = $tasaMaxima - $tasaBase;

            // Guardar amortización original para la cuota desplazada
            $amortizacionOriginal = (float) $cuota->amortizacion;

            // Capital REAL del crédito (no el planificado)
            $capitalReal = (float) $credit->saldo;
            $tasaMensual = $tasaBase / 100 / 12;

            // 1. Interés vencido = calculado sobre el capital REAL (no el planificado)
            //    Si no pagó varias veces seguidas, el capital es el mismo → interés es el mismo
            $interesVencido = round($capitalReal * $tasaMensual, 2);
            $cuota->int_corriente_vencido = $interesVencido;
            $cuota->interes_corriente = 0;

            // 2. Interés moratorio: solo si hay diferencia entre tasas
            if ($diferenciaTasa > 0) {
                $interesMoratorio = round($capitalReal * $diferenciaTasa / 100 / 12, 2);
                $cuota->interes_moratorio = ($cuota->interes_moratorio ?? 0) + $interesMoratorio;
            } else {
                $cuota->interes_moratorio = 0;
            }

            // 3. No se pagó: amortización = 0, capital no baja
            $cuota->amortizacion = 0;

            // 4. Capital (saldo_anterior) = capital REAL, no baja
            $cuota->saldo_anterior = $capitalReal;

            // 5. Saldo = capital (no baja) + interés vencido + moratorio
            $intMora = (float) $cuota->interes_moratorio;
            $poliza = (float) ($cuota->poliza ?? 0);
            $cuota->saldo_nuevo = round($capitalReal + $interesVencido + $intMora, 2);

            // 6. Marcar como Mora (la cuota original NO se modifica)
            $cuota->estado = 'Mora';
            $cuota->dias_mora = 30;
            $cuota->save();

            // 7. Recalcular la SIGUIENTE cuota pendiente para que refleje el capital real
            $siguienteCuota = $credit->planDePagos()
                ->where('numero_cuota', '>', $cuota->numero_cuota)
                ->where('estado', 'Pendiente')
                ->orderBy('numero_cuota')
                ->first();

            if ($siguienteCuota) {
                $siguienteCuota->saldo_anterior = $capitalReal;
                $siguienteCuota->interes_corriente = $interesVencido;
                $siguienteCuota->amortizacion = round($siguienteCuota->cuota - $interesVencido - ($siguienteCuota->poliza ?? 0), 2);
                $siguienteCuota->saldo_nuevo = round($capitalReal - $siguienteCuota->amortizacion, 2);
                $siguienteCuota->save();
            }

            // 8. Agregar cuota desplazada al final del plan (con la amortización original)
            $this->agregarCuotaDesplazada($credit, $amortizacionOriginal);

            // 9. Cambiar estado del crédito
            Credit::where('id', $credit->id)->update(['status' => 'En Mora']);

            $moraResults[] = [
                'credit_id' => $credit->id,
                'lead' => $credit->lead->name ?? 'N/A',
                'cuota_numero' => $cuota->numero_cuota,
                'int_corriente_vencido' => $interesVencido,
                'tasa_base' => $tasaBase,
                'tasa_maxima' => $tasaMaxima,
                'diferencia_tasa' => $diferenciaTasa,
                'interes_moratorio' => (float) $cuota->interes_moratorio,
                'status' => 'mora_aplicada'
            ];
        }

        return $moraResults;
    }

    /**
     * Agrega una cuota al final del plan cuando una cuota entra en mora (desplazamiento)
     *
     * La cuota en mora no se pagó, así que su amortización no se aplicó al saldo.
     * Esta nueva cuota al final del plan cubre ese capital pendiente para que
     * el saldo llegue a 0 al terminar el plan extendido.
     *
     * @param Credit $credit El crédito
     * @param float $amortizacionOriginal La amortización que no se pagó en la cuota mora
     */
    private function agregarCuotaDesplazada(Credit $credit, float $amortizacionOriginal)
    {
        if ($amortizacionOriginal <= 0) return;

        $ultimaCuota = $credit->planDePagos()
            ->where('numero_cuota', '>', 0)
            ->orderBy('numero_cuota', 'desc')
            ->first();

        if (!$ultimaCuota) return;

        $nuevoNumero = $ultimaCuota->numero_cuota + 1;
        $fechaCorte = Carbon::parse($ultimaCuota->fecha_corte)->addMonth();
        $fechaInicio = Carbon::parse($ultimaCuota->fecha_corte);

        $tasaAnual = (float) ($credit->tasa_anual ?? 0);
        $tasaMensual = $tasaAnual / 100 / 12;
        $plazo = (int) $credit->plazo;

        // Incrementar saldo_nuevo de la cuota final del plazo original
        // para que refleje el capital desplazado que aún se debe
        $credit->planDePagos()
            ->where('numero_cuota', $plazo)
            ->increment('saldo_nuevo', $amortizacionOriginal);

        // Incrementar saldo_anterior y saldo_nuevo de cuotas desplazadas existentes
        // para reflejar el nuevo capital acumulado
        $credit->planDePagos()
            ->where('numero_cuota', '>', $plazo)
            ->increment('saldo_anterior', $amortizacionOriginal);

        $credit->planDePagos()
            ->where('numero_cuota', '>', $plazo)
            ->increment('saldo_nuevo', $amortizacionOriginal);

        // Interés sobre el capital de ESTA cuota desplazada
        $interes = round($amortizacionOriginal * $tasaMensual, 2);
        $cuotaMonto = round($amortizacionOriginal + $interes, 2);

        PlanDePago::create([
            'credit_id'         => $credit->id,
            'numero_cuota'      => $nuevoNumero,
            'fecha_inicio'      => $fechaInicio,
            'fecha_corte'       => $fechaCorte,
            'tasa_actual'       => $tasaAnual,
            'cuota'             => $cuotaMonto,
            'poliza'            => 0,
            'interes_corriente' => $interes,
            'amortizacion'      => $amortizacionOriginal,
            'saldo_anterior'    => $amortizacionOriginal,
            'saldo_nuevo'       => 0,
            'estado'            => 'Pendiente',
            'movimiento_total'  => 0,
            'movimiento_poliza' => 0,
            'movimiento_principal' => 0,
            'movimiento_interes_corriente' => 0,
            'movimiento_interes_moratorio' => 0,
        ]);
    }

    public function show(string $id) { return response()->json([], 200); }
    public function update(Request $request, string $id) { return response()->json([], 200); }
    public function destroy(string $id) { return response()->json([], 200); }
}
