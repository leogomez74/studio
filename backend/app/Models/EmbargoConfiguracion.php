<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmbargoConfiguracion extends Model
{
    protected $table = 'embargo_configuracion';

    protected $fillable = [
        'salario_minimo_inembargable',
        'tasa_ccss',
        'tasa_tramo1',
        'tasa_tramo2',
        'multiplicador_tramo1',
        'tramos_renta',
        'fuente',
        'decreto',
        'anio',
        'activo',
        'ultima_verificacion',
    ];

    protected $casts = [
        'salario_minimo_inembargable' => 'decimal:2',
        'tasa_ccss' => 'decimal:4',
        'tasa_tramo1' => 'decimal:4',
        'tasa_tramo2' => 'decimal:4',
        'multiplicador_tramo1' => 'integer',
        'tramos_renta' => 'array',
        'activo' => 'boolean',
        'ultima_verificacion' => 'datetime',
    ];

    /**
     * Obtener la configuración activa vigente.
     */
    public static function vigente(): ?self
    {
        return self::where('activo', true)
            ->orderByDesc('anio')
            ->first();
    }
}
