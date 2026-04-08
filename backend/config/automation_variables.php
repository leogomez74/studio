<?php

/**
 * Mapa de módulos → campos evaluables para el motor de condiciones
 * de AutomationTemplates.
 */
return [

    // ── Leads / CRM ──────────────────────────────────────────────────────────
    'leads' => [
        'label'              => 'Leads / CRM',
        'model'              => \App\Models\Lead::class,
        'table'              => 'persons',
        'record_label_field' => 'name',
        'fields' => [
            'is_active' => [
                'label'     => 'Activo',
                'type'      => 'boolean',
                'operators' => ['eq'],
            ],
            'lead_status_id' => [
                'label'     => 'Estado en CRM (ID)',
                'type'      => 'number',
                'operators' => ['eq', 'neq'],
            ],
            'monto' => [
                'label'     => 'Monto solicitado (cuestionario)',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'ingreso' => [
                'label'     => 'Ingreso estimado',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'patrimonio_vehiculos' => [
                'label'     => 'Patrimonio en vehículos',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'patrimonio_propiedades' => [
                'label'     => 'Patrimonio en propiedades',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'total_hijos' => [
                'label'     => 'Número de hijos',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'total_vehiculos' => [
                'label'     => 'Vehículos registrados',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'total_propiedades' => [
                'label'     => 'Propiedades registradas',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'total_hipotecas' => [
                'label'     => 'Hipotecas activas',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'es_pep' => [
                'label'     => 'Es Persona Expuesta Políticamente (PEP)',
                'type'      => 'boolean',
                'operators' => ['eq'],
            ],
            'en_listas_internacionales' => [
                'label'     => 'En listas internacionales',
                'type'      => 'boolean',
                'operators' => ['eq'],
            ],
            'experiencia_crediticia' => [
                'label'     => 'Experiencia crediticia',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['Excelente', 'Buena', 'Regular', 'Mala'],
            ],
            'historial_mora' => [
                'label'     => 'Historial de mora',
                'type'      => 'enum',
                'operators' => ['eq', 'neq'],
                'options'   => ['Sí', 'No'],
            ],
            'tiene_deudas' => [
                'label'     => 'Tiene deudas previas',
                'type'      => 'enum',
                'operators' => ['eq', 'neq'],
                'options'   => ['Sí', 'No'],
            ],
            'estado_civil' => [
                'label'     => 'Estado civil',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión libre'],
            ],
            'genero' => [
                'label'     => 'Género',
                'type'      => 'enum',
                'operators' => ['eq', 'neq'],
                'options'   => ['Masculino', 'Femenino'],
            ],
            'fecha_nacimiento' => [
                'label'     => 'Fecha de nacimiento',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'is_null', 'is_not_null'],
            ],
            'questionnaire_completed_at' => [
                'label'     => 'Cuestionario completado',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'is_null', 'is_not_null'],
            ],
            'created_at' => [
                'label'     => 'Fecha de registro',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
            'updated_at' => [
                'label'     => 'Última actualización',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
        ],
    ],

    // ── Oportunidades ────────────────────────────────────────────────────────
    'opportunities' => [
        'label'              => 'Oportunidades',
        'model'              => \App\Models\Opportunity::class,
        'table'              => 'opportunities',
        'record_label_field' => 'id',
        'fields' => [
            'status' => [
                'label'     => 'Estado',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['Abierta', 'En Negociación', 'Ganada', 'Perdida'],
            ],
            'amount' => [
                'label'     => 'Monto solicitado',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'opportunity_type' => [
                'label'     => 'Tipo de oportunidad',
                'type'      => 'string',
                'operators' => ['eq', 'neq', 'is_null', 'is_not_null'],
            ],
            'vertical' => [
                'label'     => 'Línea de negocio',
                'type'      => 'string',
                'operators' => ['eq', 'neq', 'is_null', 'is_not_null'],
            ],
            'expected_close_date' => [
                'label'     => 'Fecha estimada de cierre',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_from_now_gt', 'days_from_now_lt', 'is_null', 'is_not_null'],
            ],
            'created_at' => [
                'label'     => 'Fecha de creación',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
            'updated_at' => [
                'label'     => 'Última actualización',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
        ],
    ],

    // ── Análisis ─────────────────────────────────────────────────────────────
    'analisis' => [
        'label'              => 'Análisis',
        'model'              => \App\Models\Analisis::class,
        'table'              => 'analisis',
        'record_label_field' => 'reference',
        'fields' => [
            'estado_pep' => [
                'label'     => 'Estado PEP',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['Pendiente', 'Aprobado', 'Rechazado', 'En revisión'],
            ],
            'estado_cliente' => [
                'label'     => 'Respuesta del cliente',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['Pendiente', 'Aceptado', 'Rechazado'],
            ],
            'monto_solicitado' => [
                'label'     => 'Monto solicitado',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'monto_sugerido' => [
                'label'     => 'Monto sugerido',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'cuota' => [
                'label'     => 'Cuota estimada',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'plazo' => [
                'label'     => 'Plazo propuesto (meses)',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'ingreso_neto' => [
                'label'     => 'Ingreso neto declarado',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'numero_manchas' => [
                'label'     => 'Manchas crediticias',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'numero_juicios' => [
                'label'     => 'Procesos judiciales',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'numero_embargos' => [
                'label'     => 'Embargos ejecutivos',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'divisa' => [
                'label'     => 'Divisa',
                'type'      => 'enum',
                'operators' => ['eq', 'neq'],
                'options'   => ['CRC', 'USD'],
            ],
            'created_at' => [
                'label'     => 'Fecha de creación',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
            'updated_at' => [
                'label'     => 'Última actualización',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
        ],
    ],

    // ── Créditos ─────────────────────────────────────────────────────────────
    'credits' => [
        'label'              => 'Créditos',
        'model'              => \App\Models\Credit::class,
        'table'              => 'credits',
        'record_label_field' => 'reference',
        'fields' => [
            'status' => [
                'label'     => 'Estado del crédito',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['Aprobado', 'Por firmar', 'Activo', 'En Mora', 'Cerrado', 'Legal', 'Formalizado'],
            ],
            'monto_credito' => [
                'label'     => 'Monto del crédito',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'saldo' => [
                'label'     => 'Saldo pendiente',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'cuota' => [
                'label'     => 'Monto de cuota',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'plazo' => [
                'label'     => 'Plazo (meses)',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'cuotas_atrasadas' => [
                'label'     => 'Cuotas atrasadas',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'tasa_anual' => [
                'label'     => 'Tasa anual',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'tasa_maxima' => [
                'label'     => 'Tasa máxima (moratoria)',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'progress' => [
                'label'     => 'Progreso del crédito (%)',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'poliza' => [
                'label'     => 'Tiene póliza activa',
                'type'      => 'boolean',
                'operators' => ['eq'],
            ],
            'poliza_actual' => [
                'label'     => 'Monto de póliza actual',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'fecha_culminacion_credito' => [
                'label'     => 'Fecha de vencimiento del crédito',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'days_from_now_gt', 'days_from_now_lt', 'is_null', 'is_not_null'],
            ],
            'formalized_at' => [
                'label'     => 'Fecha de formalización',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'is_null', 'is_not_null'],
            ],
            'fecha_ultimo_pago' => [
                'label'     => 'Fecha del último pago',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'is_null', 'is_not_null'],
            ],
            'opened_at' => [
                'label'     => 'Fecha de apertura',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
            'refundicion_parent_id' => [
                'label'     => 'Es crédito refundido (tiene padre)',
                'type'      => 'number',
                'operators' => ['is_null', 'is_not_null'],
            ],
            'deductora_id' => [
                'label'     => 'Deductora (ID)',
                'type'      => 'number',
                'operators' => ['eq', 'neq', 'is_null', 'is_not_null'],
            ],
            'created_at' => [
                'label'     => 'Fecha de creación',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
        ],
    ],

    // ── Cobros (Saldo Pendiente) ──────────────────────────────────────────────
    'cobros' => [
        'label'              => 'Cobros',
        'model'              => \App\Models\SaldoPendiente::class,
        'table'              => 'saldo_pendientes',
        'record_label_field' => 'id',
        'fields' => [
            'monto' => [
                'label'     => 'Monto pendiente',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'estado' => [
                'label'     => 'Estado',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['pendiente', 'asignado'],
            ],
            'origen' => [
                'label'     => 'Origen del saldo',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['Planilla', 'Abono', 'Extraordinario', 'Reintegro'],
            ],
            'fecha_origen' => [
                'label'     => 'Fecha de origen',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
            'asignado_at' => [
                'label'     => 'Fecha de asignación',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'is_null', 'is_not_null'],
            ],
            'created_at' => [
                'label'     => 'Fecha de creación',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
        ],
    ],

    // ── Cobro Judicial ───────────────────────────────────────────────────────
    'cobro_judicial' => [
        'label'              => 'Cobro Judicial',
        'model'              => \App\Models\ExpedienteJudicial::class,
        'table'              => 'expedientes_judiciales',
        'record_label_field' => 'numero_expediente',
        'fields' => [
            'estado' => [
                'label'     => 'Estado del expediente',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['posible', 'propuesto', 'activo', 'rechazado', 'cerrado'],
            ],
            'sub_estado' => [
                'label'     => 'Subestado',
                'type'      => 'string',
                'operators' => ['eq', 'neq', 'is_null', 'is_not_null'],
            ],
            'monto_demanda' => [
                'label'     => 'Monto demandado',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'credipep_es_actor' => [
                'label'     => 'Credipep es demandante',
                'type'      => 'boolean',
                'operators' => ['eq'],
            ],
            'alerta_impulso' => [
                'label'     => 'Alerta de impulso procesal (90 días)',
                'type'      => 'boolean',
                'operators' => ['eq'],
            ],
            'alerta_prescripcion' => [
                'label'     => 'Alerta de prescripción (4 años)',
                'type'      => 'boolean',
                'operators' => ['eq'],
            ],
            'aprobado_at' => [
                'label'     => 'Fecha de aprobación',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'is_null', 'is_not_null'],
            ],
            'fecha_ultima_actuacion' => [
                'label'     => 'Última actuación procesal',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'is_null', 'is_not_null'],
            ],
            'created_at' => [
                'label'     => 'Fecha de creación',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
        ],
    ],

    // ── Inversiones ──────────────────────────────────────────────────────────
    'investments' => [
        'label'              => 'Inversiones',
        'model'              => \App\Models\Investment::class,
        'table'              => 'investments',
        'record_label_field' => 'numero_desembolso',
        'fields' => [
            'estado' => [
                'label'     => 'Estado',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['Activa', 'Capital Devuelto', 'Finalizada', 'Liquidada', 'Renovada', 'Cancelada'],
            ],
            'monto_capital' => [
                'label'     => 'Monto de capital',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'tasa_anual' => [
                'label'     => 'Tasa anual',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'tasa_retencion' => [
                'label'     => 'Tasa de retención',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'plazo_meses' => [
                'label'     => 'Plazo (meses)',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'forma_pago' => [
                'label'     => 'Forma de pago de cupones',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'RESERVA'],
            ],
            'moneda' => [
                'label'     => 'Moneda',
                'type'      => 'enum',
                'operators' => ['eq', 'neq'],
                'options'   => ['CRC', 'USD'],
            ],
            'es_capitalizable' => [
                'label'     => 'Es capitalizable',
                'type'      => 'boolean',
                'operators' => ['eq'],
            ],
            'fecha_inicio' => [
                'label'     => 'Fecha de inicio',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
            'fecha_vencimiento' => [
                'label'     => 'Fecha de vencimiento',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'days_from_now_gt', 'days_from_now_lt', 'is_null', 'is_not_null'],
            ],
            'fecha_cancelacion' => [
                'label'     => 'Fecha de cancelación',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'is_null', 'is_not_null'],
            ],
            'created_at' => [
                'label'     => 'Fecha de registro',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
        ],
    ],

    // ── Planillas ────────────────────────────────────────────────────────────
    'planillas' => [
        'label'              => 'Planillas',
        'model'              => \App\Models\PlanillaUpload::class,
        'table'              => 'planilla_uploads',
        'record_label_field' => 'nombre_archivo',
        'fields' => [
            'estado' => [
                'label'     => 'Estado',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['cargada', 'procesada', 'anulada'],
            ],
            'monto_total' => [
                'label'     => 'Monto total',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'cantidad_pagos' => [
                'label'     => 'Cantidad de pagos',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'deductora_id' => [
                'label'     => 'Deductora (ID)',
                'type'      => 'number',
                'operators' => ['eq', 'neq'],
            ],
            'fecha_planilla' => [
                'label'     => 'Fecha de planilla',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
            'uploaded_at' => [
                'label'     => 'Fecha de carga',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
            'anulada_at' => [
                'label'     => 'Fecha de anulación',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'is_null', 'is_not_null'],
            ],
        ],
    ],

    // ── Rutas ────────────────────────────────────────────────────────────────
    'rutas' => [
        'label'              => 'Rutas',
        'model'              => \App\Models\RutaDiaria::class,
        'table'              => 'ruta_diarias',
        'record_label_field' => 'fecha',
        'fields' => [
            'status' => [
                'label'     => 'Estado',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['confirmada', 'en_progreso', 'completada'],
            ],
            'total_tareas' => [
                'label'     => 'Total de tareas',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'completadas' => [
                'label'     => 'Tareas completadas',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq'],
            ],
            'fecha' => [
                'label'     => 'Fecha de ruta',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'days_from_now_gt', 'days_from_now_lt'],
            ],
            'confirmada_at' => [
                'label'     => 'Fecha de confirmación',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'is_null', 'is_not_null'],
            ],
        ],
    ],

    // ── Tareas ───────────────────────────────────────────────────────────────
    'tasks' => [
        'label'              => 'Tareas',
        'model'              => \App\Models\Task::class,
        'table'              => 'tasks',
        'record_label_field' => 'title',
        'fields' => [
            'status' => [
                'label'     => 'Estado',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['pendiente', 'en_progreso', 'completada', 'archivada'],
            ],
            'priority' => [
                'label'     => 'Prioridad',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['alta', 'media', 'baja'],
            ],
            'estimated_hours' => [
                'label'     => 'Horas estimadas',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq', 'is_null', 'is_not_null'],
            ],
            'actual_hours' => [
                'label'     => 'Horas reales registradas',
                'type'      => 'number',
                'operators' => ['gt', 'lt', 'gte', 'lte', 'eq', 'neq', 'is_null', 'is_not_null'],
            ],
            'start_date' => [
                'label'     => 'Fecha de inicio',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'days_from_now_gt', 'days_from_now_lt', 'is_null', 'is_not_null'],
            ],
            'due_date' => [
                'label'     => 'Fecha de vencimiento',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'days_from_now_gt', 'days_from_now_lt', 'is_null', 'is_not_null'],
            ],
            'completed_at' => [
                'label'     => 'Fecha de completado',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'is_null', 'is_not_null'],
            ],
            'created_at' => [
                'label'     => 'Fecha de creación',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
        ],
    ],

    // ── Visitas ──────────────────────────────────────────────────────────────
    'visitas' => [
        'label'              => 'Visitas',
        'model'              => \App\Models\Visita::class,
        'table'              => 'visitas',
        'record_label_field' => 'institucion_nombre',
        'fields' => [
            'status' => [
                'label'     => 'Estado',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['Planificada', 'Realizada', 'Cancelada'],
            ],
            'fecha_planificada' => [
                'label'     => 'Fecha planificada',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'days_from_now_gt', 'days_from_now_lt'],
            ],
            'fecha_realizada' => [
                'label'     => 'Fecha realizada',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'is_null', 'is_not_null'],
            ],
            'created_at' => [
                'label'     => 'Fecha de creación',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
        ],
    ],

    // ── Incidencias ──────────────────────────────────────────────────────────
    'incidencias' => [
        'label'              => 'Incidencias',
        'model'              => \App\Models\Bug::class,
        'table'              => 'bugs',
        'record_label_field' => 'title',
        'fields' => [
            'status' => [
                'label'     => 'Estado',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['abierto', 'asignado', 'en_progreso', 'cerrado'],
            ],
            'priority' => [
                'label'     => 'Prioridad/Severidad',
                'type'      => 'enum',
                'operators' => ['eq', 'neq', 'in', 'not_in'],
                'options'   => ['crítica', 'alta', 'media', 'baja'],
            ],
            'closed_at' => [
                'label'     => 'Fecha de cierre',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt', 'is_null', 'is_not_null'],
            ],
            'created_at' => [
                'label'     => 'Fecha de reporte',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
            'updated_at' => [
                'label'     => 'Última actualización',
                'type'      => 'date',
                'operators' => ['days_ago_gt', 'days_ago_lt'],
            ],
        ],
    ],

];
