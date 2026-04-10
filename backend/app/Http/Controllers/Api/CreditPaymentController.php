<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Credit;
use App\Models\CreditPayment;
use App\Services\AbonoService;
use App\Services\CancelacionService;
use App\Services\MoraService;
use App\Services\PaymentProcessingService;
use App\Services\PlanillaService;
use App\Services\ReversalService;
use App\Traits\DisparaAutoTareas;
use App\Traits\LogsActivity;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Events\BusinessActionPerformed;

class CreditPaymentController extends Controller
{
    use DisparaAutoTareas;
    use LogsActivity;

    protected PlanillaService $planilla;
    protected PaymentProcessingService $paymentProcessing;
    protected AbonoService $abono;
    protected CancelacionService $cancelacion;
    protected MoraService $mora;
    protected ReversalService $reversal;

    public function __construct(
        PlanillaService $planilla,
        PaymentProcessingService $paymentProcessing,
        AbonoService $abono,
        CancelacionService $cancelacion,
        MoraService $mora,
        ReversalService $reversal
    ) {
        $this->planilla = $planilla;
        $this->paymentProcessing = $paymentProcessing;
        $this->abono = $abono;
        $this->cancelacion = $cancelacion;
        $this->mora = $mora;
        $this->reversal = $reversal;
    }

    /**
     * Listar todos los pagos
     */
    public function index()
    {
        $payments = CreditPayment::with('credit.lead')
            ->whereNull('planilla_upload_id')
            ->orderBy('id', 'desc')
            ->get();
        return response()->json($payments);
    }

    /**
     * Mostrar un pago individual con sus relaciones
     */
    public function show(string $id)
    {
        $payment = CreditPayment::with([
            'credit.lead',
            'planillaUpload.deductora',
        ])->findOrFail($id);

        return response()->json($payment);
    }

