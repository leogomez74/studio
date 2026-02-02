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
        'monto_credito',
        'lead_id',
        'opportunity_id',
        'assigned_to',
        'opened_at',
        'description',
        'divisa',
        'plazo',
        'ingreso_bruto',
        'ingreso_neto',
        'deducciones',
    ];

    protected $casts = [
        'opened_at' => 'date',
        'monto_credito' => 'decimal:2',
        'ingreso_bruto' => 'decimal:2',
        'ingreso_neto' => 'decimal:2',
        'plazo' => 'integer',
        'deducciones' => 'array',
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

    /**
     * Verificar si ya existe un crédito asociado a este análisis
     * Un crédito puede estar vinculado por opportunity_id o lead_id
     */
    public function credit()
    {
        return $this->hasOne(Credit::class, 'opportunity_id', 'opportunity_id');
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
}
