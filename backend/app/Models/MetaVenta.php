<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

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

    public function user()
    {
        return $this->belongsTo(User::class);
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
