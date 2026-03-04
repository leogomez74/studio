<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Investor extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'cedula',
        'email',
        'phone',
        'status',
        'tipo_persona',
        'notas',
        'cuenta_bancaria',
        'banco',
        'investment_balance',
        'joined_at',
    ];

    protected $casts = [
        'investment_balance' => 'decimal:2',
        'joined_at' => 'date',
    ];

    protected $appends = ['active_investments_count'];

    public function investments()
    {
        return $this->hasMany(Investment::class);
    }

    public function payments()
    {
        return $this->hasMany(InvestmentPayment::class);
    }

    public function capitalReserves()
    {
        return $this->hasMany(CapitalReserve::class);
    }

    public function getActiveInvestmentsCountAttribute(): int
    {
        return $this->investments()->where('estado', 'Activa')->count();
    }

    public function getTotalInvertidoCrcAttribute(): float
    {
        return (float) $this->investments()->where('moneda', 'CRC')->where('estado', 'Activa')->sum('monto_capital');
    }

    public function getTotalInvertidoUsdAttribute(): float
    {
        return (float) $this->investments()->where('moneda', 'USD')->where('estado', 'Activa')->sum('monto_capital');
    }
}
