<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MetaVenta extends Model
{
    protected $table = 'metas_venta';

    protected $fillable = [
        'user_id',
        'anio',
        'mes',
        'meta_creditos_monto',
        'meta_creditos_cantidad',
        'meta_inversiones_monto',
        'meta_inversiones_cantidad',
        'notas',
        'activo',
    ];

    protected $casts = [
        'meta_creditos_monto' => 'decimal:2',
        'meta_inversiones_monto' => 'decimal:2',
        'activo' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function bonusTiers(): HasMany
    {
        return $this->hasMany(MetaBonusTier::class, 'meta_venta_id')->orderBy('creditos_minimos');
    }

    /**
     * Retorna el tier activo según la cantidad de créditos alcanzados.
     * El tier activo es el de mayor umbral que el vendedor ya superó.
     */
    public function tierActivo(int $creditosAlcanzados): ?MetaBonusTier
    {
        return $this->bonusTiers
            ->where('creditos_minimos', '<=', $creditosAlcanzados)
            ->sortByDesc('creditos_minimos')
            ->first();
    }

    /**
     * Retorna el siguiente tier aún no alcanzado.
     */
    public function proximoTier(int $creditosAlcanzados): ?MetaBonusTier
    {
        return $this->bonusTiers
            ->where('creditos_minimos', '>', $creditosAlcanzados)
            ->sortBy('creditos_minimos')
            ->first();
    }

    /**
     * Créditos formalizados por este vendedor en el período de la meta.
     */
    public function creditosDelPeriodo()
    {
        return Credit::where('assigned_to', $this->user_id)
            ->whereYear('formalized_at', $this->anio)
            ->whereMonth('formalized_at', $this->mes)
            ->whereNotNull('formalized_at');
    }

    /**
     * Inversiones captadas por este vendedor en el período de la meta.
     */
    public function inversionesDelPeriodo()
    {
        return Investment::whereHas('investor', function ($q) {
            // Inversiones no tienen assigned_to directo, se puede filtrar si se agrega el campo
        })
            ->whereYear('fecha_inicio', $this->anio)
            ->whereMonth('fecha_inicio', $this->mes);
    }

    public function scopeVigente($query, ?int $anio = null, ?int $mes = null)
    {
        return $query->where('anio', $anio ?? date('Y'))
            ->where('mes', $mes ?? date('n'))
            ->where('activo', true);
    }
}
