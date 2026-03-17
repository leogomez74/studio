<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Events\TaskCompleted;
use App\Events\TaskStatusChanged;
use App\Models\Comment;
use App\Models\Credit;
use App\Models\Notification;
use App\Models\PaymentVerification;
use App\Models\Task;
use App\Models\TaskAutomation;
use App\Models\TaskWorkflowTransition;
use App\Services\AbonoService;
use App\Services\CancelacionService;
use App\Services\PaymentProcessingService;
use App\Traits\LogsActivity;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaymentVerificationController extends Controller
{
    use LogsActivity;

    private const PAYMENT_TYPE_LABELS = [
        'normal' => 'Pago Normal (Ventanilla)',
        'adelanto' => 'Adelanto de Cuotas',
        'extraordinario' => 'Abono Extraordinario',
        'cancelacion_anticipada' => 'Cancelación Anticipada',
    ];

    /**
     * Listar verificaciones del usuario (solicitadas o asignadas).
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $verifications = PaymentVerification::with(['credit:id,reference,saldo', 'requester:id,name', 'verifier:id,name'])
            ->where(function ($q) use ($user) {
                $q->where('requested_by', $user->id)
                  ->orWhere('assigned_to', $user->id);
            })
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($verifications);
    }

    /**
     * Crear solicitud de verificación bancaria.
     * POST /api/payment-verifications
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'credit_id'            => 'required|exists:credits,id',
            'payment_type'         => 'required|in:normal,adelanto,extraordinario,cancelacion_anticipada',
            'payment_data'         => 'required|array',
            'payment_data.monto'   => 'required|numeric|min:0.01',
            'payment_data.fecha'   => 'required|date',
            'payment_data.referencia' => 'nullable|string|max:100',
            'payment_data.strategy'   => 'nullable|in:reduce_amount,reduce_term',
            'payment_data.cuotas'     => 'nullable|array',
        ]);

        // Fix #8: strategy required for extraordinario
        if ($validated['payment_type'] === 'extraordinario' && empty($validated['payment_data']['strategy'])) {
            return response()->json(['message' => 'Se requiere strategy (reduce_amount o reduce_term) para abonos extraordinarios.'], 422);
        }

        $automation = TaskAutomation::where('event_type', 'payment_verification')
            ->where('is_active', true)
            ->first();

        $assigneeIds = $automation ? $automation->getAssigneeIds() : [];
        if (!$automation || empty($assigneeIds)) {
            return response()->json([
                'message' => 'No hay verificador configurado. Configure una tarea automática de tipo "payment_verification" en Configuración.',
            ], 422);
        }

        $verifierId  = $assigneeIds[0];
        $requesterId = $request->user()->id;

        if ($verifierId === $requesterId) {
            return response()->json([
                'message' => 'El verificador no puede ser el mismo usuario que solicita el abono.',
            ], 422);
        }

        $credit    = Credit::with('lead:id,name,apellido1,cedula')->findOrFail($validated['credit_id']);
        $typeLabel = self::PAYMENT_TYPE_LABELS[$validated['payment_type']] ?? $validated['payment_type'];
        $monto     = number_format($validated['payment_data']['monto'], 2, ',', '.');

        return DB::transaction(function () use ($validated, $credit, $automation, $verifierId, $requesterId, $typeLabel, $monto, $request) {
            // 1. Crear verificación
            $verification = PaymentVerification::create([
                'credit_id'    => $validated['credit_id'],
                'requested_by' => $requesterId,
                'assigned_to'  => $verifierId,
                'payment_type' => $validated['payment_type'],
                'payment_data' => $validated['payment_data'],
                'status'       => 'pending',
            ]);

            // 2. Crear tarea para el verificador
            $task = Task::create([
                'project_code' => 'VERIF-' . $verification->id,
                'project_name' => $credit->reference ?? 'Crédito #' . $credit->id,
                'title'        => "Verificar {$typeLabel}: ₡{$monto} — {$credit->reference}",
                'details'      => "Verificar en el banco si se aplicó el abono.\nCliente: " . ($credit->lead->name ?? 'N/A') . ' ' . ($credit->lead->apellido1 ?? '') . "\nCédula: " . ($credit->lead->cedula ?? 'N/A'),
                'status'       => 'pendiente',
                'priority'     => $automation->priority ?? 'alta',
                'assigned_to'  => $verifierId,
                'workflow_id'  => $automation->workflow_id,
                'start_date'   => now()->toDateString(),
                'due_date'     => now()->addDays($automation->due_days_offset ?? 1)->toDateString(),
            ]);

            $task->copyChecklistFromAutomation($automation);
            $verification->update(['task_id' => $task->id]);

            // 3. Comentario directo con card embebido para el verificador
            $comment = Comment::create([
                'commentable_type' => \App\Models\User::class,
                'commentable_id'   => $verifierId,
                'user_id'          => $requesterId,
                'body'             => "Solicitud de verificación bancaria: {$typeLabel} por ₡{$monto} para crédito {$credit->reference}",
                'comment_type'     => 'verification_request',
                'metadata'         => [
                    'verification_id'    => $verification->id,
                    'credit_id'          => $credit->id,
                    'credit_reference'   => $credit->reference,
                    'payment_type'       => $validated['payment_type'],
                    'payment_type_label' => $typeLabel,
                    'monto'              => $validated['payment_data']['monto'],
                    'fecha'              => $validated['payment_data']['fecha'],
                    'client_name'        => trim(($credit->lead->name ?? '') . ' ' . ($credit->lead->apellido1 ?? '')),
                    'status'             => 'pending',
                ],
            ]);

            // 4. Notificación para el verificador
            Notification::create([
                'user_id' => $verifierId,
                'type'    => 'verification_request',
                'title'   => 'Verificación de abono pendiente',
                'body'    => $request->user()->name . " solicita verificar {$typeLabel} por ₡{$monto} — {$credit->reference}",
                'data'    => [
                    'verification_id'    => $verification->id,
                    'comment_id'         => $comment->id,
                    'credit_reference'   => $credit->reference,
                    'sender_name'        => $request->user()->name,
                    'payment_type_label' => $typeLabel,
                    'monto'              => $validated['payment_data']['monto'],
                ],
            ]);

            $this->logActivity('create', 'Verificaciones', $verification, "Solicitud: {$typeLabel} ₡{$monto} — {$credit->reference}", [], $request);

            return response()->json([
                'verification' => $verification->load(['credit:id,reference,saldo', 'requester:id,name', 'verifier:id,name']),
                'task'         => $task,
                'message'      => 'Solicitud de verificación enviada.',
            ], 201);
        });
    }

    /**
     * Verificador aprueba o rechaza.
     * PATCH /api/payment-verifications/{id}/respond
     */
    public function respond(Request $request, int $id)
    {
        $validated = $request->validate([
            'status' => 'required|in:approved,rejected',
            'notes'  => 'nullable|string|max:1000',
        ]);

        // Fix #3: cargar verificación dentro de la transacción con lockForUpdate
        return DB::transaction(function () use ($validated, $id, $request) {
            $verification = PaymentVerification::with(['credit:id,reference', 'requester:id,name'])
                ->lockForUpdate()
                ->findOrFail($id);

            if ($verification->assigned_to !== $request->user()->id) {
                abort(403, 'Solo el verificador asignado puede responder.');
            }

            if ($verification->status !== 'pending') {
                abort(422, 'Esta verificación ya fue respondida.');
            }

            $isApproved = $validated['status'] === 'approved';
            $typeLabel  = self::PAYMENT_TYPE_LABELS[$verification->payment_type] ?? $verification->payment_type;
            $monto      = number_format($verification->payment_data['monto'] ?? 0, 2, ',', '.');

            // 1. Actualizar verificación
            $verification->update([
                'status'             => $validated['status'],
                'verified_at'        => now(),
                'verification_notes' => $validated['notes'] ?? null,
            ]);

            // 2. Fix #4: completar tarea a través del motor de Workflows
            $this->completeTaskViaWorkflow($verification->task_id, $request->user());

            // 3. Comentario directo al solicitante con resultado
            $statusText = $isApproved ? 'Verificado y Aprobado' : 'Verificado y Rechazado';
            $comment = Comment::create([
                'commentable_type' => \App\Models\User::class,
                'commentable_id'   => $verification->requested_by,
                'user_id'          => $request->user()->id,
                'body'             => "{$statusText}: {$typeLabel} por ₡{$monto} — {$verification->credit->reference}",
                'comment_type'     => 'verification_response',
                'metadata'         => [
                    'verification_id'    => $verification->id,
                    'credit_id'          => $verification->credit_id,
                    'credit_reference'   => $verification->credit->reference,
                    'payment_type'       => $verification->payment_type,
                    'payment_type_label' => $typeLabel,
                    'monto'              => $verification->payment_data['monto'] ?? 0,
                    'status'             => $validated['status'],
                    'notes'              => $validated['notes'] ?? null,
                ],
            ]);

            // 4. Notificación al solicitante
            Notification::create([
                'user_id' => $verification->requested_by,
                'type'    => 'verification_response',
                'title'   => $isApproved ? 'Abono verificado — listo para aplicar' : 'Abono no verificado',
                'body'    => $request->user()->name . ": {$statusText} — {$verification->credit->reference}",
                'data'    => [
                    'verification_id'  => $verification->id,
                    'comment_id'       => $comment->id,
                    'credit_reference' => $verification->credit->reference,
                    'status'           => $validated['status'],
                    'verifier_name'    => $request->user()->name,
                    'notes'            => $validated['notes'] ?? null,
                ],
            ]);

            $this->logActivity('update', 'Verificaciones', $verification, "{$statusText}: ₡{$monto} — {$verification->credit->reference}", [], $request);

            return response()->json([
                'verification' => $verification->fresh(['credit:id,reference,saldo', 'requester:id,name', 'verifier:id,name']),
                'message'      => $isApproved ? 'Verificación aprobada.' : 'Verificación rechazada.',
            ]);
        });
    }

    /**
     * Solicitante aplica el abono aprobado.
     * POST /api/payment-verifications/{id}/apply
     */
    public function apply(Request $request, int $id)
    {
        // Fix #1 & #2: cargar verificación dentro de la transacción con lockForUpdate
        $result = DB::transaction(function () use ($id, $request) {
            $verification = PaymentVerification::lockForUpdate()->findOrFail($id);

            if ($verification->requested_by !== $request->user()->id) {
                abort(403, 'Solo el solicitante puede aplicar el abono.');
            }

            if ($verification->status !== 'approved') {
                abort(422, 'Solo se pueden aplicar abonos verificados.');
            }

            $data   = $verification->payment_data;
            $credit = Credit::lockForUpdate()->findOrFail($verification->credit_id);

            $paymentProcessing  = app(PaymentProcessingService::class);
            $abonoService       = app(AbonoService::class);
            $cancelacionService = app(CancelacionService::class);

            $payment = null;

            switch ($verification->payment_type) {
                case 'normal':
                    $payment = $paymentProcessing->processPaymentTransaction(
                        $credit,
                        $data['monto'],
                        $data['fecha'],
                        'Ventanilla',
                        $credit->lead->cedula ?? null,
                        null,
                        true
                    );
                    break;

                case 'adelanto':
                    $payment = $paymentProcessing->processPaymentTransaction(
                        $credit,
                        $data['monto'],
                        $data['fecha'],
                        'Adelanto de Cuotas',
                        $credit->lead->cedula ?? null,
                        $data['cuotas'] ?? null,
                        false,
                        null,
                        -1,
                        $data['referencia'] ?? null
                    );
                    break;

                case 'extraordinario':
                    $payment = $abonoService->procesarAbonoExtraordinario($credit, [
                        'credit_id'              => $credit->id,
                        'monto'                  => $data['monto'],
                        'fecha'                  => $data['fecha'],
                        'referencia'             => $data['referencia'] ?? null,
                        'extraordinary_strategy' => $data['strategy'] ?? 'reduce_amount',
                    ]);
                    break;

                case 'cancelacion_anticipada':
                    $res     = $cancelacionService->ejecutar($credit, Carbon::parse($data['fecha']), $request);
                    $payment = $res['payment'];
                    break;
            }

            $verification->update(['status' => 'applied']);

            // Fix #5: notificar al verificador que el abono fue aplicado
            $typeLabel = self::PAYMENT_TYPE_LABELS[$verification->payment_type] ?? $verification->payment_type;
            $monto     = number_format($data['monto'] ?? 0, 2, ',', '.');

            Notification::create([
                'user_id' => $verification->assigned_to,
                'type'    => 'verification_applied',
                'title'   => 'Abono aplicado',
                'body'    => $request->user()->name . " aplicó el abono verificado: {$typeLabel} ₡{$monto} — {$credit->reference}",
                'data'    => [
                    'verification_id'  => $verification->id,
                    'credit_reference' => $credit->reference,
                    'applier_name'     => $request->user()->name,
                ],
            ]);

            $this->logActivity('create', 'Pagos', $payment, ($credit->reference ?? $credit->id) . ' — Abono verificado aplicado', [], $request);

            return [
                'payment'      => $payment,
                'credit_saldo' => $credit->fresh()->saldo,
            ];
        });

        return response()->json([
            'message'      => 'Abono aplicado correctamente.',
            'payment'      => $result['payment'],
            'credit_saldo' => $result['credit_saldo'],
        ]);
    }

    /**
     * Cancelar solicitud de verificación.
     * POST /api/payment-verifications/{id}/cancel
     */
    public function cancel(Request $request, int $id)
    {
        $verification = PaymentVerification::findOrFail($id);

        if ($verification->requested_by !== $request->user()->id) {
            return response()->json(['message' => 'Solo el solicitante puede cancelar.'], 403);
        }

        if (!\in_array($verification->status, ['pending', 'rejected'], true)) {
            return response()->json(['message' => 'No se puede cancelar una verificación ya aplicada.'], 422);
        }

        $verification->update(['status' => 'cancelled']);

        if ($verification->task_id) {
            Task::where('id', $verification->task_id)->update(['status' => 'archivada']);
        }

        // Fix #6: notificar al verificador que la solicitud fue cancelada
        $credit    = $verification->credit()->first(['id', 'reference']);
        $typeLabel = self::PAYMENT_TYPE_LABELS[$verification->payment_type] ?? $verification->payment_type;

        Notification::create([
            'user_id' => $verification->assigned_to,
            'type'    => 'verification_cancelled',
            'title'   => 'Solicitud de verificación cancelada',
            'body'    => $request->user()->name . " canceló la solicitud: {$typeLabel} — " . ($credit->reference ?? ''),
            'data'    => [
                'verification_id'  => $verification->id,
                'credit_reference' => $credit->reference ?? null,
                'requester_name'   => $request->user()->name,
            ],
        ]);

        $this->logActivity('update', 'Verificaciones', $verification, 'Cancelada', [], $request);

        return response()->json(['message' => 'Solicitud cancelada.']);
    }

    /**
     * Completa la tarea asociada a través del motor de Workflows.
     * Si la tarea no tiene workflow asignado, cae al status legacy.
     */
    private function completeTaskViaWorkflow(?int $taskId, $user): void
    {
        if (!$taskId) {
            return;
        }

        $task = Task::with(['workflowStatus', 'workflow'])->find($taskId);
        if (!$task) {
            return;
        }

        // Si la tarea tiene workflow, buscar el estado terminal y transicionar formalmente
        if ($task->workflow_id && $task->workflow_status_id) {
            $transition = TaskWorkflowTransition::where('workflow_id', $task->workflow_id)
                ->where('from_status_id', $task->workflow_status_id)
                ->whereHas('toStatus', fn($q) => $q->where('is_terminal', true))
                ->first();

            if ($transition) {
                $fromStatus = $task->workflowStatus;
                $task->workflow_status_id = $transition->to_status_id;
                $task->save(); // syncLegacyStatus() via booted()
                $task->load('workflowStatus');

                event(new TaskStatusChanged($task, $fromStatus, $task->workflowStatus, $user, $transition));
                event(new TaskCompleted($task, $user));
                return;
            }
        }

        // Fallback: status legacy sin workflow
        $task->update(['status' => 'completada']);
    }
}
