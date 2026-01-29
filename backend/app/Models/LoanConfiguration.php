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
        'tasa_id',
        'plazo_minimo',
        'plazo_maximo',
        'activo',
        'monto_poliza',
    ];

    protected $casts = [
        'monto_minimo' => 'decimal:2',
        'monto_maximo' => 'decimal:2',
        'plazo_minimo' => 'integer',
        'plazo_maximo' => 'integer',
        'activo' => 'boolean',
        'monto_poliza' => 'decimal:2',
    ];

    /**
     * Relación con Tasa
     */
    public function tasa()
    {
        return $this->belongsTo(Tasa::class, 'tasa_id');
    }

    /**
     * Accessor para mantener compatibilidad con código legacy
     */
    public function getTasaAnualAttribute()
    {
        return $this->tasa ? $this->tasa->tasa : null;
    }

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
