<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoanConfiguration extends Model
{
    protected $fillable = [
        'tipo',
        'nombre',
        'descripcion',
        'monto_minimo',
        'monto_maximo',
        'tasa_anual',
        'plazo_minimo',
        'plazo_maximo',
        'activo',
    ];

    protected $casts = [
        'monto_minimo' => 'decimal:2',
        'monto_maximo' => 'decimal:2',
        'tasa_anual' => 'decimal:2',
        'plazo_minimo' => 'integer',
        'plazo_maximo' => 'integer',
        'activo' => 'boolean',
    ];

    /**
     * Obtener configuración de microcrédito
     */
    public static function microcredito()
    {
        return self::where('tipo', 'microcredito')->first();
    }

    /**
     * Obtener configuración de crédito regular
     */
    public static function regular()
    {
        return self::where('tipo', 'regular')->first();
    }

    /**
     * Obtener todas las configuraciones activas
     */
    public static function activas()
    {
        return self::where('activo', true)->get();
    }
}
