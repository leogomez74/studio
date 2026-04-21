<?php

/**
 * Catálogo de eventos de código disponibles para AutomationTemplates de tipo "event".
 *
 * Se invoca con:
 *   AutomationEventDispatcher::dispatch('credit.formalized', $credit, [], auth()->id());
 */
return [

    // ── Créditos ─────────────────────────────────────────────────────────────
    'credits' => [
        'credit.created' => [
            'label'       => 'Crédito creado',
            'description' => 'Cuando se registra un nuevo crédito en el sistema.',
            'record_type' => \App\Models\Credit::class,
        ],
        'credit.formalized' => [
            'label'       => 'Crédito formalizado',
            'description' => 'Cuando un crédito pasa a estado Formalizado y se genera el plan de pagos.',
            'record_type' => \App\Models\Credit::class,
        ],
        'credit.default' => [
            'label'       => 'Crédito entra en mora',
            'description' => 'Cuando un crédito pasa de Formalizado a En Mora por falta de pago.',
            'record_type' => \App\Models\Credit::class,
        ],
        'credit.early_cancellation' => [
            'label'       => 'Cancelación anticipada ejecutada',
            'description' => 'Cuando se procesa una cancelación anticipada y el saldo queda en 0.',
            'record_type' => \App\Models\Credit::class,
        ],
        'credit.extraordinary_payment' => [
            'label'       => 'Abono extraordinario aplicado',
            'description' => 'Cuando se aplica un pago extra que reduce capital o plazo.',
            'record_type' => \App\Models\Credit::class,
        ],
        'credit.refundition' => [
            'label'       => 'Crédito refundido',
            'description' => 'Cuando un crédito es absorbido por un crédito nuevo (consolidación).',
            'record_type' => \App\Models\Credit::class,
        ],
        'credit.closed' => [
            'label'       => 'Crédito cerrado',
            'description' => 'Cuando un crédito pasa a estado Cerrado (por cancelación o pago total).',
            'record_type' => \App\Models\Credit::class,
        ],
        'credit.deductora_changed' => [
            'label'       => 'Deductora/Cooperativa cambiada',
            'description' => 'Cuando se modifica la deductora asignada a un crédito activo.',
            'record_type' => \App\Models\Credit::class,
        ],
        'credit.assigned_changed' => [
            'label'       => 'Responsable de crédito cambiado',
            'description' => 'Cuando se reasigna el responsable de un crédito.',
            'record_type' => \App\Models\Credit::class,
        ],
        'credit.document_uploaded' => [
            'label'       => 'Documento subido a crédito',
            'description' => 'Cuando se adjunta un documento al expediente del crédito.',
            'record_type' => \App\Models\Credit::class,
        ],
        'credit.tasa_changed' => [
            'label'       => 'Tasa de interés modificada',
            'description' => 'Cuando se cambia la tasa de interés de un crédito activo.',
            'record_type' => \App\Models\Credit::class,
        ],
        'credit.poliza_changed' => [
            'label'       => 'Estado de póliza cambiado',
            'description' => 'Cuando se activa o desactiva la póliza de un crédito.',
            'record_type' => \App\Models\Credit::class,
        ],
    ],

    // ── Leads / CRM ──────────────────────────────────────────────────────────
    'leads' => [
        'lead.created' => [
            'label'       => 'Lead creado',
            'description' => 'Cuando se registra un nuevo lead en el sistema.',
            'record_type' => \App\Models\Lead::class,
        ],
        'lead.status_changed' => [
            'label'       => 'Estado de lead cambiado',
            'description' => 'Cuando un agente cambia el estado del lead en el CRM.',
            'record_type' => \App\Models\Lead::class,
        ],
        'lead.assigned' => [
            'label'       => 'Lead asignado a agente',
            'description' => 'Cuando un lead es asignado a un agente de ventas.',
            'record_type' => \App\Models\Lead::class,
        ],
        'lead.questionnaire_completed' => [
            'label'       => 'Cuestionario de lead completado',
            'description' => 'Cuando el lead completa el cuestionario de perfil crediticio.',
            'record_type' => \App\Models\Lead::class,
        ],
        'lead.document_uploaded' => [
            'label'       => 'Documento subido a lead',
            'description' => 'Cuando se adjunta un documento al expediente del lead.',
            'record_type' => \App\Models\Lead::class,
        ],
        'client.created' => [
            'label'       => 'Cliente creado',
            'description' => 'Cuando se registra un nuevo cliente en el sistema (conversión de lead).',
            'record_type' => \App\Models\Client::class,
        ],
    ],

    // ── Oportunidades ────────────────────────────────────────────────────────
    'opportunities' => [
        'opportunity.created' => [
            'label'       => 'Oportunidad creada',
            'description' => 'Cuando se registra una nueva oportunidad de venta.',
            'record_type' => \App\Models\Opportunity::class,
        ],
        'opportunity.status_changed' => [
            'label'       => 'Estado de oportunidad cambiado',
            'description' => 'Cuando la oportunidad cambia de estado en el pipeline (Ganada, Perdida, etc.).',
            'record_type' => \App\Models\Opportunity::class,
        ],
        'opportunity.assigned_changed' => [
            'label'       => 'Responsable de oportunidad cambiado',
            'description' => 'Cuando se reasigna el responsable de una oportunidad.',
            'record_type' => \App\Models\Opportunity::class,
        ],
        'opportunity.amount_changed' => [
            'label'       => 'Monto de oportunidad modificado',
            'description' => 'Cuando se actualiza el monto solicitado de una oportunidad.',
            'record_type' => \App\Models\Opportunity::class,
        ],
        'opportunity.analysis_created' => [
            'label'       => 'Análisis de oportunidad creado',
            'description' => 'Cuando se crea un análisis de riesgo vinculado a la oportunidad.',
            'record_type' => \App\Models\Opportunity::class,
        ],
    ],

    // ── Análisis ─────────────────────────────────────────────────────────────
    'analisis' => [
        'analisis.created' => [
            'label'       => 'Análisis de riesgo creado',
            'description' => 'Cuando se crea un nuevo análisis crediticio.',
            'record_type' => \App\Models\Analisis::class,
        ],
        'analisis.estado_pep_changed' => [
            'label'       => 'Estado PEP cambiado',
            'description' => 'Cuando se modifica el estado PEP (Pendiente, Aprobado, Rechazado).',
            'record_type' => \App\Models\Analisis::class,
        ],
        'analisis.estado_cliente_changed' => [
            'label'       => 'Respuesta del cliente registrada',
            'description' => 'Cuando el cliente acepta o rechaza la propuesta del análisis.',
            'record_type' => \App\Models\Analisis::class,
        ],
        'analisis.document_uploaded' => [
            'label'       => 'Documento subido a análisis',
            'description' => 'Cuando se adjunta un documento (colilla, propuesta, etc.) al análisis.',
            'record_type' => \App\Models\Analisis::class,
        ],
        'analisis.risk_score_calculated' => [
            'label'       => 'Score de riesgo calculado',
            'description' => 'Cuando el sistema calcula el score de riesgo crediticio (0-100).',
            'record_type' => \App\Models\Analisis::class,
        ],
    ],

    // ── Inversiones ──────────────────────────────────────────────────────────
    'investments' => [
        'investment.created' => [
            'label'       => 'Inversión creada',
            'description' => 'Cuando se registra una nueva inversión y se generan sus cupones.',
            'record_type' => \App\Models\Investment::class,
        ],
        'investment.coupon_paid' => [
            'label'       => 'Cupón de inversión pagado',
            'description' => 'Cuando se registra el pago de un cupón (interés periódico).',
            'record_type' => \App\Models\Investment::class,
        ],
        'investment.early_liquidation' => [
            'label'       => 'Inversión liquidada anticipadamente',
            'description' => 'Cuando se cierra una inversión antes de su fecha de vencimiento.',
            'record_type' => \App\Models\Investment::class,
        ],
        'investment.renewed' => [
            'label'       => 'Inversión renovada',
            'description' => 'Cuando una inversión vencida se renueva con nuevos términos.',
            'record_type' => \App\Models\Investment::class,
        ],
        'investment.finalized' => [
            'label'       => 'Inversión finalizada',
            'description' => 'Cuando capital e intereses están completamente pagados.',
            'record_type' => \App\Models\Investment::class,
        ],
        'investment.tasa_changed' => [
            'label'       => 'Tasa de inversión modificada',
            'description' => 'Cuando se actualiza la tasa de interés de una inversión activa.',
            'record_type' => \App\Models\Investment::class,
        ],
        'investment.document_uploaded' => [
            'label'       => 'Documento subido a inversión',
            'description' => 'Cuando se adjunta un documento al expediente de la inversión.',
            'record_type' => \App\Models\Investment::class,
        ],
    ],

    // ── Cobros ───────────────────────────────────────────────────────────────
    'cobros' => [
        'saldopendiente.created' => [
            'label'       => 'Saldo pendiente registrado',
            'description' => 'Cuando queda un sobrante de planilla sin aplicar.',
            'record_type' => \App\Models\SaldoPendiente::class,
        ],
        'saldopendiente.assigned' => [
            'label'       => 'Saldo pendiente asignado a crédito',
            'description' => 'Cuando un saldo sobrante se aplica a un crédito específico.',
            'record_type' => \App\Models\SaldoPendiente::class,
        ],
        'cobro.acuerdo_pago' => [
            'label'       => 'Acuerdo de pago registrado',
            'description' => 'Cuando se negocia y registra un acuerdo de pago con el deudor.',
            'record_type' => \App\Models\SaldoPendiente::class,
        ],
        'creditpayment.reversed' => [
            'label'       => 'Abono anulado/reversado',
            'description' => 'Cuando se revierte un pago ya aplicado.',
            'record_type' => \App\Models\CreditPayment::class,
        ],
    ],

    // ── Cobro Judicial ───────────────────────────────────────────────────────
    'cobro_judicial' => [
        'expediente.proposed' => [
            'label'       => 'Expediente judicial propuesto',
            'description' => 'Cuando se propone iniciar proceso judicial contra un deudor.',
            'record_type' => \App\Models\ExpedienteJudicial::class,
        ],
        'expediente.approved' => [
            'label'       => 'Expediente judicial aprobado',
            'description' => 'Cuando el expediente es aprobado y pasa a estado activo.',
            'record_type' => \App\Models\ExpedienteJudicial::class,
        ],
        'expediente.cited_registered' => [
            'label'       => 'Expediente citado registrado',
            'description' => 'Cuando se registra un expediente donde Credipep fue citada (no es demandante).',
            'record_type' => \App\Models\ExpedienteJudicial::class,
        ],
        'expediente.discarded' => [
            'label'       => 'Expediente rechazado/descartado',
            'description' => 'Cuando un crédito es descartado del proceso judicial.',
            'record_type' => \App\Models\ExpedienteJudicial::class,
        ],
        'expediente.actuacion_registered' => [
            'label'       => 'Actuación judicial registrada',
            'description' => 'Cuando se registra un movimiento o notificación en el expediente.',
            'record_type' => \App\Models\ExpedienteJudicial::class,
        ],
        'expediente.estado_changed' => [
            'label'       => 'Estado de expediente cambiado',
            'description' => 'Cuando cambia el estado o subestado de un expediente judicial.',
            'record_type' => \App\Models\ExpedienteJudicial::class,
        ],
        'expediente.document_uploaded' => [
            'label'       => 'Documento subido al expediente',
            'description' => 'Cuando se adjunta un documento al expediente judicial.',
            'record_type' => \App\Models\ExpedienteJudicial::class,
        ],
    ],

    // ── Planillas ────────────────────────────────────────────────────────────
    'planillas' => [
        'planilla.uploaded' => [
            'label'       => 'Planilla subida',
            'description' => 'Cuando se carga un archivo de planilla de pagos de una deductora.',
            'record_type' => \App\Models\PlanillaUpload::class,
        ],
        'planilla.processed' => [
            'label'       => 'Planilla procesada',
            'description' => 'Cuando la planilla es procesada y se aplican los pagos a los créditos.',
            'record_type' => \App\Models\PlanillaUpload::class,
        ],
        'planilla.cancelled' => [
            'label'       => 'Planilla anulada',
            'description' => 'Cuando se revierte completamente una planilla procesada.',
            'record_type' => \App\Models\PlanillaUpload::class,
        ],
    ],

    // ── Rutas ────────────────────────────────────────────────────────────────
    'rutas' => [
        'ruta.created' => [
            'label'       => 'Ruta diaria creada',
            'description' => 'Cuando se crea una ruta diaria asignada a un mensajero.',
            'record_type' => \App\Models\RutaDiaria::class,
        ],
        'ruta.started' => [
            'label'       => 'Ruta iniciada',
            'description' => 'Cuando el mensajero inicia la ruta (pasa a en_progreso).',
            'record_type' => \App\Models\RutaDiaria::class,
        ],
        'ruta.completed' => [
            'label'       => 'Ruta completada',
            'description' => 'Cuando todas las tareas de la ruta están completas o fallidas.',
            'record_type' => \App\Models\RutaDiaria::class,
        ],
        'visita.completada' => [
            'label'       => 'Visita de campo completada',
            'description' => 'Cuando se marca una visita a institución como completada.',
            'record_type' => \App\Models\Visita::class,
        ],
        'visita.cancelada' => [
            'label'       => 'Visita de campo cancelada',
            'description' => 'Cuando se cancela una visita planificada.',
            'record_type' => \App\Models\Visita::class,
        ],
    ],

    // ── Tareas ───────────────────────────────────────────────────────────────
    'tasks' => [
        'task.created' => [
            'label'       => 'Tarea creada',
            'description' => 'Cuando se crea una nueva tarea en el sistema.',
            'record_type' => \App\Models\Task::class,
        ],
        'task.assigned' => [
            'label'       => 'Tarea asignada a usuario',
            'description' => 'Cuando una tarea es asignada o reasignada a un usuario.',
            'record_type' => \App\Models\Task::class,
        ],
        'task.completed' => [
            'label'       => 'Tarea completada',
            'description' => 'Cuando una tarea pasa a estado completada o estado terminal del workflow.',
            'record_type' => \App\Models\Task::class,
        ],
        'task.status_changed' => [
            'label'       => 'Estado de tarea cambiado (workflow)',
            'description' => 'Cuando una tarea transiciona entre estados del workflow.',
            'record_type' => \App\Models\Task::class,
        ],
        'task.vencida' => [
            'label'       => 'Tarea vencida sin completar',
            'description' => 'Cuando una tarea supera su due_date sin ser completada.',
            'record_type' => \App\Models\Task::class,
        ],
    ],

    // ── Incidencias ──────────────────────────────────────────────────────────
    'incidencias' => [
        'bug.reported' => [
            'label'       => 'Bug reportado',
            'description' => 'Cuando se reporta una nueva incidencia en el sistema.',
            'record_type' => \App\Models\Bug::class,
        ],
        'bug.assigned' => [
            'label'       => 'Bug asignado para resolución',
            'description' => 'Cuando un bug es asignado a un desarrollador.',
            'record_type' => \App\Models\Bug::class,
        ],
        'bug.status_changed' => [
            'label'       => 'Estado de incidencia cambiado',
            'description' => 'Cuando se actualiza el estado de una incidencia.',
            'record_type' => \App\Models\Bug::class,
        ],
        'bug.closed' => [
            'label'       => 'Bug cerrado/resuelto',
            'description' => 'Cuando una incidencia pasa a estado cerrado.',
            'record_type' => \App\Models\Bug::class,
        ],
        'bug.reopened' => [
            'label'       => 'Incidencia reabierta',
            'description' => 'Cuando una incidencia cerrada vuelve a abrirse.',
            'record_type' => \App\Models\Bug::class,
        ],
    ],

];
