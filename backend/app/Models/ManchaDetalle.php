<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ManchaDetalle extends Model
{
    protected $table = 'mancha_detalles';

    protected $fillable = [
        'analisis_id',
        'fecha_inicio',
        'fecha_fin',
        'descripcion',
        'monto',
    ];

    protected $casts = [
        'fecha_inicio' => 'date',
        'fecha_fin' => 'date',
        'monto' => 'decimal:2',
    ];

    public function analisis(): BelongsTo
    {
        return $this->belongsTo(Analisis::class);
    }
}
