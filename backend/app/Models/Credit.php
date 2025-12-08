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
        'fecha_ultimo_pago',
        'garantia',
        'fecha_culminacion_credito',
        'tasa_anual',
        'plazo',
        'cuotas_atrasadas',
        'deductora_id'
    ];

    protected $casts = [
        'progress' => 'integer',
        'opened_at' => 'date',
        'fecha_ultimo_pago' => 'date',
        'fecha_culminacion_credito' => 'date',
        'monto_credito' => 'decimal:2',
        'cuota' => 'decimal:2',
        'tasa_anual' => 'decimal:2',
    ];

    public function deductora()
    {
        return $this->belongsTo(Deductora::class);
    }

    public function payments()
    {
        return $this->hasMany(CreditPayment::class);
    }

    public function lead()
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }

    public function opportunity()
    {
        return $this->belongsTo(Opportunity::class);
    }

    public function documents()
    {
        return $this->hasMany(CreditDocument::class);
    }
}
