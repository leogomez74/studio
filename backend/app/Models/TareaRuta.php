<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class TareaRuta extends Model
{
    protected $table = 'tareas_ruta';

    protected $fillable = [
        'titulo',
        'descripcion',
        'tipo',
        'prioridad',
        'status',
        'solicitado_por',
        'asignado_a',
        'ruta_diaria_id',
        'empresa_destino',
        'direccion_destino',
        'provincia',
        'canton',
        'contacto_nombre',
        'contacto_telefono',
        'fecha_limite',
        'fecha_asignada',
        'posicion',
        'prioridad_override',
        'prioridad_por',
        'completada_at',
        'notas_completado',
        'motivo_fallo',
        'referencia_tipo',
        'referencia_id',
    ];

    protected $casts = [
        'fecha_limite' => 'date',
        'fecha_asignada' => 'date',
        'completada_at' => 'datetime',
        'prioridad_override' => 'boolean',
    ];

    // --- Relaciones ---

    public function solicitante(): BelongsTo
    {
        return $this->belongsTo(User::class, 'solicitado_por');
    }

    public function asignado(): BelongsTo
    {
        return $this->belongsTo(User::class, 'asignado_a');
    }

    public function rutaDiaria(): BelongsTo
    {
        return $this->belongsTo(RutaDiaria::class);
    }

    public function prioridadPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prioridad_por');
    }

    public function referencia(): MorphTo
    {
        return $this->morphTo('referencia', 'referencia_tipo', 'referencia_id');
    }

    public function evidencias(): HasMany
    {
        return $this->hasMany(TareaRutaEvidencia::class);
    }

    // --- Scopes ---

    public function scopePendientes($query)
    {
        return $query->where('status', 'pendiente');
    }

    public function scopeOrdenFifo($query)
    {
        return $query->orderByRaw("CASE prioridad WHEN 'critica' THEN 0 WHEN 'urgente' THEN 1 WHEN 'normal' THEN 2 END ASC")
            ->orderByRaw("COALESCE(fecha_limite, '2099-12-31') ASC")
            ->orderBy('created_at', 'asc');
    }

    public function scopeDeRuta($query, int $rutaId)
    {
        return $query->where('ruta_diaria_id', $rutaId)->orderBy('posicion');
    }
}
