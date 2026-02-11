<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaldoPendiente extends Model
{
    protected $table = 'saldos_pendientes';

    protected $fillable = [
        'credit_id',
        'credit_payment_id',
        'monto',
        'origen',
        'fecha_origen',
        'estado',
        'asignado_at',
        'notas',
        'cedula',
    ];

    protected $casts = [
        'monto' => 'decimal:2',
        'fecha_origen' => 'date',
        'asignado_at' => 'datetime',
    ];

    public function credit()
    {
        return $this->belongsTo(Credit::class);
    }

    public function creditPayment()
    {
        return $this->belongsTo(CreditPayment::class);
    }

    public function scopePendientes($query)
    {
        return $query->where('estado', 'pendiente');
    }
}
