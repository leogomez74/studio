<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExpedienteActuacion extends Model
{
    protected $table = 'expediente_actuaciones';

    protected $fillable = [
        'expediente_id',
        'user_id',
        'notificacion_id',
        'tipo',
        'descripcion',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function expediente(): BelongsTo
    {
        return $this->belongsTo(ExpedienteJudicial::class, 'expediente_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function notificacion(): BelongsTo
    {
        return $this->belongsTo(NotificacionJudicial::class, 'notificacion_id');
    }
}
