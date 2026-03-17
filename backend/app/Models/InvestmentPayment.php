<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InvestmentPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'investor_id',
        'investment_id',
        'fecha_pago',
        'monto_capital',
        'monto_interes',
        'monto',
        'tipo',
        'moneda',
        'comentarios',
        'comprobante_url',
        'periodo',
        'registered_by',
    ];

    protected $casts = [
        'monto_capital' => 'decimal:2',
        'monto_interes' => 'decimal:2',
        'monto' => 'decimal:2',
        'fecha_pago' => 'date',
        'periodo' => 'date',
    ];

    public function investor()
    {
        return $this->belongsTo(Investor::class);
    }

    public function investment()
    {
        return $this->belongsTo(Investment::class);
    }

    public function registeredByUser()
    {
        return $this->belongsTo(User::class, 'registered_by');
    }
}
