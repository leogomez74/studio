<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CreditPayment extends Model
{
    protected $fillable = [
        'credit_id',
        'numero_cuota',
        'proceso',
        'fecha_cuota',
        'fecha_pago',
        'cuota',
        'cargos',
        'poliza',
        'interes_corriente',
        'interes_moratorio',
        'amortizacion',
        'saldo_anterior',
        'nuevo_saldo',
        'estado',
        'fecha_movimiento',
        'movimiento_total'
    ];

    protected $casts = [
        'fecha_cuota' => 'date',
        'fecha_pago' => 'date',
        'fecha_movimiento' => 'date',
        'cuota' => 'decimal:2',
        'cargos' => 'decimal:2',
        'poliza' => 'decimal:2',
        'interes_corriente' => 'decimal:2',
        'interes_moratorio' => 'decimal:2',
        'amortizacion' => 'decimal:2',
        'saldo_anterior' => 'decimal:2',
        'nuevo_saldo' => 'decimal:2',
        'movimiento_total' => 'decimal:2',
    ];

    public function credit()
    {
        return $this->belongsTo(Credit::class);
    }
}
