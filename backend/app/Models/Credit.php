<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Credit extends Model
{
    use HasFactory;

    // Estados de crédito
    public const STATUS_APROBADO = 'Aprobado';
    public const STATUS_POR_FIRMAR = 'Por firmar';
    public const STATUS_ACTIVO = 'Activo';
    public const STATUS_EN_MORA = 'En Mora';
    public const STATUS_CERRADO = 'Cerrado';
    public const STATUS_LEGAL = 'Legal';
    public const STATUS_FORMALIZADO = 'Formalizado';

    // Estados editables (solo estos pueden modificarse)
    public const EDITABLE_STATUSES = [
        self::STATUS_APROBADO,
        self::STATUS_POR_FIRMAR,
    ];

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

            // Saldo inicial = monto_credito (los cargos ya fueron descontados antes de crear el crédito)
            if (!isset($credit->saldo)) {
                $credit->saldo = (float) ($credit->monto_credito ?? 0);
            }
        });

        static::updating(function ($credit) {
            // Prevenir que se elimine tasa_id en una actualización
            if ($credit->isDirty('tasa_id') && !$credit->tasa_id) {
                throw new \InvalidArgumentException('No se puede establecer tasa_id como nulo. Todo crédito debe tener una tasa asignada.');
            }

            // PROTECCIÓN: Cuando se formaliza un crédito, copiar valores de tasa para congelarlos
            if ($credit->isDirty('formalized_at') && $credit->formalized_at) {
                // Cargar la tasa relacionada si no está cargada
                if (!$credit->relationLoaded('tasa')) {
                    $credit->load('tasa');
                }

                // Copiar valores de la tasa al crédito para congelarlos
                if ($credit->tasa) {
                    // Solo copiar si no tienen valores previamente establecidos
                    if (!$credit->tasa_anual || $credit->tasa_anual == 0) {
                        $credit->tasa_anual = $credit->tasa->tasa;
                    }
                    if (!$credit->tasa_maxima || $credit->tasa_maxima == 0) {
                        $credit->tasa_maxima = $credit->tasa->tasa_maxima;
                    }
                }
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
     * Accessor: tasa_anual
     * Devuelve el valor congelado del campo si existe, sino usa la relación
     */
    public function getTasaAnualAttribute($value)
    {
        // Si hay un valor en el campo (tasa congelada), usarlo
        if ($value !== null) {
            return $value;
        }

        // Fallback: usar valor de la relación si está cargada
        return $this->tasa ? $this->tasa->tasa : null;
    }
}
