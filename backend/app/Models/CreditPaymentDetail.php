<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CreditPaymentDetail extends Model
{
    protected $fillable = [
        'credit_payment_id',
        'plan_de_pago_id',
        'numero_cuota',
        'estado_anterior',
        'pago_mora',
        'pago_int_vencido',
        'pago_int_corriente',
        'pago_poliza',
        'pago_principal',
        'pago_total',
    ];

    protected $casts = [
        'pago_mora' => 'decimal:2',
        'pago_int_vencido' => 'decimal:2',
        'pago_int_corriente' => 'decimal:2',
        'pago_poliza' => 'decimal:2',
        'pago_principal' => 'decimal:2',
        'pago_total' => 'decimal:2',
    ];

    public function creditPayment(): BelongsTo
    {
        return $this->belongsTo(CreditPayment::class);
    }

    public function planDePago(): BelongsTo
    {
        return $this->belongsTo(PlanDePago::class);
    }
}
