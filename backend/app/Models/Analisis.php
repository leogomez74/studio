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
        'propuesta',
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
        return $this->belongsTo(Lead::class);
    }

    public function opportunity()
    {
        return $this->belongsTo(Opportunity::class);
    }
}
