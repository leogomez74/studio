<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Investment extends Model
{
    use HasFactory;

    protected $fillable = [
        'numero_desembolso',
        'investor_id',
        'monto_capital',
        'plazo_meses',
        'fecha_inicio',
        'fecha_vencimiento',
        'tasa_anual',
        'moneda',
        'forma_pago',
        'es_capitalizable',
        'estado',
        'notas',
    ];

    protected $casts = [
        'monto_capital' => 'decimal:2',
        'tasa_anual' => 'decimal:4',
        'fecha_inicio' => 'date',
        'fecha_vencimiento' => 'date',
        'es_capitalizable' => 'boolean',
    ];

    protected $appends = ['interes_mensual', 'retencion_mensual', 'interes_neto_mensual', 'interes_del_cupon'];

    public function investor()
    {
        return $this->belongsTo(Investor::class);
    }

    public function coupons()
    {
        return $this->hasMany(InvestmentCoupon::class);
    }

    public function payments()
    {
        return $this->hasMany(InvestmentPayment::class);
    }

    public function rateHistory()
    {
        return $this->hasMany(InvestmentRateHistory::class);
    }

    public function getInteresMensualAttribute(): float
    {
        return round((float) $this->monto_capital * (float) $this->tasa_anual / 12, 2);
    }

    public function getRetencionMensualAttribute(): float
    {
        return round($this->interes_mensual * 0.15, 2);
    }

    public function getInteresNetoMensualAttribute(): float
    {
        return round($this->interes_mensual - $this->retencion_mensual, 2);
    }

    public function getInteresDelCuponAttribute(): float
    {
        $mensual = $this->interes_mensual;
        return match ($this->forma_pago) {
            'MENSUAL' => $mensual,
            'TRIMESTRAL' => round($mensual * 3, 2),
            'SEMESTRAL' => round($mensual * 6, 2),
            'ANUAL' => round($mensual * 12, 2),
            'RESERVA' => $mensual,
            default => $mensual,
        };
    }
}
