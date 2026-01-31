<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CreditPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'credit_id',
        'numero_cuota',
        'proceso',
        'fecha_cuota',
        'fecha_pago',
        'cuota',           // Cuota exigible (Snapshot del momento)
        'monto',           // Dinero real pagado
        'poliza',
        'interes_corriente', // Informativo: cuánto de este pago fue a interés
        'interes_moratorio', // Informativo: cuánto de este pago fue a mora
        'amortizacion',      // Informativo: cuánto de este pago fue a capital
        'saldo_anterior',
        'nuevo_saldo',
        'estado',
        'fecha_movimiento',
        'movimiento_total',  // Usado si hubo excedente
        'movimiento_amortizacion',
        'linea',
        'fecha_inicio',
        'fecha_corte',
        'tasa_actual',
        'plazo_actual',
        'dias',
        'dias_mora',
        'source', // Origen del pago (Ventanilla, Planilla, etc.)
        'cedula'  // Referencia para cargas masivas
    ];

    protected $casts = [
        'fecha_cuota' => 'date',
        'fecha_pago' => 'date',
        'fecha_movimiento' => 'date',
        'fecha_inicio' => 'date',
        'fecha_corte' => 'date',
        'cuota' => 'decimal:2',
        'monto' => 'decimal:2',
        'poliza' => 'decimal:2',
        'interes_corriente' => 'decimal:2',
        'interes_moratorio' => 'decimal:2',
        'amortizacion' => 'decimal:2',
        'saldo_anterior' => 'decimal:2',
        'nuevo_saldo' => 'decimal:2',
        'movimiento_total' => 'decimal:2',
        'movimiento_amortizacion' => 'decimal:2',
        'tasa_actual' => 'decimal:2',
    ];

    public function credit()
    {
        return $this->belongsTo(Credit::class);
    }
}
