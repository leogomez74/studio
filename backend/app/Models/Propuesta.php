<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Propuesta extends Model
{
    use HasFactory;

    public const ESTADO_PENDIENTE = 'Pendiente';
    public const ESTADO_ACEPTADA = 'Aceptada';
    public const ESTADO_DENEGADA = 'Denegada';

    protected $table = 'propuestas';

    protected $fillable = [
        'analisis_reference',
        'monto',
        'plazo',
        'cuota',
        'interes',
        'categoria',
        'estado',
        'aceptada_por',
        'aceptada_at',
    ];

    protected $casts = [
        'monto' => 'decimal:2',
        'cuota' => 'decimal:2',
        'interes' => 'decimal:4',
        'plazo' => 'integer',
        'aceptada_at' => 'datetime',
    ];

    public function analisis()
    {
        return $this->belongsTo(Analisis::class, 'analisis_reference', 'reference');
    }

    public function aceptadaPorUser()
    {
        return $this->belongsTo(User::class, 'aceptada_por');
    }
}
