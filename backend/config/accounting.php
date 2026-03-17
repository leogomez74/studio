<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Sistema Contable Configurable
    |--------------------------------------------------------------------------
    |
    | Activa/desactiva el sistema de asientos configurables dinámicamente.
    | Si está desactivado, usa los métodos legacy hardcodeados.
    |
    */

    'use_configurable_system' => env('ACCOUNTING_USE_CONFIGURABLE', false),

    /*
    |--------------------------------------------------------------------------
    | Control por Tipo de Asiento
    |--------------------------------------------------------------------------
    |
    | Permite activar el sistema configurable solo para ciertos tipos.
    | Útil para migración gradual.
    |
    */

    'use_configurable_by_type' => [
        'FORMALIZACION' => env('ACCOUNTING_CONFIGURABLE_FORMALIZACION', false),
        'PAGO_PLANILLA' => env('ACCOUNTING_CONFIGURABLE_PLANILLA', false),
        'PAGO_VENTANILLA' => env('ACCOUNTING_CONFIGURABLE_VENTANILLA', false),
        'ABONO_EXTRAORDINARIO' => env('ACCOUNTING_CONFIGURABLE_EXTRAORDINARIO', false),
        'CANCELACION_ANTICIPADA' => env('ACCOUNTING_CONFIGURABLE_CANCELACION', false),
        'REFUNDICION_CIERRE' => env('ACCOUNTING_CONFIGURABLE_REFUND_CIERRE', false),
        'REFUNDICION_NUEVO' => env('ACCOUNTING_CONFIGURABLE_REFUND_NUEVO', false),
        'DEVOLUCION' => env('ACCOUNTING_CONFIGURABLE_DEVOLUCION', false),
        'ANULACION_PLANILLA' => env('ACCOUNTING_CONFIGURABLE_ANULACION_PLANILLA', false),
        'REVERSO_PAGO' => env('ACCOUNTING_CONFIGURABLE_ANULACION_ABONO', false),
        'SALDO_SOBRANTE' => env('ACCOUNTING_CONFIGURABLE_SALDO_SOBRANTE', false),
        'REINTEGRO_SALDO' => env('ACCOUNTING_CONFIGURABLE_REINTEGRO_SALDO', false),
        'ANULACION_SOBRANTE' => env('ACCOUNTING_CONFIGURABLE_ANULACION_SOBRANTE', false),
        'REVERSO_EXTRAORDINARIO' => env('ACCOUNTING_CONFIGURABLE_REVERSO_EXTRAORDINARIO', false),
        'REVERSO_CANCELACION' => env('ACCOUNTING_CONFIGURABLE_REVERSO_CANCELACION', false),
        'ABONO_CAPITAL' => env('ACCOUNTING_CONFIGURABLE_ABONO_CAPITAL', false),
        // Inversiones
        'INV_CAPITAL_RECIBIDO'  => env('ACCOUNTING_CONFIGURABLE_INV_CAPITAL', false),
        'INV_INTERES_DEVENGADO' => env('ACCOUNTING_CONFIGURABLE_INV_INTERES', false),
        'INV_CANCELACION_TOTAL' => env('ACCOUNTING_CONFIGURABLE_INV_CANCELACION', false),
        'INV_PAGO_MANUAL'       => env('ACCOUNTING_CONFIGURABLE_INV_PAGO_MANUAL', false),
    ],
];
