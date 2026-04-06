<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Credit;
use App\Models\ExpedienteJudicial;
use App\Models\NotificacionJudicial;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CobroJudicialController extends Controller
{
    // ─── Expedientes ────────────────────────────────────────────────────────────

    /**
     * Lista expedientes por estado/sub-estado.
     * GET /api/cobro-judicial/expedientes?estado=activo&sub_estado=embargo_salario
     */
    public function index(Request $request): JsonResponse
    {
        $query = ExpedienteJudicial::with(['credit', 'propuestoPor:id,name', 'aprobadoPor:id,name'])
            ->when($request->estado, fn($q) => $q->where('estado', $request->estado))
            ->when($request->sub_estado, fn($q) => $q->where('sub_estado', $request->sub_estado))
            ->latest();

        return response()->json($query->paginate(25));
    }

    /**
     * Detalle de un expediente con trazabilidad.
     * GET /api/cobro-judicial/expedientes/{id}
     */
    public function show(ExpedienteJudicial $expediente): JsonResponse
    {
        $expediente->load([
            'credit.lead',
            'propuestoPor:id,name',
            'aprobadoPor:id,name',
            'notificaciones' => fn($q) => $q->latest(),
            'actuaciones.user:id,name',
        ]);

        return response()->json($expediente);
    }

    /**
     * Registra un expediente donde Credipep fue citada (no es el actor).
     * Llega vía correo electrónico/n8n — no requiere flujo de aprobación.
     * POST /api/cobro-judicial/registrar-citado
     */
    public function registrarCitado(Request $request): JsonResponse
    {
        $data = $request->validate([
            'credit_id'          => 'nullable|exists:credits,id',
            'cedula_deudor'      => 'required|string|max:30',
            'nombre_deudor'      => 'required|string|max:255',
            'numero_expediente'  => 'nullable|string|max:50|unique:expedientes_judiciales,numero_expediente',
            'monto_demanda'      => 'nullable|numeric|min:0',
            'juzgado'            => 'nullable|string|max:255',
            'abogado'            => 'nullable|string|max:255',
            'fecha_presentacion' => 'nullable|date',
            'notas'              => 'nullable|string|max:2000',
        ]);

        $expediente = DB::transaction(function () use ($data) {
            $exp = ExpedienteJudicial::create([
                ...$data,
                'estado'            => 'activo',
                'sub_estado'        => 'curso',
                'credipep_es_actor' => false,
                'propuesto_por'     => Auth::id(),
                'propuesto_at'      => now(),
                'aprobado_por'      => Auth::id(),
                'aprobado_at'       => now(),
                'fecha_ultima_actuacion' => now(),
            ]);

            $exp->registrarActuacion(
                'cambio_estado',
                'Expediente registrado: Credipep citada como parte (no es el actor).',
                Auth::id(),
                ['estado_nuevo' => 'activo', 'credipep_es_actor' => false]
            );

            return $exp;
        });

        return response()->json($expediente, 201);
    }

    /**
     * Descarta manualmente un crédito de la lista de posibles casos judiciales.
     * Crea el expediente en estado "cerrado" con sub_estado "descartado" para
     * excluirlo de futuros listados sin perder la trazabilidad.
     * POST /api/cobro-judicial/posibles/{credit}/descartar
     */
    public function descartarPosible(Request $request, Credit $credit): JsonResponse
    {
        $data = $request->validate([
            'motivo' => 'required|string|max:2000',
        ]);

        $existe = ExpedienteJudicial::where('credit_id', $credit->id)
            ->whereNotIn('estado', ['rechazado', 'cerrado'])
            ->exists();

        if ($existe) {
            return response()->json(['message' => 'Este crédito ya tiene un expediente judicial activo o propuesto.'], 422);
        }

        $expediente = DB::transaction(function () use ($credit, $data) {
            $exp = ExpedienteJudicial::create([
                'credit_id'     => $credit->id,
                'cedula_deudor' => $credit->lead->cedula ?? '',
                'nombre_deudor' => trim(($credit->lead->name ?? '') . ' ' . ($credit->lead->apellido1 ?? '') . ' ' . ($credit->lead->apellido2 ?? '')),
                'monto_demanda' => $credit->monto_credito ?? 0,
                'estado'        => 'cerrado',
                'sub_estado'    => null,
                'propuesto_por' => Auth::id(),
                'propuesto_at'  => now(),
                'notas'         => $data['motivo'],
            ]);

            $exp->registrarActuacion(
                'cambio_estado',
                'Caso descartado manualmente: ' . $data['motivo'],
                Auth::id(),
                ['estado_nuevo' => 'cerrado', 'motivo_descarte' => $data['motivo']]
            );

            return $exp;
        });

        return response()->json($expediente, 201);
    }

    /**
     * Actualiza el número de expediente del PJ (ej. tras incompetencia territorial).
     * PATCH /api/cobro-judicial/expedientes/{id}/numero-expediente
     */
    public function actualizarNumeroExpediente(Request $request, ExpedienteJudicial $expediente): JsonResponse
    {
        $data = $request->validate([
            'numero_expediente' => [
                'required',
                'string',
                'max:50',
                Rule::unique('expedientes_judiciales', 'numero_expediente')->ignore($expediente->id),
            ],
            'notas' => 'nullable|string|max:1000',
        ]);

        $numeroAnterior = $expediente->numero_expediente;
        $expediente->update(['numero_expediente' => $data['numero_expediente']]);

        $descripcion = "Número de expediente actualizado: '{$numeroAnterior}' → '{$data['numero_expediente']}'.";
        if ($data['notas'] ?? null) {
            $descripcion .= " Nota: {$data['notas']}";
        }

        $expediente->registrarActuacion(
            'actuacion_manual',
            $descripcion,
            Auth::id(),
            [
                'numero_anterior'  => $numeroAnterior,
                'numero_nuevo'     => $data['numero_expediente'],
                'motivo'           => 'incompetencia_territorial',
            ]
        );

        return response()->json($expediente->fresh());
    }

    /**
     * Lista los créditos con 4+ meses de atraso que aún no tienen expediente.
     * GET /api/cobro-judicial/posibles
     */
    public function posibles(): JsonResponse
    {
        $expedientesExistentes = ExpedienteJudicial::pluck('credit_id');

        $posibles = Credit::with(['lead:id,cedula,name,apellido1,apellido2', 'deductora:id,name'])
            ->whereNotIn('id', $expedientesExistentes)
            ->whereIn('status', [Credit::STATUS_EN_MORA, Credit::STATUS_LEGAL])
            ->whereHas('planDePagos', function ($q) {
                $q->where('estado', 'pendiente')
                  ->where('fecha_vencimiento', '<=', now()->subMonths(4));
            })
            ->select('id', 'numero_operacion', 'lead_id', 'deductora_id', 'status', 'monto_credito')
            ->get();

        return response()->json($posibles);
    }

    // ─── Flujo de aprobación ────────────────────────────────────────────────────

    /**
     * Carlos propone un crédito a cobro judicial.
     * POST /api/cobro-judicial/proponer
     */
    public function proponer(Request $request): JsonResponse
    {
        $data = $request->validate([
            'credit_id' => 'required|exists:credits,id',
            'notas'     => 'nullable|string|max:2000',
        ]);

        $credit = Credit::with('lead')->findOrFail($data['credit_id']);

        // Verificar que no tenga ya un expediente activo
        $existe = ExpedienteJudicial::where('credit_id', $credit->id)
            ->whereNotIn('estado', ['rechazado', 'cerrado'])
            ->exists();

        if ($existe) {
            return response()->json(['message' => 'Este crédito ya tiene un expediente judicial activo.'], 422);
        }

        $expediente = DB::transaction(function () use ($credit, $data) {
            $exp = ExpedienteJudicial::create([
                'credit_id'      => $credit->id,
                'cedula_deudor'  => $credit->lead->cedula ?? '',
                'nombre_deudor'  => trim(($credit->lead->name ?? '') . ' ' . ($credit->lead->apellido1 ?? '') . ' ' . ($credit->lead->apellido2 ?? '')),
                // Empleador actual tomado de la ficha del cliente en el CRM (persons.institucion_labora).
                // Es editable en el expediente porque puede cambiar de trabajo durante el proceso judicial.
                'patrono_deudor' => $credit->lead->institucion_labora ?? null,
                'monto_demanda'  => $credit->monto_credito ?? 0,
                'estado'         => 'propuesto',
                'propuesto_por'  => Auth::id(),
                'propuesto_at'   => now(),
                'notas'          => $data['notas'] ?? null,
            ]);

            $exp->registrarActuacion(
                'cambio_estado',
                'Caso propuesto a cobro judicial.',
                Auth::id(),
                ['estado_nuevo' => 'propuesto']
            );

            return $exp;
        });

        return response()->json($expediente, 201);
    }

    /**
     * Leo aprueba o rechaza la propuesta.
     * POST /api/cobro-judicial/expedientes/{id}/decision
     */
    public function decision(Request $request, ExpedienteJudicial $expediente): JsonResponse
    {
        $data = $request->validate([
            'decision'      => ['required', Rule::in(['aprobar', 'rechazar'])],
            'razon_rechazo' => 'required_if:decision,rechazar|nullable|string|max:2000',
        ]);

        if ($expediente->estado !== 'propuesto') {
            return response()->json(['message' => 'Este expediente no está en estado "propuesto".'], 422);
        }

        DB::transaction(function () use ($expediente, $data) {
            if ($data['decision'] === 'aprobar') {
                $expediente->update([
                    'estado'       => 'activo',
                    'sub_estado'   => 'curso',
                    'aprobado_por' => Auth::id(),
                    'aprobado_at'  => now(),
                ]);

                $expediente->registrarActuacion(
                    'aprobacion',
                    'Caso aprobado para cobro judicial.',
                    Auth::id(),
                    ['estado_nuevo' => 'activo', 'sub_estado_nuevo' => 'curso']
                );
            } else {
                $expediente->update([
                    'estado'        => 'rechazado',
                    'razon_rechazo' => $data['razon_rechazo'],
                    'aprobado_por'  => Auth::id(),
                    'aprobado_at'   => now(),
                ]);

                $expediente->registrarActuacion(
                    'rechazo',
                    'Caso rechazado: ' . $data['razon_rechazo'],
                    Auth::id(),
                    ['estado_nuevo' => 'rechazado', 'razon' => $data['razon_rechazo']]
                );
            }
        });

        return response()->json($expediente->fresh());
    }

    /**
     * Cambia el sub-estado de un expediente activo.
     * PATCH /api/cobro-judicial/expedientes/{id}/sub-estado
     */
    public function cambiarSubEstado(Request $request, ExpedienteJudicial $expediente): JsonResponse
    {
        $data = $request->validate([
            'sub_estado' => ['required', Rule::in(['curso', 'embargo_salario', 'retencion', 'notificado'])],
            'notas'      => 'nullable|string|max:1000',
        ]);

        if ($expediente->estado !== 'activo') {
            return response()->json(['message' => 'Solo se puede cambiar el sub-estado de expedientes activos.'], 422);
        }

        $anterior = $expediente->sub_estado;
        $expediente->update(['sub_estado' => $data['sub_estado']]);

        $expediente->registrarActuacion(
            'cambio_estado',
            "Sub-estado cambiado de '{$anterior}' a '{$data['sub_estado']}'." . ($data['notas'] ? " Nota: {$data['notas']}" : ''),
            Auth::id(),
            ['sub_estado_anterior' => $anterior, 'sub_estado_nuevo' => $data['sub_estado']]
        );

        return response()->json($expediente->fresh());
    }

    /**
     * Registra un cambio de patrono (empleador) del deudor.
     *
     * Cuando Carlos detecta que el deudor cambió de trabajo (vía estudio de crédito,
     * Credid u otra fuente), actualiza el patrono en el expediente para poder gestionar
     * ante el PJ la solicitud de cambio de patrono para el embargo de salario.
     *
     * PATCH /api/cobro-judicial/expedientes/{id}/patrono
     */
    public function cambiarPatrono(Request $request, ExpedienteJudicial $expediente): JsonResponse
    {
        $data = $request->validate([
            'patrono_nuevo' => 'required|string|max:255',
            'notas'         => 'nullable|string|max:1000',
        ]);

        if ($expediente->estado !== 'activo') {
            return response()->json(['message' => 'Solo se puede actualizar el patrono de expedientes activos.'], 422);
        }

        $patronoAnterior = $expediente->patrono_deudor;

        $expediente->update([
            'patrono_anterior' => $patronoAnterior,
            'patrono_deudor'   => $data['patrono_nuevo'],
        ]);

        $descripcion = "Cambio de patrono registrado: '{$patronoAnterior}' → '{$data['patrono_nuevo']}'.";
        if ($data['notas'] ?? null) {
            $descripcion .= " Nota: {$data['notas']}";
        }

        $expediente->registrarActuacion(
            'actuacion_manual',
            $descripcion,
            Auth::id(),
            [
                'patrono_anterior' => $patronoAnterior,
                'patrono_nuevo'    => $data['patrono_nuevo'],
            ]
        );

        return response()->json($expediente->fresh());
    }

    // ─── Actuación manual ──────────────────────────────────────────────────────

    /**
     * Registra una actuación manual sobre un expediente activo.
     * Actualiza fecha_ultima_actuacion para reiniciar el contador de impulso procesal (90 días).
     * POST /api/cobro-judicial/expedientes/{id}/actuacion
     */
    public function registrarActuacionManual(Request $request, ExpedienteJudicial $expediente): JsonResponse
    {
        $data = $request->validate([
            'descripcion' => 'required|string|max:2000',
            'tipo'        => ['nullable', Rule::in(['actuacion_manual', 'nota'])],
        ]);

        if ($expediente->estado !== 'activo') {
            return response()->json(['message' => 'Solo se puede registrar actuaciones en expedientes activos.'], 422);
        }

        $expediente->update(['fecha_ultima_actuacion' => now()]);

        $actuacion = $expediente->registrarActuacion(
            $data['tipo'] ?? 'actuacion_manual',
            $data['descripcion'],
            Auth::id()
        );

        return response()->json($actuacion, 201);
    }

    // ─── Notificaciones judiciales ──────────────────────────────────────────────

    /**
     * Lista notificaciones de un expediente.
     * GET /api/cobro-judicial/expedientes/{id}/notificaciones
     */
    public function notificaciones(ExpedienteJudicial $expediente): JsonResponse
    {
        return response()->json(
            $expediente->notificaciones()->latest()->get()
        );
    }

    /**
     * Notificaciones indefinidas (no clasificadas por IA).
     * GET /api/cobro-judicial/notificaciones/indefinidas
     */
    public function indefinidas(): JsonResponse
    {
        $notificaciones = NotificacionJudicial::indefinidas()
            ->latest()
            ->paginate(25);

        return response()->json($notificaciones);
    }

    /**
     * Clasifica manualmente una notificación indefinida y la vincula.
     * PATCH /api/cobro-judicial/notificaciones/{id}/clasificar
     */
    public function clasificar(Request $request, NotificacionJudicial $notificacion): JsonResponse
    {
        $data = $request->validate([
            'tipo_acto'     => 'required|string|max:100',
            'expediente_id' => 'nullable|exists:expedientes_judiciales,id',
            'fecha_acto'    => 'nullable|date',
        ]);

        $notificacion->update([
            'tipo_acto'              => $data['tipo_acto'],
            'expediente_id'          => $data['expediente_id'] ?? $notificacion->expediente_id,
            'fecha_acto'             => $data['fecha_acto'] ?? $notificacion->fecha_acto,
            'estado_procesamiento'   => $data['expediente_id'] ? 'vinculado' : 'clasificado',
            'confianza_clasificacion' => 100,
        ]);

        if ($notificacion->expediente_id) {
            $exp = ExpedienteJudicial::find($notificacion->expediente_id);
            $exp?->registrarActuacion(
                'notificacion_recibida',
                "Notificación clasificada manualmente: {$notificacion->tipo_acto}",
                Auth::id(),
                ['notificacion_id' => $notificacion->id],
                $notificacion->id
            );
        }

        return response()->json($notificacion->fresh());
    }

    // ─── Webhook n8n ────────────────────────────────────────────────────────────

    /**
     * Recibe notificaciones procesadas por n8n/IA.
     * POST /api/cobro-judicial/notificacion-entrante
     * (sin auth:sanctum — usa token estático de n8n)
     */
    public function notificacionEntrante(Request $request): JsonResponse
    {
        $data = $request->validate([
            'numero_expediente_pj'     => 'nullable|string|max:50',
            'tipo_acto'                => 'required|string|max:100',
            'fecha_acto'               => 'nullable|date',
            'descripcion'              => 'nullable|string',
            'archivo_pdf'              => 'nullable|string',
            'archivo_nombre_original'  => 'nullable|string',
            'estado_procesamiento'     => ['required', Rule::in(['clasificado', 'indefinido'])],
            'confianza_clasificacion'  => 'nullable|numeric|min:0|max:100',
            'correo_origen'            => 'nullable|string|max:255',
        ]);

        // Intentar vincular automáticamente por número de expediente
        $expediente = null;
        if ($data['numero_expediente_pj'] ?? null) {
            $expediente = ExpedienteJudicial::where('numero_expediente', $data['numero_expediente_pj'])->first();
        }

        $notificacion = NotificacionJudicial::create([
            ...$data,
            'expediente_id' => $expediente?->id,
            'recibido_at'   => now(),
            'estado_procesamiento' => $expediente ? 'vinculado' : $data['estado_procesamiento'],
        ]);

        if ($expediente) {
            $expediente->update(['fecha_ultima_actuacion' => now()]);
            $expediente->registrarActuacion(
                'notificacion_recibida',
                "Notificación recibida automáticamente: {$data['tipo_acto']}",
                null,
                ['via' => 'n8n', 'confianza' => $data['confianza_clasificacion'] ?? null],
                $notificacion->id
            );
        }

        return response()->json(['id' => $notificacion->id, 'vinculado' => (bool) $expediente], 201);
    }
}