    /**
     * Preliminar de planilla - Analiza sin aplicar cambios
     */
    public function previewPlanilla(Request $request)
    {
        $validated = $request->validate([
            'deductora_id' => 'required|exists:deductoras,id',
            'fecha_proceso' => 'nullable|date',
            'file' => 'required|file|mimes:xlsx,xls,csv,txt|mimetypes:text/csv,text/plain,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ]);

        return $this->planilla->previewPlanilla($validated, $request->file('file'));
    }

    /**
     * Exportar preview de planilla en Excel
     */
    public function exportPreviewExcel($hash)
    {
        return $this->planilla->exportPreviewExcel($hash);
    }

    /**
     * Exportar preview de planilla en PDF
     */
    public function exportPreviewPdf($hash)
    {
        return $this->planilla->exportPreviewPdf($hash);
    }

    /**
     * Registrar pago normal (Ventanilla)
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
            $credit = Credit::lockForUpdate()->findOrFail($validated['credit_id']);

            return $this->paymentProcessing->processPaymentTransaction(
                $credit,
                $validated['monto'],
                $validated['fecha'],
                $validated['origen'] ?? 'Ventanilla',
                $credit->lead->cedula ?? null,
                null,
                true
            );
        });

        $credit = Credit::find($validated['credit_id']);

        $this->logActivity('create', 'Pagos', $payment, ($credit->reference ?? $validated['credit_id']) . ' - Cuota #' . ($payment->numero_cuota ?? '?'), [], $request);

        // Gamificación: puntos por registrar pago
        BusinessActionPerformed::dispatch('payment_recorded', $request->user(), $payment);

        return response()->json([
            'message' => 'Pago aplicado correctamente',
            'payment' => $payment,
            'credit_summary' => ['saldo_credito' => $credit->saldo]
        ], 201);
    }

    /**
     * Adelanto / Abono Extraordinario
     */
    public function adelanto(Request $request)
    {
        $validated = $request->validate([
            'credit_id'  => 'required|exists:credits,id',
            'tipo'       => 'nullable|string',
            'monto'      => 'required|numeric|min:0.01',
            'fecha'      => 'required|date',
            'referencia' => 'nullable|string|max:100',
            'extraordinary_strategy' => 'nullable|required_if:tipo,extraordinario|in:reduce_amount,reduce_term',
            'cuotas'     => 'nullable|array',
        ]);

        // CASO 1: PAGO NORMAL / ADELANTO SIMPLE (Sin Recálculo)
        if (($validated['tipo'] ?? '') !== 'extraordinario') {
            $result = DB::transaction(function () use ($validated) {
                $credit = Credit::lockForUpdate()->findOrFail($validated['credit_id']);

                $tipo = $validated['tipo'] ?? '';
                $source = $tipo === 'adelanto' ? 'Adelanto de Cuotas' : 'Adelanto Simple';
                $cuotasSeleccionadas = $validated['cuotas'] ?? null;

                $singleCuota = in_array($tipo, ['', null, 'normal'], true);
                return $this->paymentProcessing->processPaymentTransaction(
                    $credit,
                    $validated['monto'],
                    $validated['fecha'],
                    $source,
                    $credit->lead->cedula ?? null,
                    $cuotasSeleccionadas,
                    $singleCuota,
                    null,
                    -1,
                    $validated['referencia'] ?? null
                );
            });

            $credit = Credit::find($validated['credit_id']);
            $this->logActivity('create', 'Pagos', $result, ($credit->reference ?? $validated['credit_id']) . ' - Adelanto', [], $request);
            return response()->json([
                'message' => 'Pago aplicado correctamente.',
                'payment' => $result,
                'nuevo_saldo' => $credit->saldo
            ]);
        }

        // CASO 2: ABONO EXTRAORDINARIO (Recálculo de Tabla)
        $result = DB::transaction(function () use ($validated) {
            $credit = Credit::lockForUpdate()->findOrFail($validated['credit_id']);
            return $this->abono->procesarAbonoExtraordinario($credit, $validated);
        });

        $creditForLog = Credit::find($validated['credit_id']);
        $this->logActivity('create', 'Pagos', $result, ($creditForLog->reference ?? $validated['credit_id']) . ' - Adelanto Extraordinario', [], $request);

        return response()->json([
            'message' => 'Abono extraordinario aplicado y plan regenerado.',
            'payment' => $result,
            'nuevo_saldo' => $creditForLog->saldo
        ]);
    }

    /**
     * Método público para aplicar abono a capital con estrategia de regeneración
     * Usado por SaldoPendienteController
     */
    public function procesarAbonoCapitalConEstrategia(Credit $credit, $montoAbono, $fechaPago, $strategy, $source = 'Extraordinario', $cedula = null)
    {
        return $this->abono->procesarAbonoCapitalConEstrategia($credit, $montoAbono, $fechaPago, $strategy, $source, $cedula);
    }

    /**
     * Wrapper público para processPaymentTransaction
     * Usado por SaldoPendienteController
     */
    public function processPaymentTransactionPublic(Credit $credit, float $montoEntrante, $fecha, string $source, ?string $cedulaRef = null, $planillaUploadId = null): CreditPayment
    {
        return $this->paymentProcessing->processPaymentTransactionPublic($credit, $montoEntrante, $fecha, $source, $cedulaRef, $planillaUploadId);
    }

    /**
     * Carga masiva de planilla con cálculo de mora
     */
    public function upload(Request $request)
    {
        $validated = $request->validate([
            'file'             => 'required|file|mimes:xlsx,xls,csv,txt|mimetypes:text/csv,text/plain,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'deductora_id'     => 'required|exists:deductoras,id',
            'fecha_test'       => 'nullable|date',
            'ajustes_decimales' => 'nullable|array',
            'ajustes_decimales.*' => 'string',
        ]);

        $result = $this->planilla->upload($validated, $request->file('file'), $request);

        // Si es una respuesta de error (JsonResponse), retornarla directamente
        if ($result instanceof \Illuminate\Http\JsonResponse) {
            return $result;
        }

        $this->logActivity('upload', 'Pagos', $result['planillaUpload'], 'Planilla #' . $result['planillaUpload']->id, [], $request);

        // Gamificación: puntos por carga masiva de planilla
        BusinessActionPerformed::dispatch('planilla_uploaded', $request->user(), $result['planillaUpload']);

        $this->dispararAutoTarea('planilla_uploaded', 'PLANILLA-' . $result['planillaUpload']->id,
            "Planilla #{$result['planillaUpload']->id} cargada exitosamente.");

        return response()->json([
            'message' => 'Proceso completado',
            'planilla_id' => $result['planillaUpload']->id,
            'results' => $result['results'],
            'mora_aplicada' => $result['moraResults'],
            'saldos_pendientes' => $result['saldosPendientes'],
            'advertencias' => $result['advertencias'],
        ]);
    }

    /**
     * Calcula el monto total para cancelación anticipada
     */
    public function calcularCancelacionAnticipada(Request $request)
    {
        $validated = $request->validate([
            'credit_id' => 'required|exists:credits,id',
            'fecha' => 'nullable|date',
        ]);

        $credit = Credit::findOrFail($validated['credit_id']);
        $fechaOperacion = Carbon::parse($validated['fecha'] ?? now());

        return response()->json($this->cancelacion->calcular($credit, $fechaOperacion));
    }

    /**
     * Preview del abono extraordinario
     */
    public function previewAbonoExtraordinario(Request $request)
    {
        $validated = $request->validate([
            'credit_id' => 'required|exists:credits,id',
            'monto' => 'required|numeric|min:0.01',
            'strategy' => 'required|in:reduce_amount,reduce_term',
        ]);

        $credit = Credit::findOrFail($validated['credit_id']);
        $result = $this->abono->previewAbonoExtraordinario($credit, (float) $validated['monto'], $validated['strategy']);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], 400);
        }

