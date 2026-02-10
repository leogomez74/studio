<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Analisis extends Model
{
    use HasFactory;

    protected $table = 'analisis';
    protected $fillable = [
        'reference',
        'title',
        'estado_pep',
        'estado_cliente',
        'category',
        'monto_solicitado',
        'monto_sugerido',
        'cuota',
        'lead_id',
        'opportunity_id',
        'assigned_to',
        'opened_at',
        'description',
        'divisa',
        'plazo',
        'ingreso_bruto',
        'ingreso_neto',
        'ingreso_bruto_2',
        'ingreso_neto_2',
        'ingreso_bruto_3',
        'ingreso_neto_3',
        'ingreso_bruto_4',
        'ingreso_neto_4',
        'ingreso_bruto_5',
        'ingreso_neto_5',
        'ingreso_bruto_6',
        'ingreso_neto_6',
        'numero_manchas',
        'numero_juicios',
        'numero_embargos',
        'propuesta',
        'cargo',
        'nombramiento',
        'salarios_anteriores',
        'deducciones',
        // manchas_detalle, juicios_detalle, embargos_detalle ahora en tablas separadas
        'deducciones_mensuales',
    ];

    protected $casts = [
        'opened_at' => 'date',
        'monto_solicitado' => 'decimal:2',
        'monto_sugerido' => 'decimal:2',
        'cuota' => 'decimal:2',
        'ingreso_bruto' => 'decimal:2',
        'ingreso_neto' => 'decimal:2',
        'ingreso_bruto_2' => 'decimal:2',
        'ingreso_neto_2' => 'decimal:2',
        'ingreso_bruto_3' => 'decimal:2',
        'ingreso_neto_3' => 'decimal:2',
        'ingreso_bruto_4' => 'decimal:2',
        'ingreso_neto_4' => 'decimal:2',
        'ingreso_bruto_5' => 'decimal:2',
        'ingreso_neto_5' => 'decimal:2',
        'ingreso_bruto_6' => 'decimal:2',
        'ingreso_neto_6' => 'decimal:2',
        'plazo' => 'integer',
        'numero_manchas' => 'integer',
        'numero_juicios' => 'integer',
        'numero_embargos' => 'integer',
        'salarios_anteriores' => 'array',
        'deducciones' => 'array',
        // manchas_detalle, juicios_detalle, embargos_detalle ahora en tablas separadas
        'deducciones_mensuales' => 'array',
    ];

    protected $appends = [
        'has_credit',
        'credit_id',
        'credit_status',
        'monto_credito',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            // La referencia es el ID de la oportunidad asociada
            if (empty($model->reference) && !empty($model->opportunity_id)) {
                $model->reference = $model->opportunity_id;
            }
        });
    }

    // Relationships
    public function lead()
    {
        // Usa Person en lugar de Lead para incluir tanto Leads (type=1) como Clientes (type=2)
        return $this->belongsTo(Person::class, 'lead_id');
    }

    public function opportunity()
    {
        return $this->belongsTo(Opportunity::class);
    }

    public function propuestas()
    {
        return $this->hasMany(Propuesta::class, 'analisis_reference', 'reference');
    }

    public function manchaDetalles()
    {
        return $this->hasMany(ManchaDetalle::class);
    }

    public function juicioDetalles()
    {
        return $this->hasMany(JuicioDetalle::class);
    }

    public function embargoDetalles()
    {
        return $this->hasMany(EmbargoDetalle::class);
    }

    /**
     * Verificar si ya existe un crédito asociado a este análisis
     * Un crédito puede estar vinculado por opportunity_id o lead_id
     */
    public function credit()
    {
        return $this->hasOne(Credit::class, 'opportunity_id', 'opportunity_id');
    }

    /**
     * Accessor: monto_credito es alias de monto_sugerido para compatibilidad con el frontend.
     */
    public function getMontoCreditoAttribute(): ?string
    {
        return $this->monto_sugerido;
    }

    /**
     * Accessor para saber si tiene crédito asociado
     */
    public function getHasCreditAttribute(): bool
    {
        return Credit::where('opportunity_id', $this->opportunity_id)
            ->orWhere(function ($query) {
                $query->where('lead_id', $this->lead_id)
                      ->whereNotNull('lead_id');
            })
            ->exists();
    }

    /**
     * Accessor para obtener el ID del crédito asociado
     */
    public function getCreditIdAttribute(): ?int
    {
        $credit = Credit::where('opportunity_id', $this->opportunity_id)
            ->orWhere(function ($query) {
                $query->where('lead_id', $this->lead_id)
                      ->whereNotNull('lead_id');
            })
            ->first();

        return $credit?->id;
    }

    /**
     * Accessor para obtener el status del crédito asociado
     */
    public function getCreditStatusAttribute(): ?string
    {
        $credit = Credit::where('opportunity_id', $this->opportunity_id)
            ->orWhere(function ($query) {
                $query->where('lead_id', $this->lead_id)
                      ->whereNotNull('lead_id');
            })
            ->first();

        return $credit?->status;
    }
}
