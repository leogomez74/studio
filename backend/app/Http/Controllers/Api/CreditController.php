<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Credit;
use App\Models\CreditDocument;
use App\Models\PlanDePago;
use App\Models\Lead;
use App\Models\LoanConfiguration;
use App\Helpers\NumberToWords;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class CreditController extends Controller
{
    /**
     * Listar créditos con filtros
     */
    public function index(Request $request)
    {
        $query = Credit::with(['lead', 'opportunity', 'documents','planDePagos']);

        if ($request->has('lead_id')) {
            $query->where('lead_id', $request->lead_id);
        }

        return response()->json($query->latest()->get());
    }

    /**
     * Obtener la próxima referencia disponible
     */
    public function nextReference()
    {
        return response()->json(['reference' => $this->generateReference()]);
    }

    /**
     * Generar referencia automática con formato YY-XXXXX-01-CRED (para preview)
     */
    private function generateReference(): string
    {
        $year = date('y'); // Año en 2 dígitos (26 para 2026)

        // Obtener el último ID de la tabla credits y sumarle 1
        $lastId = Credit::max('id') ?? 0;
        $nextId = $lastId + 1;

        // Formatear con padding de 5 dígitos + sufijo 01 por defecto
        return sprintf('%s-%05d-01-CRED', $year, $nextId);
    }

    /**
     * Generar referencia con el ID real del crédito
     */
    private function generateReferenceWithId(int $id): string
    {
        $year = date('y'); // Año en 2 dígitos (26 para 2026)
        return sprintf('%s-%05d-01-CRED', $year, $id);
    }

    /**
     * Crear Crédito y Generar Tabla de Amortización INICIAL
     */
    public function store(Request $request)
    {
        // 1. Validaciones (Sincronizadas con tu nuevo modelo Credit)
        $validated = $request->validate([
            'reference' => 'nullable|unique:credits,reference',
            'title' => 'required|string',
            'status' => 'required|string',
            'category' => 'nullable|string',
            'lead_id' => 'required|exists:persons,id',
            'opportunity_id' => 'nullable|exists:opportunities,id',
            'assigned_to' => 'nullable|string',
            'opened_at' => 'nullable|date',
            'description' => 'nullable|string',

            // Campos Nuevos
            'tipo_credito' => 'nullable|string',
            'numero_operacion' => 'nullable|string|unique:credits,numero_operacion',
            'deductora_id' => ['nullable', 'integer', 'in:1,2,3'],
            'divisa' => 'nullable|string',
            'garantia' => 'nullable|string',

            // Campos Financieros
            'monto_credito' => 'required|numeric|min:2',
            'plazo' => 'required|integer|min:1',
            'tasa_anual' => 'nullable|numeric',
            'fecha_primera_cuota' => 'nullable|date',
            'poliza' => 'nullable|boolean',
            'poliza_actual' => 'nullable|numeric',

            // Cargos Adicionales
            'cargos_adicionales' => 'nullable|array',
            'cargos_adicionales.comision' => 'nullable|numeric|min:0',
            'cargos_adicionales.transporte' => 'nullable|numeric|min:0',
            'cargos_adicionales.respaldo_deudor' => 'nullable|numeric|min:0',
            'cargos_adicionales.descuento_factura' => 'nullable|numeric|min:0',
        ]);

        // Validar que monto_neto > 0
        $totalCargos = array_sum($validated['cargos_adicionales'] ?? []);
        $montoNeto = $validated['monto_credito'] - $totalCargos;
        if ($montoNeto <= 0) {
            return response()->json([
                'message' => 'El monto neto debe ser mayor a 0. Los cargos adicionales exceden el monto del crédito.',
                'monto_credito' => $validated['monto_credito'],
                'total_cargos' => $totalCargos,
                'monto_neto' => $montoNeto,
            ], 422);
        }

        // Tasa por defecto
        if (!isset($validated['tasa_anual'])) {
            $validated['tasa_anual'] = 33.50;
        }

        // Referencia temporal (se actualiza después con el ID real)
        $validated['reference'] = 'TEMP-' . time();

        $credit = DB::transaction(function () use ($validated) {
            // A. Crear Cabecera
            $credit = Credit::create($validated);

            // B. Generar referencia con el ID real del crédito
            $credit->reference = $this->generateReferenceWithId($credit->id);
            $credit->save();

            // Validar estado antes de crear plan de pagos
            if (strtolower($credit->status) === 'formalizado') {
                $credit->formalized_at = now();
                $credit->save();
                // B. Generar la Tabla de Amortización Inicial (Cuotas 1 a N)
                $this->generateAmortizationSchedule($credit);
            }

            // C. MOVER documentos del Lead (Buzón) al Crédito (Expediente)
            $lead = Lead::with('documents')->find($validated['lead_id']);
            if ($lead && $lead->documents->count() > 0) {
                foreach ($lead->documents as $personDocument) {
                    // 1. Definir nueva ruta
                    $fileName = basename($personDocument->path);
                    $newPath = "credit-docs/{$credit->id}/{$fileName}";

                    // 2. Mover archivo físico
                    if (Storage::disk('public')->exists($personDocument->path)) {
                        // Crear directorio si no existe
                        if (!Storage::disk('public')->exists("credit-docs/{$credit->id}")) {
                            Storage::disk('public')->makeDirectory("credit-docs/{$credit->id}");
                        }

                        // Si el archivo destino ya existe, renombrar (timestamp)
                        if (Storage::disk('public')->exists($newPath)) {
                            $extension = pathinfo($fileName, PATHINFO_EXTENSION);
                            $nameWithoutExt = pathinfo($fileName, PATHINFO_FILENAME);
                            $timestamp = now()->format('Ymd_His');
                            $newPath = "credit-docs/{$credit->id}/{$nameWithoutExt}_{$timestamp}.{$extension}";
                        }

                        Storage::disk('public')->move($personDocument->path, $newPath);

                        // 3. Crear CreditDocument
                        $credit->documents()->create([
                            'name' => $personDocument->name,
                            'notes' => $personDocument->notes,
                            'path' => $newPath,
                            'url' => asset(Storage::url($newPath)),
                            'mime_type' => $personDocument->mime_type,
                            'size' => $personDocument->size,
                        ]);

                        // 4. Eliminar del Buzón (PersonDocument)
                        $personDocument->delete();
                    }
                }
            }
            return $credit;
        });

        return response()->json($credit->load('planDePagos'), 201);
    }

    /**
     * MOTOR DE CÁLCULO INICIAL
     * Genera la línea de inicialización (cuota 0) y las cuotas desde la 1 hasta el Plazo final.
     */
    private function generateAmortizationSchedule(Credit $credit)
    {
        // Calcular monto neto: monto_credito - cargos_adicionales
        $montoCredito = (float) $credit->monto_credito;
        $totalCargos = array_sum($credit->cargos_adicionales ?? []);
        $monto = $montoCredito - $totalCargos;

        $plazo = (int) $credit->plazo;
        $tasaAnual = (float) $credit->tasa_anual;

        // Obtener el monto de póliza solo si el crédito tiene póliza activa
        $polizaPorCuota = 0;
        if ($credit->poliza) {
            // Obtener monto de póliza desde la configuración global
            $loanConfig = LoanConfiguration::where('tipo', 'regular')->first();
            $polizaPorCuota = (float) ($loanConfig->monto_poliza ?? 0);
        }

        $tasaMensual = ($tasaAnual / 100) / 12;

        // 0. Crear línea de inicialización (cuota 0) - Desembolso Inicial
        $existsInitialization = $credit->planDePagos()->where('numero_cuota', 0)->exists();
        if (!$existsInitialization) {
            PlanDePago::create([
                'credit_id' => $credit->id,
                'linea' => '1',
                'numero_cuota' => 0,
                'proceso' => ($credit->opened_at ?? now())->format('Ym'),
                'fecha_inicio' => $credit->opened_at ?? now(),
                'fecha_corte' => null,
                'fecha_pago' => null,
                'tasa_actual' => $tasaAnual,
                'plazo_actual' => $plazo,
                'cuota' => 0,
                'poliza' => 0,
                'interes_corriente' => 0,
                'interes_moratorio' => 0,
                'amortizacion' => 0,
                'saldo_anterior' => 0,
                'saldo_nuevo' => $monto,
                'dias' => 0,
                'estado' => 'Vigente',
                'dias_mora' => 0,
                'fecha_movimiento' => $credit->opened_at ?? now(),
                'movimiento_total' => $monto,
                'movimiento_poliza' => 0,
                'movimiento_interes_corriente' => 0,
                'movimiento_interes_moratorio' => 0,
                'movimiento_principal' => $monto,
                'movimiento_amortizacion' => 0,
                'movimiento_caja_usuario' => 'Sistema',
                'tipo_documento' => 'Formalización',
                'numero_documento' => $credit->numero_operacion,
                'concepto' => 'Desembolso Inicial',
            ]);
        }

        // 1. Cálculo PMT (Cuota Fija)
        if ($tasaMensual > 0) {
            $potencia = pow(1 + $tasaMensual, $plazo);
            $cuotaFija = $monto * ($tasaMensual * $potencia) / ($potencia - 1);
        } else {
            $cuotaFija = $monto / $plazo;
        }
        $cuotaFija = round($cuotaFija, 2);

        // 2. Configurar y Guardar Fechas en el Crédito
        $fechaInicio = $credit->fecha_primera_cuota
            ? Carbon::parse($credit->fecha_primera_cuota)
            : ($credit->opened_at ? Carbon::parse($credit->opened_at) : now());

        // Calculamos fecha fin estimada
        $fechaFinEstimada = $fechaInicio->copy()->addMonths($plazo);

        // Actualizamos el modelo Credit con los datos calculados
        if (!$credit->cuota || !$credit->fecha_culminacion_credito) {
            $credit->cuota = $cuotaFija;
            $credit->fecha_culminacion_credito = $fechaFinEstimada;
            // No tocamos 'saldo' aquí porque ya viene lleno del create()
            $credit->save();
        }

        $saldoPendiente = $monto;

        // Fecha de cobro de la primera cuota (Cuota #1)
        $fechaCobro = $credit->fecha_primera_cuota
            ? Carbon::parse($credit->fecha_primera_cuota)
            : ($credit->opened_at ? Carbon::parse($credit->opened_at)->addMonths(2) : now()->addMonths(2));

        // 3. Bucle de Generación (Empezamos en 1, la 0 ya existe por el Modelo)
        for ($i = 1; $i <= $plazo; $i++) {
            $interesMes = round($saldoPendiente * $tasaMensual, 2);
            if ($i == $plazo) {
                $amortizacionMes = $saldoPendiente;
                $cuotaFija = $saldoPendiente + $interesMes;
            } else {
                $amortizacionMes = $cuotaFija - $interesMes;
            }
            $nuevoSaldo = round($saldoPendiente - $amortizacionMes, 2);
            // Crear registro en plan_de_pagos usando las columnas nuevas
            PlanDePago::create([
                'credit_id' => $credit->id,
                'numero_cuota' => $i,
                'linea' => $credit->category ?? '1',
                'proceso' => ($credit->opened_at ?? now())->format('Ym'),
                'fecha_inicio' => $fechaCobro->copy()->subMonth(),
                'fecha_corte' => $fechaCobro->copy(),
                'fecha_pago' => null,
                'tasa_actual' => $tasaAnual,
                'plazo_actual' => $plazo,
                'cuota' => $cuotaFija + $polizaPorCuota,
                // Desglose financiero
                'interes_corriente' => $interesMes,
                'amortizacion' => $amortizacionMes,
                'poliza' => $polizaPorCuota,
                'interes_moratorio' => 0,
                'saldo_anterior' => $saldoPendiente,
                'saldo_nuevo' => max(0, $nuevoSaldo),
                'dias' => 30,
                'estado' => 'Pendiente',
                'dias_mora' => 0,
                // Inicializar movimientos en 0 (Limpio para futuros pagos)
                'movimiento_total' => 0,
                'movimiento_poliza' => 0,
                'movimiento_interes_corriente' => 0,
                'movimiento_interes_moratorio' => 0,
                'movimiento_principal' => 0,
                'movimiento_amortizacion' => 0,
                'concepto' => 'Cuota Mensual',
            ]);
            // Ya no se guarda primera_deduccion en el modelo Credit
            $saldoPendiente = $nuevoSaldo;
            $fechaCobro->addMonth();
        }
    }

    /**
     * Mostrar Crédito
     */
    public function show($id)
    {
        $credit = Credit::with([
            'lead.documents',
            'opportunity',
            'documents',
            'payments',
            'planDePagos' => function($q) {
                $q->orderBy('numero_cuota', 'asc');
            }
        ])->findOrFail($id);

        // Agregar monto en letras
        $response = $credit->toArray();
        $moneda = $credit->divisa === 'USD' ? 'DOLARES' : 'COLONES';
        $response['monto_letras'] = NumberToWords::convert((float) $credit->monto_credito, $moneda);

        return response()->json($response);
    }

    /**
     * Resumen de Saldos (Dashboard del Crédito)
     */
    public function balance($id)
    {
        $credit = Credit::with(['payments', 'lead'])->findOrFail($id);

        // Filtramos solo los pagos realizados
        $paidPayments = $credit->payments->where('estado', 'Aplicado'); // O 'Pagado' según tu estandar

        // Totales históricos
        $totalCapital = $paidPayments->sum('amortizacion');
        $totalInteres = $paidPayments->sum('interes_corriente') + $paidPayments->sum('interes_moratorio');

        $totalCargos = array_sum($credit->cargos_adicionales ?? []);
        $montoNeto = (float) $credit->monto_credito - $totalCargos;

        return response()->json([
            'credit_id' => $credit->id,
            'numero_operacion' => $credit->numero_operacion,
            'client_name' => $credit->lead ? $credit->lead->name : 'N/A',
            'monto_original' => $credit->monto_credito,
            'cargos_adicionales' => $credit->cargos_adicionales ?? [],
            'total_cargos' => $totalCargos,
            'monto_neto' => $montoNeto,
            'saldo_actual' => $credit->saldo,
            'total_capital_pagado' => $totalCapital,
            'total_intereses_pagados' => $totalInteres,
            'total_pagado' => $paidPayments->sum('monto'),
            'progreso_pagos' => $credit->plazo > 0 ? round(($paidPayments->count() / $credit->plazo) * 100, 2) : 0,
        ]);
    }

    public function update(Request $request, $id)
    {
        $credit = Credit::findOrFail($id);
        $previousStatus = $credit->status;

        $validated = $request->validate([
            'reference' => 'sometimes|required|unique:credits,reference,' . $id,
            'status' => 'sometimes|required|string',
            'monto_credito' => 'nullable|numeric',
            'tasa_anual' => 'nullable|numeric',
            'poliza' => 'nullable|boolean',
            'poliza_actual' => 'nullable|numeric',
            'cargos_adicionales' => 'nullable|array',
            'cargos_adicionales.comision' => 'nullable|numeric|min:0',
            'cargos_adicionales.transporte' => 'nullable|numeric|min:0',
            'cargos_adicionales.respaldo_deudor' => 'nullable|numeric|min:0',
            'cargos_adicionales.descuento_factura' => 'nullable|numeric|min:0',
        ]);

        // No permitir editar cargos_adicionales después de formalizar
        if (isset($validated['cargos_adicionales']) && strtolower($credit->status) === 'formalizado') {
            return response()->json([
                'message' => 'No se pueden modificar los cargos adicionales después de formalizar el crédito.',
            ], 422);
        }

        // Validar monto_neto > 0 si se actualizan cargos o monto
        if (isset($validated['cargos_adicionales']) || isset($validated['monto_credito'])) {
            $montoCredito = $validated['monto_credito'] ?? $credit->monto_credito;
            $cargos = $validated['cargos_adicionales'] ?? $credit->cargos_adicionales ?? [];
            $totalCargos = array_sum($cargos);
            $montoNeto = $montoCredito - $totalCargos;

            if ($montoNeto <= 0) {
                return response()->json([
                    'message' => 'El monto neto debe ser mayor a 0. Los cargos adicionales exceden el monto del crédito.',
                    'monto_credito' => $montoCredito,
                    'total_cargos' => $totalCargos,
                    'monto_neto' => $montoNeto,
                ], 422);
            }
        }

        $credit->update($validated);

        // Recalcular saldo SOLO si se cambiaron cargos o monto Y el crédito NO está formalizado
        if ((isset($validated['cargos_adicionales']) || isset($validated['monto_credito']))
            && strtolower($credit->status) !== 'formalizado') {
            $credit->refresh();
            $montoCredito = (float) $credit->monto_credito;
            $totalCargosActualizados = array_sum($credit->cargos_adicionales ?? []);
            $credit->saldo = $montoCredito - $totalCargosActualizados;
            $credit->save();
        }

        // Si el estado cambió a "Formalizado" y no hay plan de pagos, generarlo
        if (isset($validated['status']) &&
            strtolower($validated['status']) === 'formalizado' &&
            strtolower($previousStatus) !== 'formalizado') {

            $credit->formalized_at = now();
            $credit->save();

            $existingPlan = $credit->planDePagos()->where('numero_cuota', '>', 0)->exists();
            if (!$existingPlan) {
                $this->generateAmortizationSchedule($credit);
            }
        }

        return response()->json($credit->load('planDePagos'));
    }

    /**
     * Generar o regenerar el plan de pagos para un crédito
     */
    public function generatePlanDePagos($id)
    {
        $credit = Credit::findOrFail($id);

        // Validar que el crédito tenga los datos necesarios
        if (!$credit->monto_credito || !$credit->plazo) {
            return response()->json([
                'message' => 'El crédito debe tener monto y plazo definidos.'
            ], 422);
        }

        // Validar monto_neto > 0
        $totalCargos = array_sum($credit->cargos_adicionales ?? []);
        $montoNeto = (float) $credit->monto_credito - $totalCargos;
        if ($montoNeto <= 0) {
            return response()->json([
                'message' => 'El monto neto debe ser mayor a 0. Los cargos adicionales exceden el monto del crédito.',
                'monto_credito' => $credit->monto_credito,
                'total_cargos' => $totalCargos,
                'monto_neto' => $montoNeto,
            ], 422);
        }

        // Eliminar plan de pagos existente (excepto pagos aplicados)
        $credit->planDePagos()
            ->where('estado', '!=', 'Pagado')
            ->delete();

        // Generar nuevo plan
        $this->generateAmortizationSchedule($credit);

        return response()->json([
            'message' => 'Plan de pagos generado correctamente.',
            'plan_de_pagos' => $credit->fresh()->planDePagos()->orderBy('numero_cuota')->get()
        ]);
    }

    public function destroy($id) {
        $credit = Credit::findOrFail($id);
        $credit->delete();
        return response()->json(null, 204);
    }

    // ... (Métodos de documentos se mantienen igual)
    public function documents($id) {
        return response()->json(Credit::findOrFail($id)->documents);
    }

    public function storeDocument(Request $request, $id) {
        $credit = Credit::findOrFail($id);
        $request->validate(['file' => 'required|file', 'name' => 'required']);
        $path = $request->file('file')->store('credit-docs/' . $id, 'public');
        $doc = $credit->documents()->create([
            'name' => $request->name,
            'notes' => $request->notes,
            'path' => $path,
            'url' => asset(Storage::url($path)),
            'mime_type' => $request->file('file')->getClientMimeType(),
            'size' => $request->file('file')->getSize(),
        ]);
        return response()->json($doc, 201);
    }

    public function destroyDocument($id, $documentId) {
        $doc = CreditDocument::where('credit_id', $id)->findOrFail($documentId);
        Storage::disk('public')->delete($doc->path);
        $doc->delete();
        return response()->json(null, 204);
    }

    /**
     * Cambiar Lead a Cliente si el estado es Aprobado
     */
    public function updateStatus(Request $request, $id)
    {
        $credit = Credit::findOrFail($id);

        // Cambiar el estado del crédito
        $credit->status = $request->status;
        $credit->save();

        // Verificar si el estado es Aprobado
        if ($credit->status === 'Aprobado') {
            // Buscar el Lead asociado
            $lead = Lead::where('id', $credit->lead_id)->first();
            if ($lead) {
                // Cambiar a Cliente
                $lead->person_type_id = 2; // Asumiendo que 2 es el ID para Clientes
                $lead->save();
            }
        }

        return response()->json($credit);
    }
}
