<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Comision extends Model
{
    protected $table = 'comisiones';

    protected $fillable = [
        'user_id',
        'tipo',
        'referencia_id',
        'referencia_tipo',
        'monto_operacion',
        'porcentaje',
        'monto_comision',
        'estado',
        'fecha_operacion',
        'fecha_aprobacion',
        'fecha_pago',
        'aprobada_por',
        'notas',
    ];

    protected $casts = [
        'monto_operacion' => 'decimal:2',
        'porcentaje' => 'decimal:4',
        'monto_comision' => 'decimal:2',
        'fecha_operacion' => 'date',
        'fecha_aprobacion' => 'date',
        'fecha_pago' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function aprobadaPor()
    {
        return $this->belongsTo(User::class, 'aprobada_por');
    }

    /**
     * Relación polimórfica al crédito o inversión.
     */
    public function referencia()
    {
        return $this->morphTo('referencia', 'referencia_tipo', 'referencia_id');
    }

    public function scopePendientes($query)
    {
        return $query->where('estado', 'Pendiente');
    }

    public function scopeDelPeriodo($query, int $anio, int $mes)
    {
        return $query->whereYear('fecha_operacion', $anio)
            ->whereMonth('fecha_operacion', $mes);
    }
}