        return response()->json($result);
    }

    /**
     * Procesa la cancelación anticipada de un crédito
     */
    public function cancelacionAnticipada(Request $request)
    {
        $validated = $request->validate([
            'credit_id' => 'required|exists:credits,id',
            'fecha'     => 'required|date',
        ]);

        $fechaOperacion = Carbon::parse($validated['fecha']);

        $result = DB::transaction(function () use ($validated, $fechaOperacion, $request) {
            $credit = Credit::lockForUpdate()->findOrFail($validated['credit_id']);
            return $this->cancelacion->ejecutar($credit, $fechaOperacion, $request);
        });

        $this->logActivity('create', 'Pagos', $result['payment'], (Credit::find($validated['credit_id'])->reference ?? $validated['credit_id']) . ' - Cancelación Anticipada', [], $request);

        return response()->json([
            'message' => 'Crédito cancelado anticipadamente',
            'payment' => $result['payment'],
            'monto_total' => $result['monto_total'],
            'penalizacion' => $result['penalizacion'],
            'cuota_actual' => $result['cuota_actual'],
            'aplico_penalizacion' => $result['aplico_penalizacion'],
        ]);
    }

    /**
     * Revertir un pago
     */
    public function reversePayment(Request $request, int $paymentId)
    {
        $validated = $request->validate([
            'motivo' => 'required|string|max:255',
        ]);

        $result = DB::transaction(function () use ($paymentId, $validated, $request) {
            $payment = CreditPayment::with('details')->findOrFail($paymentId);
            $credit = Credit::lockForUpdate()->findOrFail($payment->credit_id);

            $response = $this->reversal->reversePayment($payment, $credit, $validated['motivo']);

            // Log de actividad
            $this->logActivity('delete', 'Pagos', $payment, ($credit->reference ?? $payment->credit_id) . ' - Reverso #' . $payment->id, [], $request);

            return $response;
        });

        return $result;
    }

    /**
     * Solicitud de anulación para usuarios sin permiso directo.
     * Crea una Tarea y notifica a todos los usuarios con permiso "Anular Abono" (cobros.archive).
     */
    public function requestReverse(Request $request, int $id)
    {
        $request->validate(['motivo' => 'required|string|max:500']);

        $payment    = CreditPayment::with('credit')->findOrFail($id);
        $credit     = $payment->credit;
        $solicitante = $request->user();

        $details = implode("\n", [
            "**Solicitado por:** {$solicitante->name} ({$solicitante->email})",
            "**Crédito:** {$credit->reference}",
            "**Monto del abono:** ₡" . number_format($payment->monto, 2, '.', ','),
            "**Fuente:** {$payment->source}",
            "**Fecha del pago:** " . ($payment->fecha_pago ? \Carbon\Carbon::parse($payment->fecha_pago)->format('d/m/Y') : 'N/A'),
            "**Motivo:** {$request->motivo}",
            "",
            "_Para aprobar: anular el abono #{$payment->id} desde el módulo Cobros._",
        ]);

        // Intentar usar automation configurable, sino fallback a búsqueda por permisos
        $automation = \App\Models\TaskAutomation::where('event_type', 'payment_reversal_request')
            ->where('is_active', true)
            ->first();

        if ($automation) {
            $tasks = \App\Models\Task::createFromAutomation($automation, $credit->reference, $details);
            // Notificar a los assignees configurados
            $notifyIds = $automation->getAssigneeIds();
        } else {
            // Fallback: crear tarea sin asignar y notificar por permisos
            \App\Models\Task::create([
                'title'        => "Solicitud de Anulación: Abono #{$payment->id} — {$credit->reference}",
                'details'      => $details,
                'project_code' => $credit->reference,
                'project_name' => $credit->title ?? 'Crédito',
                'priority'     => 'alta',
                'status'       => 'pendiente',
                'created_by'   => $solicitante->id,
            ]);
            // Buscar por permisos
            $notifyIds = \App\Models\User::whereHas('role', function ($q) {
                $q->where('full_access', true)
                  ->orWhereHas('permissions', function ($q2) {
                      $q2->where('module_key', 'cobros')->where('can_archive', true);
                  });
            })->where('id', '!=', $solicitante->id)->pluck('id')->toArray();
        }

        foreach ($notifyIds as $userId) {
            if ($userId == $solicitante->id) continue;
            \App\Models\Notification::create([
                'user_id' => $userId,
                'type'    => 'solicitud_anulacion',
                'title'   => "Solicitud de anulación de abono",
                'body'    => "{$solicitante->name} solicita anular el abono #{$payment->id} del crédito {$credit->reference}. Motivo: {$request->motivo}",
                'data'    => json_encode([
                    'payment_id'     => $payment->id,
                    'credit_id'      => $credit->id,
                    'solicitante_id' => $solicitante->id,
                    'motivo'         => $request->motivo,
                ]),
            ]);
        }

        // Log de auditoría: quién solicitó
        $this->logActivity('create', 'Pagos', $payment,
            "Solicitud anulación abono #{$payment->id} por {$solicitante->name}", [], $request);

        return response()->json([
            'message' => 'Solicitud enviada. Los usuarios autorizados han sido notificados.',
        ]);
    }

    /**
     * Carga de intereses / mora para créditos SIN deductora
     */
    public function cargarInteresesSinDeductora(Request $request)
    {
        $validated = $request->validate([
            'credit_ids'   => 'required|array|min:1',
            'credit_ids.*' => 'integer|exists:credits,id',
        ]);

        $creditIds = $validated['credit_ids'];
        $mesPago = Carbon::now()->subMonth()->startOfMonth();

        // Validar que TODOS los créditos sean sin deductora y estén en status válido
        $creditos = Credit::whereIn('id', $creditIds)->get();

        $errores = [];
        foreach ($creditos as $credit) {
            if ($credit->deductora_id !== null) {
                $errores[] = "Crédito #{$credit->id} tiene deductora asignada. Use planilla para estos créditos.";
            }
            if (!in_array($credit->status, ['Formalizado', 'En Mora'])) {
                $errores[] = "Crédito #{$credit->id} tiene status '{$credit->status}'. Solo se procesan Formalizado o En Mora.";
            }
        }

        if (!empty($errores)) {
            return response()->json([
                'message' => 'Validación fallida',
                'errors'  => $errores,
            ], 422);
        }

        $results = [];

        DB::beginTransaction();
        try {
            foreach ($creditos as $credit) {
                $results[] = $this->mora->aplicarMoraACuota($credit, $mesPago);
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error al procesar mora: ' . $e->getMessage(),
            ], 500);
        }

        $aplicadas    = collect($results)->where('status', 'mora_aplicada')->count();
        $muyNuevos    = collect($results)->where('status', 'muy_nuevo')->count();
        $sinPendiente = collect($results)->where('status', 'sin_cuotas_pendientes')->count();

        return response()->json([
            'message'  => "Mora calculada: {$aplicadas} créditos procesados, {$muyNuevos} muy nuevos, {$sinPendiente} sin cuotas pendientes.",
            'resumen'  => [
                'procesados'          => $aplicadas,
                'muy_nuevos'          => $muyNuevos,
                'sin_cuotas_pendientes' => $sinPendiente,
                'total'               => count($results),
            ],
            'detalle'  => $results,
        ]);
    }

    public function update(Request $request, string $id) { return response()->json([], 200); }
    public function destroy(string $id) { return response()->json([], 200); }
}
