<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Visita extends Model
{
    protected $fillable = [
        'user_id',
        'institucion_id',
        'institucion_nombre',
        'fecha_planificada',
        'fecha_realizada',
        'status',
        'notas',
        'resultado',
        'contacto_nombre',
        'contacto_telefono',
        'contacto_email',
    ];

    protected $casts = [
        'fecha_planificada' => 'date',
        'fecha_realizada' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function institucion()
    {
        return $this->belongsTo(Institucion::class);
    }

    /**
     * Nombre de la institución: de la relación o del campo manual.
     */
    public function getNombreInstitucionAttribute(): string
    {
        return $this->institucion?->nombre ?? $this->institucion_nombre ?? '';
    }

    public function scopeProximas($query)
    {
        return $query->where('status', 'Planificada')
            ->where('fecha_planificada', '>=', now()->toDateString())
            ->orderBy('fecha_planificada');
    }

    public function scopeDelPeriodo($query, int $anio, int $mes)
    {
        return $query->whereYear('fecha_planificada', $anio)
            ->whereMonth('fecha_planificada', $mes);
    }
}
