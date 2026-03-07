<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReglaComision extends Model
{
    protected $table = 'reglas_comision';

    protected $fillable = [
        'nombre',
        'tipo',
        'monto_minimo',
        'monto_maximo',
        'porcentaje',
        'activo',
    ];

    protected $casts = [
        'monto_minimo' => 'decimal:2',
        'monto_maximo' => 'decimal:2',
        'porcentaje' => 'decimal:4',
        'activo' => 'boolean',
    ];

    /**
     * Busca la regla aplicable para un monto y tipo dado.
     */
    public static function buscarRegla(string $tipo, float $monto): ?self
    {
        return static::where('tipo', $tipo)
            ->where('activo', true)
            ->where('monto_minimo', '<=', $monto)
            ->where(function ($q) use ($monto) {
                $q->whereNull('monto_maximo')
                    ->orWhere('monto_maximo', '>=', $monto);
            })
            ->orderByDesc('porcentaje')
            ->first();
    }
}
