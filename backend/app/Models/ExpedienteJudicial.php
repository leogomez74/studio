<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExpedienteJudicial extends Model
{
    use SoftDeletes;

    protected $table = 'expedientes_judiciales';

    protected $fillable = [
        'numero_expediente',
        'credit_id',
        'cedula_deudor',
        'nombre_deudor',
        'patrono_deudor',
        'patrono_anterior',
        'monto_demanda',
        'estado',
        'sub_estado',
        'credipep_es_actor',
        'propuesto_por',
        'propuesto_at',
        'aprobado_por',
        'aprobado_at',
        'razon_rechazo',
        'abogado',
        'juzgado',
        'fecha_presentacion',
        'fecha_ultima_actuacion',
        'alerta_impulso',
        'alerta_prescripcion',
        'notas',
    ];

    protected $casts = [
        'propuesto_at'           => 'datetime',
        'aprobado_at'            => 'datetime',
        'fecha_presentacion'     => 'date',
        'fecha_ultima_actuacion' => 'date',
        'monto_demanda'          => 'decimal:2',
        'alerta_impulso'         => 'boolean',
        'alerta_prescripcion'    => 'boolean',
        'credipep_es_actor'      => 'boolean',
    ];

    public const DIAS_ALERTA_IMPULSO = 90;
    public const AÑOS_PRESCRIPCION = 4;

    public function credit(): BelongsTo
    {
        return $this->belongsTo(Credit::class);
    }

    public function propuestoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'propuesto_por');
    }

    public function aprobadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'aprobado_por');
    }

    public function notificaciones(): HasMany
    {
        return $this->hasMany(NotificacionJudicial::class, 'expediente_id');
    }

    public function actuaciones(): HasMany
    {
        return $this->hasMany(ExpedienteActuacion::class, 'expediente_id')->latest();
    }

    public function scopePosibles($query)
    {
        return $query->where('estado', 'posible');
    }

    public function scopeActivos($query)
    {
        return $query->where('estado', 'activo');
    }

    public function scopePropuestos($query)
    {
        return $query->where('estado', 'propuesto');
    }

    public function scopePorSubEstado($query, string $subEstado)
    {
        return $query->where('estado', 'activo')->where('sub_estado', $subEstado);
    }

    public function registrarActuacion(
        string $tipo,
        string $descripcion,
        ?int $userId = null,
        array $metadata = [],
        ?int $notificacionId = null
    ): ExpedienteActuacion {
        return $this->actuaciones()->create([
            'tipo'            => $tipo,
            'descripcion'     => $descripcion,
            'user_id'         => $userId,
            'notificacion_id' => $notificacionId,
            'metadata'        => $metadata ?: null,
        ]);
    }
}
