<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PlanillaUpload extends Model
{
    protected $fillable = [
        'deductora_id',
        'user_id',
        'fecha_planilla',
        'uploaded_at',
        'nombre_archivo',
        'ruta_archivo',
        'cantidad_pagos',
        'monto_total',
        'estado',
        'anulada_at',
        'anulada_por',
        'motivo_anulacion',
    ];

    protected $casts = [
        'fecha_planilla' => 'date',
        'uploaded_at' => 'datetime',
        'anulada_at' => 'datetime',
        'monto_total' => 'decimal:2',
    ];

    public function deductora(): BelongsTo
    {
        return $this->belongsTo(Deductora::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function anuladaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'anulada_por');
    }

    public function creditPayments(): HasMany
    {
        return $this->hasMany(CreditPayment::class);
    }
}
