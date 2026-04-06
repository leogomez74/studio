<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificacionJudicial extends Model
{
    protected $table = 'notificaciones_judiciales';

    protected $fillable = [
        'expediente_id',
        'numero_expediente_pj',
        'tipo_acto',
        'fecha_acto',
        'descripcion',
        'archivo_pdf',
        'archivo_nombre_original',
        'estado_procesamiento',
        'confianza_clasificacion',
        'correo_origen',
        'recibido_at',
    ];

    protected $casts = [
        'fecha_acto'              => 'date',
        'recibido_at'             => 'datetime',
        'confianza_clasificacion' => 'decimal:2',
    ];

    public function expediente(): BelongsTo
    {
        return $this->belongsTo(ExpedienteJudicial::class, 'expediente_id');
    }

    public function scopeIndefinidas($query)
    {
        return $query->where('estado_procesamiento', 'indefinido');
    }

    public function scopePendientes($query)
    {
        return $query->where('estado_procesamiento', 'pendiente');
    }
}
