<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InvestmentCoupon extends Model
{
    use HasFactory;

    protected $fillable = [
        'investment_id',
        'fecha_cupon',
        'interes_bruto',
        'retencion',
        'interes_neto',
        'monto_reservado',
        'capital_acumulado',
        'estado',
        'fecha_pago',
        'comprobante',
        'notas',
    ];

    protected $casts = [
        'interes_bruto' => 'decimal:2',
        'retencion' => 'decimal:2',
        'interes_neto' => 'decimal:2',
        'monto_reservado' => 'decimal:2',
        'capital_acumulado' => 'decimal:2',
        'fecha_cupon' => 'date',
        'fecha_pago' => 'date',
    ];

    public function investment()
    {
        return $this->belongsTo(Investment::class);
    }

    public function scopePendientes($query)
    {
        return $query->where('estado', 'Pendiente');
    }

    public function scopePagados($query)
    {
        return $query->where('estado', 'Pagado');
    }

    public function scopeReservados($query)
    {
        return $query->where('estado', 'Reservado');
    }
}
