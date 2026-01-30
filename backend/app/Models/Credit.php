<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Credit extends Model
{
    use HasFactory;

    protected $fillable = [
        'reference',
        'title',
        'status',
        'category',
        'progress',
        'lead_id',
        'opportunity_id',
        'assigned_to',
        'opened_at',
        'description',
        // New fields
        'tipo_credito',
        'numero_operacion',
        'monto_credito',
        'cuota',
        'movimiento_amortizacion',
        'fecha_ultimo_pago',
        'garantia',
        'fecha_culminacion_credito',
        'tasa_id',
        'tasa_anual',
        'tasa_maxima',
        'plazo',
        'cuotas_atrasadas',
        'deductora_id',
        'poliza',
        'poliza_actual',
        'cargos_adicionales',
        'formalized_at',
    ];

    protected $casts = [
        'progress' => 'integer',
        'opened_at' => 'date',
        'fecha_ultimo_pago' => 'date',
        'fecha_culminacion_credito' => 'date',
        'monto_credito' => 'decimal:2',
        'saldo' => 'decimal:2',
        'cuota' => 'decimal:2',
        'movimiento_amortizacion' => 'decimal:2',
        'poliza_actual' => 'decimal:2',
        'poliza' => 'boolean',
        'cargos_adicionales' => 'array',
        'formalized_at' => 'datetime',
    ];

    /**
     * The attributes that should be appended to the model's array form.
     *
     * @var array<int, string>
     */

    /**
     * Get the date of the first deduction (primera_deduccion).
     *
     * @return string|null
     */
    public function getPrimeraDeduccionAttribute(): ?string
    {
        // Assuming the first deduction is the earliest planDePagos with numero_cuota > 0
        $plan = $this->planDePagos()->where('numero_cuota', '>', 0)->orderBy('fecha_pago')->first();
        return $plan ? optional($plan->fecha_pago)->toDateString() : null;
    }

    protected static function booted()
    {
        static::creating(function ($credit) {
            // Validar que tasa_id esté presente
            if (!$credit->tasa_id) {
                throw new \InvalidArgumentException('El campo tasa_id es obligatorio. No se puede crear un crédito sin una tasa asignada.');
            }

            // Calcular monto neto: monto_credito - cargos_adicionales
            $montoCredito = (float) ($credit->monto_credito ?? 0);
            $totalCargos = array_sum($credit->cargos_adicionales ?? []);
            $montoNeto = $montoCredito - $totalCargos;

            // Saldo inicial = monto neto (lo que realmente se desembolsa)
            if (!isset($credit->saldo)) {
                $credit->saldo = $montoNeto;
            }
        });

        static::updating(function ($credit) {
            // Prevenir que se elimine tasa_id en una actualización
            if ($credit->isDirty('tasa_id') && !$credit->tasa_id) {
                throw new \InvalidArgumentException('No se puede establecer tasa_id como nulo. Todo crédito debe tener una tasa asignada.');
            }
        });

        static::created(function ($credit) {
            // La línea de inicialización (cuota 0) del plan de pagos
            // se crea ahora en el CreditController al formalizar
        });
    }

    public function deductora()
    {
        return $this->belongsTo(Deductora::class);
    }

    public function planDePagos()
    {
        return $this->hasMany(PlanDePago::class);
    }

    public function payments()
    {
        return $this->hasMany(CreditPayment::class);
    }

    public function lead()
    {
        // Use Person instead of Lead to support both Leads and Clients
        return $this->belongsTo(Person::class, 'lead_id');
    }

    public function opportunity()
    {
        return $this->belongsTo(Opportunity::class);
    }

    public function documents()
    {
        return $this->hasMany(CreditDocument::class);
    }

    /**
     * Relación: Tasa de interés del crédito
     */
    public function tasa()
    {
        return $this->belongsTo(Tasa::class, 'tasa_id');
    }

    /**
     * Accessor: tasa_anual (para retrocompatibilidad)
     * Devuelve el valor de la tasa desde la relación
     */
    public function getTasaAnualAttribute()
    {
        return $this->tasa ? $this->tasa->tasa : null;
    }
}
