<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Credit;
use App\Models\CreditDocument;
use App\Models\CreditPayment;
use App\Models\PlanDePago;
use App\Models\Lead;
use App\Models\Analisis;
use App\Models\ManchaDetalle;
use App\Models\LoanConfiguration;
use App\Helpers\NumberToWords;
use App\Traits\AccountingTrigger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Log;

class CreditController extends Controller
{
    use AccountingTrigger;
    /**
     * Listar créditos con filtros (optimizado con paginación)
     */
    public function index(Request $request)
    {
        // Eager load solo relaciones necesarias con campos específicos
        $query = Credit::with([
            'lead:id,cedula,name,apellido1,apellido2,email,phone,person_type_id',
            'opportunity:id,status,opportunity_type,vertical,amount',
            'planDePagos:id,credit_id,numero_cuota,cuota,saldo_anterior,interes_corriente,int_corriente_vencido,amortizacion,saldo_nuevo,fecha_pago,estado,dias_mora',
            'assignedTo:id,name'
        ]);

        if ($request->has('lead_id')) {
            $query->where('lead_id', $request->lead_id);
        }

        // Paginación: 50 por página (ajustable con ?per_page=X)
        $perPage = min($request->get('per_page', 50), 100); // Máximo 100

        // Si se solicita 'all', retornar sin paginar (para exportaciones)
        if ($request->get('all') === 'true') {
            return response()->json($query->latest()->get());
        }

        return response()->json($query->latest()->paginate($perPage));
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
            'tasa_id' => 'nullable|exists:tasas,id',
            'fecha_primera_cuota' => 'nullable|date',
            'poliza' => 'nullable|boolean',
            'poliza_actual' => 'nullable|numeric',

            // Cargos Adicionales
            'cargos_adicionales' => 'nullable|array',
            'cargos_adicionales.comision' => 'nullable|numeric|min:0',
            'cargos_adicionales.transporte' => 'nullable|numeric|min:0',
            'cargos_adicionales.respaldo_deudor' => 'nullable|numeric|min:0',
            'cargos_adicionales.descuento_factura' => 'nullable|numeric|min:0',
            'cargos_adicionales.cancelacion_manchas' => 'nullable|numeric|min:0',

            // Manchas canceladas (IDs de la tabla mancha_detalles)
            'manchas_canceladas' => 'nullable|array',
            'manchas_canceladas.*' => 'integer|exists:mancha_detalles,id',
        ]);

        // Validar que monto_credito > 0 (este es el monto ORIGINAL, sin restar deducciones)
        if ($validated['monto_credito'] <= 0) {
            return response()->json([
                'message' => 'El monto del crédito debe ser mayor a 0.',
                'monto_credito' => $validated['monto_credito'],
            ], 422);
        }

        // Determinar tasa según tipo de crédito usando loan_configurations
        $fechaCredito = $validated['opened_at'] ?? now();

        // Si no viene tipo_credito, inferirlo desde la categoría (viene de la oportunidad)
        if (empty($validated['tipo_credito'])) {
            $category = strtolower(trim($validated['category'] ?? ''));
            $validated['tipo_credito'] = str_contains($category, 'micro') ? 'microcredito' : 'regular';
        }
        $tipoCredito = $validated['tipo_credito'];

        // Buscar configuración del tipo de préstamo
        $config = LoanConfiguration::where('tipo', $tipoCredito)->where('activo', true)->first();

        if ($config) {
            // Validar si se permiten múltiples créditos por cliente
            if (!$config->permitir_multiples_creditos) {
                $creditosActivos = Credit::where('lead_id', $validated['lead_id'])
                    ->whereIn('status', ['Aprobado', 'Pendiente', 'En Revision'])
                    ->count();

                if ($creditosActivos > 0) {
                    return response()->json([
                        'message' => 'Este cliente ya tiene un crédito activo. No se permiten múltiples créditos simultáneos según la configuración actual.',
                    ], 422);
                }
            }

            // Validar monto dentro del rango permitido
            if ($validated['monto_credito'] < $config->monto_minimo || $validated['monto_credito'] > $config->monto_maximo) {
                return response()->json([
                    'message' => "El monto debe estar entre ₡" . number_format($config->monto_minimo, 0) . " y ₡" . number_format($config->monto_maximo, 0) . " para {$config->nombre}.",
                ], 422);
            }

            // Validar plazo dentro del rango permitido
            if ($validated['plazo'] < $config->plazo_minimo || $validated['plazo'] > $config->plazo_maximo) {
                return response()->json([
                    'message' => "El plazo debe estar entre {$config->plazo_minimo} y {$config->plazo_maximo} meses para {$config->nombre}.",
                ], 422);
            }

            // Asignar tasa desde la configuración del préstamo
            if ($config->tasa_id) {
                $validated['tasa_id'] = $config->tasa_id;
            }
        }

        // Si aún no tiene tasa_id, buscar fallback
        if (!isset($validated['tasa_id'])) {
            $tasaFallback = \App\Models\Tasa::vigente($fechaCredito)->first();
            if (!$tasaFallback) {
                return response()->json([
                    'message' => 'No hay tasas vigentes para la fecha del crédito (' . Carbon::parse($fechaCredito)->format('d/m/Y') . '). Configure una tasa activa para ese período.',
                    'fecha_credito' => Carbon::parse($fechaCredito)->format('d/m/Y'),
                ], 422);
            }
            $validated['tasa_id'] = $tasaFallback->id;
        }

        // Congelar valores de tasa en el crédito
        $tasaObj = \App\Models\Tasa::find($validated['tasa_id']);
        if ($tasaObj) {
            $validated['tasa_anual'] = $tasaObj->tasa;
            $validated['tasa_maxima'] = $tasaObj->tasa_maxima;
        }

        // Referencia temporal (se actualiza después con el ID real)
        $validated['reference'] = 'TEMP-' . time();

        // Establecer garantía por defecto como "Pagaré" si no se especificó
        if (empty($validated['garantia'])) {
            $validated['garantia'] = 'Pagaré';
        }

        // Si no se especificó assigned_to, asignar al responsable default de leads
        if (empty($validated['assigned_to'])) {
            $defaultAssignee = \App\Models\User::where('is_default_lead_assignee', true)->first();
            if ($defaultAssignee) {
                $validated['assigned_to'] = $defaultAssignee->id;
            }
        }

        $credit = DB::transaction(function () use ($validated) {
            // A. Crear Cabecera
            $credit = Credit::create($validated);

            // DEBUG: Log para verificar crédito creado
            Log::info('CreditController@store - Crédito creado:', [
                'id' => $credit->id,
                'opportunity_id' => $credit->opportunity_id,
                'deductora_id' => $credit->deductora_id,
            ]);

            // Establecer saldo igual al monto del crédito
            $credit->saldo = $validated['monto_credito'];

            // B. Generar referencia con el ID real del crédito
            $credit->reference = $this->generateReferenceWithId($credit->id);
            $credit->save();

            // C. Calcular cuota mensual (PMT) para que sea visible antes de formalizar
            $this->calculateAndSetCuota($credit);

            // Validar estado antes de crear plan de pagos
            if (strtolower($credit->status) === 'formalizado') {
                $credit->formalized_at = now();
                $credit->save();
                // B. Generar la Tabla de Amortización Inicial (Cuotas 1 a N)
                $this->generateAmortizationSchedule($credit);
            }

            // C. Poner en 0 las manchas canceladas en el análisis (tabla mancha_detalles)
            if (!empty($validated['manchas_canceladas'])) {
                ManchaDetalle::whereIn('id', $validated['manchas_canceladas'])
                    ->update(['monto' => 0]);
            }

            // D. Cargar lead con documentos para mover al expediente del crédito
            $lead = Lead::with('documents')->find($validated['lead_id']);

            // E. MOVER documentos del Lead (Buzón) al Crédito (Expediente)
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

        // Disparar tarea automática para "credit_created"
        $automation = \App\Models\TaskAutomation::where('event_type', 'credit_created')
            ->where('is_active', true)
            ->first();

        if ($automation && $automation->assigned_to) {
            // Asignar el responsable del crédito
            $credit->update(['assigned_to' => $automation->assigned_to]);

            // Crear la tarea automática
            \App\Models\Task::create([
                'project_code' => $credit->reference,
                'project_name' => $credit->title,
                'title' => $automation->title,
                'details' => 'Al crearse un nuevo crédito, se asigna tarea para realizar entrega de pagaré, formalización, entrega de hoja de cierre.',
                'status' => 'pendiente',
                'priority' => $automation->priority ?? 'media',
                'assigned_to' => $automation->assigned_to,
            ]);
        }

        return response()->json($credit->load(['planDePagos', 'assignedTo:id,name']), 201);
    }

    /**
     * Calcula la cuota mensual (PMT) sobre el monto neto (monto - cargos) y la guarda en el crédito.
     * Se ejecuta al crear o actualizar, antes de formalizar.
     */
    private function calculateAndSetCuota(Credit $credit): void
    {
        // Calcular monto neto restando cargos_adicionales
        $montoOriginal = (float) $credit->monto_credito;
        $cargos = $credit->cargos_adicionales ?? [];
        $monto = $montoOriginal - array_sum($cargos);
        $plazo = (int) $credit->plazo;
        $tasaAnual = (float) $credit->tasa_anual;

        if ($monto <= 0 || $plazo <= 0) {
            return;
        }

        $tasaMensual = ($tasaAnual / 100) / 12;

        if ($tasaMensual > 0) {
            $potencia = pow(1 + $tasaMensual, $plazo);
            $cuotaFija = $monto * ($tasaMensual * $potencia) / ($potencia - 1);
        } else {
            $cuotaFija = $monto / $plazo;
        }

        // Agregar póliza si aplica
        $polizaPorCuota = 0;
        if ($credit->poliza) {
            $loanConfig = LoanConfiguration::where('tipo', 'regular')->first();
            $polizaPorCuota = (float) ($loanConfig->monto_poliza ?? 0);
        }

        $credit->cuota = round($cuotaFija, 2) + $polizaPorCuota;
        $credit->save();
    }

    /**
     * MOTOR DE CÁLCULO INICIAL
     * Genera la línea de inicialización (cuota 0) y las cuotas desde la 1 hasta el Plazo final.
     */
    private function generateAmortizationSchedule(Credit $credit)
    {
        // Usar el monto_credito completo para el plan de pagos
        // Los cargos_adicionales son solo informativos
        $monto = (float) $credit->monto_credito;

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

        // NOTA: Las cuotas 1-N se generan automáticamente por el observer en PlanDePago::booted()
        // cuando se crea la cuota 0 (inicialización). No es necesario generarlas manualmente aquí.
        // El observer detecta la creación de numero_cuota = 0 y genera todas las cuotas restantes.
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
            'tasa',  // ✓ Agregar relación tasa
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

        // Calcular monto neto restando cargos del monto original
        $cargos = $credit->cargos_adicionales ?? [];
        $totalCargos = array_sum($cargos);
        $montoNeto = $credit->monto_credito - $totalCargos;

        return response()->json([
            'credit_id' => $credit->id,
            'numero_operacion' => $credit->numero_operacion,
            'client_name' => $credit->lead ? $credit->lead->name : 'N/A',
            'monto_original' => $credit->monto_credito,
            'cargos_adicionales' => $cargos,
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

        // Permitir formalización desde cualquier estado
        $isFormalizing = isset($request->status) && strtolower($request->status) === 'formalizado';

        // PROTECCIÓN: Solo permitir edición si el crédito está en estado editable
        // EXCEPCIÓN: Permitir cambio a "Formalizado" desde cualquier estado
        if (!$isFormalizing && !\in_array($credit->status, Credit::EDITABLE_STATUSES, true)) {
            return response()->json([
                'message' => 'No se puede editar un crédito en estado "' . $credit->status . '". Solo se pueden editar créditos en estado "' . implode('" o "', Credit::EDITABLE_STATUSES) . '".',
                'current_status' => $credit->status,
                'editable_statuses' => Credit::EDITABLE_STATUSES,
            ], 422);
        }

        $validated = $request->validate([
            'reference' => 'sometimes|required|unique:credits,reference,' . $id,
            'status' => 'sometimes|required|string',
            'monto_credito' => 'nullable|numeric',
            'tasa_id' => 'nullable|exists:tasas,id',
            'tasa_anual' => 'nullable|numeric',
            'tasa_maxima' => 'nullable|numeric',
            'plazo' => 'nullable|integer',
            'poliza' => 'nullable|boolean',
            'poliza_actual' => 'nullable|numeric',
            'opportunity_id' => 'nullable|string',
            'cargos_adicionales' => 'nullable|array',
            'cargos_adicionales.comision' => 'nullable|numeric|min:0',
            'cargos_adicionales.transporte' => 'nullable|numeric|min:0',
            'cargos_adicionales.respaldo_deudor' => 'nullable|numeric|min:0',
            'cargos_adicionales.descuento_factura' => 'nullable|numeric|min:0',
        ]);

        // PROTECCIÓN: No permitir modificar campos críticos si el crédito ya fue formalizado (tiene formalized_at)
        if ($credit->formalized_at) {
            $camposProtegidos = ['tasa_anual', 'tasa_maxima', 'monto_credito', 'plazo', 'cargos_adicionales'];
            $intentoCambio = [];

            foreach ($camposProtegidos as $campo) {
                if (isset($validated[$campo]) && $validated[$campo] != $credit->$campo) {
                    $intentoCambio[] = $campo;
                }
            }

            if (!empty($intentoCambio)) {
                return response()->json([
                    'message' => 'No se pueden modificar los siguientes campos en un crédito formalizado: ' . implode(', ', $intentoCambio),
                    'campos_protegidos' => $intentoCambio,
                    'formalized_at' => $credit->formalized_at->format('d/m/Y H:i:s'),
                ], 422);
            }
        }

        // Validar que monto_credito > 0 (ya viene con cargos descontados desde el frontend)
        if (isset($validated['monto_credito'])) {
            $montoCredito = $validated['monto_credito'];
            if ($montoCredito <= 0) {
                return response()->json([
                    'message' => 'El monto del crédito debe ser mayor a 0.',
                    'monto_credito' => $montoCredito,
                ], 422);
            }
        }

        // Validar que la tasa estaba vigente en la fecha de creación del crédito
        if (isset($validated['tasa_id']) && $validated['tasa_id'] != $credit->tasa_id) {
            $nuevaTasa = \App\Models\Tasa::find($validated['tasa_id']);

            if ($nuevaTasa && !$nuevaTasa->esVigente($credit->created_at)) {
                return response()->json([
                    'message' => 'No se puede asignar esta tasa al crédito. La tasa "' . $nuevaTasa->nombre . '" no estaba vigente en la fecha de creación del crédito (' . $credit->created_at->format('d/m/Y') . ').',
                    'tasa_inicio' => $nuevaTasa->inicio->format('d/m/Y'),
                    'credito_creado' => $credit->created_at->format('d/m/Y'),
                ], 422);
            }
        }

        $credit->update($validated);

        // Recalcular saldo SOLO si se cambió el monto Y el crédito NO está formalizado
        // monto_credito ya viene con cargos descontados, no restar de nuevo
        if (isset($validated['monto_credito']) && !$credit->formalized_at) {
            $credit->refresh();
            $credit->saldo = (float) $credit->monto_credito;
            $credit->save();
        }

        // Recalcular cuota mensual si cambiaron datos financieros y no está formalizado
        if (!$credit->formalized_at &&
            (isset($validated['monto_credito']) || isset($validated['plazo']) ||
             isset($validated['tasa_id']) || isset($validated['poliza']) ||
             isset($validated['cargos_adicionales']))) {
            $credit->refresh();
            $this->calculateAndSetCuota($credit);
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

            // ============================================================
            // ACCOUNTING_API_TRIGGER: Formalización de Crédito
            // ============================================================
            // Dispara asiento contable al formalizar el crédito:
            // DÉBITO: Cuentas por Cobrar (monto_credito)
            // CRÉDITO: Banco CREDIPEPE (monto_credito)
            $this->triggerAccountingFormalizacion(
                $credit->id,
                (float) $credit->monto_credito,
                $credit->reference,
                [
                    'lead_id' => $credit->lead_id,
                    'lead_cedula' => $credit->lead->cedula ?? null,
                    'lead_nombre' => $credit->lead->name ?? null,
                    'tasa_id' => $credit->tasa_id,
                    'plazo' => $credit->plazo,
                    'formalized_at' => $credit->formalized_at->toIso8601String(),
                ]
            );
        }

        // Cargar todas las relaciones necesarias (igual que en show)
        return response()->json($credit->load([
            'lead',
            'opportunity',
            'documents',
            'payments',
            'tasa',
            'assignedTo:id,name',
            'planDePagos' => function($q) {
                $q->orderBy('numero_cuota', 'asc');
            }
        ]));
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

        // Validar que monto_credito > 0 (ya viene con cargos descontados)
        if ((float) $credit->monto_credito <= 0) {
            return response()->json([
                'message' => 'El monto del crédito debe ser mayor a 0.',
                'monto_credito' => $credit->monto_credito,
            ], 422);
        }

        // Eliminar TODAS las cuotas no pagadas (incluyendo la cuota 0 de inicialización)
        // Esto asegura que el observer se active al crear la nueva cuota 0
        $credit->planDePagos()
            ->where('estado', '!=', 'Pagado')
            ->delete();

        // Resetear saldo del crédito al monto original
        $credit->saldo = $credit->monto_credito;
        $credit->save();

        // Generar nuevo plan (creará cuota 0, y el observer generará automáticamente cuotas 1-N)
        $this->generateAmortizationSchedule($credit);

        // Actualizar el campo cuota con el valor del plan generado
        $primerCuota = $credit->planDePagos()->where('numero_cuota', 1)->first();
        if ($primerCuota) {
            $credit->cuota = $primerCuota->cuota;
            $credit->save();
        }

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
    

    /**
     * Genera y descarga el PDF del Plan de Pagos (ruta pública, sin auth)
     */
    public function downloadPlanPDF($id)
    {
        $credit = Credit::with(['lead', 'tasa', 'planDePagos' => function($q) {
            $q->orderBy('numero_cuota', 'asc');
        }])->findOrFail($id);

        $planDePagos = $credit->planDePagos;

        $pdf = Pdf::loadView('pdf.plan_de_pagos', [
            'credit' => $credit,
            'planDePagos' => $planDePagos,
        ]);

        $pdf->setPaper('a4', 'landscape');

        $filename = 'plan_pagos_' . ($credit->numero_operacion ?? $credit->reference ?? $id) . '.pdf';

        return $pdf->download($filename);
    }

    public function downloadPlanExcel($id)
    {
        $credit = Credit::with(['lead', 'tasa', 'planDePagos' => function($q) {
            $q->orderBy('numero_cuota', 'asc');
        }])->findOrFail($id);

        $planDePagos = $credit->planDePagos;

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        // Título
        $sheet->setCellValue('A1', 'Plan de Pagos - ' . ($credit->numero_operacion ?? $credit->reference));
        $sheet->mergeCells('A1:R1');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);

        // Información del cliente
        $sheet->setCellValue('A2', 'Cliente: ' . ($credit->lead->name ?? 'N/A'));
        $sheet->setCellValue('F2', 'Saldo por Pagar: ₡' . number_format($credit->saldo ?? 0, 2));
        $sheet->setCellValue('K2', 'Tasa: ' . ($credit->tasa_anual ?? 0) . '%');
        $sheet->setCellValue('A3', 'Monto: ₡' . number_format($credit->monto_credito ?? 0, 2));
        $sheet->setCellValue('F3', 'Estado: ' . $credit->status);
        $sheet->setCellValue('K3', 'Plazo: ' . $credit->plazo . ' meses');

        // Encabezados
        $row = 5;
        $headers = ['#', 'Estado', 'Fecha', 'Cuota', 'Poliza', 'Int.Corr', 'Int.C.Venc', 'Int.Mora', 'Amort', 'Capital', 'Saldo por Pagar', 'Mora', 'F.Mov', 'Mov.Total', 'Mov.Pol', 'Mov.Int.C', 'Mov.Int.V', 'Mov.Int.M', 'Mov.Amort', 'Mov.Princ'];
        $col = 'A';
        foreach ($headers as $header) {
            $sheet->setCellValue($col . $row, $header);
            $sheet->getStyle($col . $row)->getFont()->setBold(true);
            $sheet->getStyle($col . $row)->getFill()->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)->getStartColor()->setRGB('4472C4');
            $sheet->getStyle($col . $row)->getFont()->getColor()->setRGB('FFFFFF');
            $col++;
        }

        // Datos
        $row++;
        foreach ($planDePagos as $pago) {
            $sheet->setCellValue('A' . $row, $pago->numero_cuota);
            $sheet->setCellValue('B' . $row, $pago->estado);
            $sheet->setCellValue('C' . $row, $pago->fecha_corte ? Carbon::parse($pago->fecha_corte)->format('d/m/Y') : '-');
            $sheet->setCellValue('D' . $row, number_format($pago->cuota ?? 0, 2));
            $sheet->setCellValue('E' . $row, number_format($pago->poliza ?? 0, 2));
            $sheet->setCellValue('F' . $row, number_format($pago->interes_corriente ?? 0, 2));
            $sheet->setCellValue('G' . $row, '0,00');
            $sheet->setCellValue('H' . $row, number_format($pago->interes_moratorio ?? 0, 2));
            $sheet->setCellValue('I' . $row, number_format($pago->amortizacion ?? 0, 2));
            $sheet->setCellValue('J' . $row, number_format($pago->saldo_anterior ?? 0, 2));
            $sheet->setCellValue('K' . $row, number_format($pago->saldo_nuevo ?? 0, 2));
            $sheet->setCellValue('L' . $row, $pago->dias_mora ?? 0);
            $sheet->setCellValue('M' . $row, $pago->fecha_movimiento ? Carbon::parse($pago->fecha_movimiento)->format('d/m/Y') : '-');
            $sheet->setCellValue('N' . $row, number_format($pago->movimiento_total ?? 0, 2));
            $sheet->setCellValue('O' . $row, number_format($pago->movimiento_poliza ?? 0, 2));
            $sheet->setCellValue('P' . $row, number_format($pago->movimiento_interes_corriente ?? 0, 2));
            $sheet->setCellValue('Q' . $row, '0,00');
            $sheet->setCellValue('R' . $row, number_format($pago->movimiento_interes_moratorio ?? 0, 2));
            $sheet->setCellValue('S' . $row, number_format($pago->movimiento_amortizacion ?? 0, 2));
            $sheet->setCellValue('T' . $row, number_format($pago->movimiento_principal ?? 0, 2));
            $row++;
        }

        // Autosize columnas
        foreach (range('A', 'T') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        // Descargar
        $filename = 'plan_pagos_' . ($credit->numero_operacion ?? $credit->reference ?? $id) . '.xlsx';

        $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);

        return response()->streamDownload(function() use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    // =====================================================================
    // REFUNDICIÓN DE CRÉDITOS
    // =====================================================================

    /**
     * Preview de refundición (cálculos sin crear nada)
     */
    public function refundicionPreview(Request $request, $id)
    {
        $credit = Credit::findOrFail($id);

        $nuevoMonto = (float) $request->get('monto_credito', 0);
        $cargos = $request->get('cargos_adicionales', []);
        $totalCargos = is_array($cargos) ? array_sum(array_map('floatval', $cargos)) : 0;
        $saldoActual = (float) $credit->saldo;
        $montoEntregado = $nuevoMonto - $saldoActual - $totalCargos;

        return response()->json([
            'saldo_actual' => $saldoActual,
            'monto_nuevo' => $nuevoMonto,
            'cargos_nuevos' => $totalCargos,
            'monto_entregado' => max(0, $montoEntregado),
            'is_valid' => $nuevoMonto >= $saldoActual && $montoEntregado >= 0,
            'credit_status' => $credit->status,
            'can_refundir' => in_array($credit->status, Credit::REFUNDIBLE_STATUSES)
                && $saldoActual > 0
                && is_null($credit->refundicion_child_id),
        ]);
    }

    /**
     * Ejecutar refundición de crédito
     */
    public function refundicion(Request $request, $id)
    {
        $validated = $request->validate([
            'title' => 'required|string',
            'monto_credito' => 'required|numeric|min:1',
            'plazo' => 'required|integer|min:1',
            'tasa_id' => 'nullable|exists:tasas,id',
            'tipo_credito' => 'nullable|string',
            'category' => 'nullable|string',
            'assigned_to' => 'nullable|string',
            'opened_at' => 'nullable|date',
            'description' => 'nullable|string',
            'deductora_id' => ['nullable', 'integer', 'in:1,2,3'],
            'poliza' => 'nullable|boolean',
            'fecha_primera_cuota' => 'nullable|date',
            'cargos_adicionales' => 'nullable|array',
            'cargos_adicionales.comision' => 'nullable|numeric|min:0',
            'cargos_adicionales.transporte' => 'nullable|numeric|min:0',
            'cargos_adicionales.respaldo_deudor' => 'nullable|numeric|min:0',
            'cargos_adicionales.descuento_factura' => 'nullable|numeric|min:0',
        ]);

        $result = DB::transaction(function () use ($id, $validated) {
            // 1. Bloquear y cargar crédito viejo
            $oldCredit = Credit::lockForUpdate()->findOrFail($id);
            $oldCredit->load('lead');

            // 2. Validaciones de negocio
            if (!in_array($oldCredit->status, Credit::REFUNDIBLE_STATUSES)) {
                abort(422, 'El crédito debe estar Formalizado o En Mora para refundición. Estado actual: ' . $oldCredit->status);
            }
            if ((float) $oldCredit->saldo <= 0) {
                abort(422, 'El crédito no tiene saldo pendiente.');
            }
            if ($oldCredit->refundicion_child_id) {
                abort(422, 'Este crédito ya fue refundido anteriormente.');
            }

            $saldoViejo = (float) $oldCredit->saldo;
            if ($validated['monto_credito'] < $saldoViejo) {
                abort(422, 'El monto nuevo (₡' . number_format($validated['monto_credito'], 2) . ') debe ser mayor o igual al saldo actual (₡' . number_format($saldoViejo, 2) . ').');
            }

            // 3. Calcular montos
            $saldoAbsorbido = $saldoViejo;
            $cargosNuevos = $validated['cargos_adicionales'] ?? [];
            $totalCargos = is_array($cargosNuevos) ? array_sum($cargosNuevos) : 0;
            $montoEntregado = $validated['monto_credito'] - $saldoAbsorbido - $totalCargos;

            // 4. Cerrar crédito viejo
            // 4a. Cancelar cuotas pendientes del plan
            PlanDePago::where('credit_id', $oldCredit->id)
                ->whereIn('estado', ['Pendiente', 'Vigente', 'Mora', 'Parcial'])
                ->update(['estado' => 'Cancelado por Refundición']);

            // 4b. Registrar payment sintético de la absorción
            CreditPayment::create([
                'credit_id' => $oldCredit->id,
                'numero_cuota' => 0,
                'fecha_pago' => now(),
                'monto' => $saldoAbsorbido,
                'saldo_anterior' => $saldoAbsorbido,
                'nuevo_saldo' => 0,
                'estado' => 'Aplicado',
                'amortizacion' => $saldoAbsorbido,
                'interes_corriente' => 0,
                'interes_moratorio' => 0,
                'source' => 'Refundición',
                'cedula' => $oldCredit->lead->cedula ?? null,
                'movimiento_total' => $saldoAbsorbido,
                'movimiento_amortizacion' => $saldoAbsorbido,
            ]);

            // 4c. Actualizar estado del crédito viejo
            $oldCredit->saldo = 0;
            $oldCredit->status = Credit::STATUS_CERRADO;
            $oldCredit->cierre_motivo = 'Refundición';
            $oldCredit->refundicion_at = now();
            $oldCredit->save();

            // ============================================================
            // ACCOUNTING_API_TRIGGER: Refundición - Cierre Crédito Viejo
            // ============================================================
            // Dispara asiento contable al cerrar el crédito antiguo:
            // DÉBITO: Banco CREDIPEPE (saldo_absorbido)
            // CRÉDITO: Cuentas por Cobrar (saldo_absorbido)
            // Este pago "sintético" reduce la cuenta por cobrar del crédito viejo
            // (Este trigger se agregará después de crear el nuevo crédito)

            // 5. Resolver tasa para el crédito nuevo
            $tipoCredito = $validated['tipo_credito'] ?? $oldCredit->tipo_credito ?? 'regular';
            $tasaId = $validated['tasa_id'] ?? null;

            if (!$tasaId) {
                $config = LoanConfiguration::where('tipo', $tipoCredito)->where('activo', true)->first();
                if ($config && $config->tasa_id) {
                    $tasaId = $config->tasa_id;
                } else {
                    $tasaFallback = \App\Models\Tasa::vigente(now())->first();
                    $tasaId = $tasaFallback ? $tasaFallback->id : $oldCredit->tasa_id;
                }
            }

            $tasaObj = \App\Models\Tasa::find($tasaId);

            // 6. Crear crédito nuevo
            $newCredit = Credit::create([
                'reference' => 'TEMP-' . time(),
                'title' => $validated['title'],
                'status' => Credit::STATUS_FORMALIZADO,
                'category' => $validated['category'] ?? $oldCredit->category,
                'lead_id' => $oldCredit->lead_id,
                'opportunity_id' => $oldCredit->opportunity_id,
                'assigned_to' => $validated['assigned_to'] ?? $oldCredit->assigned_to,
                'opened_at' => $validated['opened_at'] ?? now(),
                'description' => $validated['description'] ?? 'Refundición del crédito ' . $oldCredit->reference,
                'tipo_credito' => $tipoCredito,
                'monto_credito' => $validated['monto_credito'],
                'plazo' => $validated['plazo'],
                'tasa_id' => $tasaId,
                'tasa_anual' => $tasaObj ? $tasaObj->tasa : $oldCredit->tasa_anual,
                'tasa_maxima' => $tasaObj ? $tasaObj->tasa_maxima : $oldCredit->tasa_maxima,
                'deductora_id' => $validated['deductora_id'] ?? $oldCredit->deductora_id,
                'poliza' => $validated['poliza'] ?? $oldCredit->poliza,
                'cargos_adicionales' => $cargosNuevos,
                'formalized_at' => now(),
                'refundicion_parent_id' => $oldCredit->id,
                'refundicion_saldo_absorbido' => $saldoAbsorbido,
                'refundicion_monto_entregado' => $montoEntregado,
                'refundicion_at' => now(),
            ]);

            // 7. Referencia real y saldo
            $newCredit->reference = $this->generateReferenceWithId($newCredit->id);
            $newCredit->saldo = $validated['monto_credito'];
            $newCredit->save();

            // 8. Vincular crédito viejo → nuevo
            $oldCredit->refundicion_child_id = $newCredit->id;
            $oldCredit->save();

            // 9. Calcular cuota y generar plan de amortización
            $this->calculateAndSetCuota($newCredit);
            $this->generateAmortizationSchedule($newCredit);

            // ============================================================
            // ACCOUNTING_API_TRIGGER: Refundición - Doble Asiento
            // ============================================================
            // 1. Cierre del crédito viejo (pago sintético):
            //    DÉBITO: Banco CREDIPEPE (saldo_absorbido)
            //    CRÉDITO: Cuentas por Cobrar (saldo_absorbido)
            $this->triggerAccountingRefundicionCierre(
                $oldCredit->id,
                $saldoAbsorbido,
                $newCredit->id
            );

            // 2. Formalización del nuevo crédito:
            //    DÉBITO: Cuentas por Cobrar (monto_credito nuevo)
            //    CRÉDITO: Banco CREDIPEPE (monto_credito nuevo)
            $this->triggerAccountingRefundicionNuevo(
                $newCredit->id,
                (float) $validated['monto_credito'],
                $oldCredit->id,
                $montoEntregado
            );

            return [
                'old_credit' => $oldCredit->fresh()->load('planDePagos'),
                'new_credit' => $newCredit->fresh()->load('planDePagos'),
                'resumen' => [
                    'saldo_absorbido' => $saldoAbsorbido,
                    'monto_nuevo' => $validated['monto_credito'],
                    'cargos_nuevos' => $totalCargos,
                    'monto_entregado' => $montoEntregado,
                ],
            ];
        });

        return response()->json($result, 201);
    }
}
