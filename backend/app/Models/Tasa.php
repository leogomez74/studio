<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class Tasa extends Model
{
    protected $fillable = [
        'nombre',
        'tasa',
        'inicio',
        'fin',
        'activo',
    ];

    protected $casts = [
        'tasa' => 'decimal:2',
        'inicio' => 'date',
        'fin' => 'date',
        'activo' => 'boolean',
    ];

    /**
     * Scope: Obtener tasas activas
     */
    public function scopeActiva($query)
    {
        return $query->where('activo', true);
    }

    /**
     * Scope: Obtener tasa vigente para una fecha específica
     */
    public function scopeVigente($query, $fecha = null)
    {
        // Normalizar fecha a inicio del día (00:00:00) para comparaciones consistentes
        $fecha = $fecha ? Carbon::parse($fecha)->startOfDay() : Carbon::now()->startOfDay();

        return $query->where('activo', true)
            ->where('inicio', '<=', $fecha->format('Y-m-d'))
            ->where(function ($q) use ($fecha) {
                $q->whereNull('fin')
                  ->orWhere('fin', '>=', $fecha->format('Y-m-d'));
            });
    }

    /**
     * Scope: Buscar tasa por nombre
     */
    public function scopePorNombre($query, string $nombre)
    {
        return $query->where('nombre', $nombre);
    }

    /**
     * Obtener tasa vigente por nombre
     */
    public static function obtenerPorNombre(string $nombre, $fecha = null)
    {
        return static::porNombre($nombre)->vigente($fecha)->first();
    }

    /**
     * Relación: Créditos que usan esta tasa
     */
    public function credits()
    {
        return $this->hasMany(Credit::class, 'tasa_id');
    }

    /**
     * Verificar si la tasa está vigente en una fecha
     */
    public function esVigente($fecha = null): bool
    {
        // Normalizar fecha a inicio del día (00:00:00) para comparaciones consistentes
        $fecha = $fecha ? Carbon::parse($fecha)->startOfDay() : Carbon::now()->startOfDay();

        if (!$this->activo) {
            return false;
        }

        // Comparar solo fechas (sin hora) usando formato string para evitar problemas de timezone
        $fechaStr = $fecha->format('Y-m-d');
        $inicioStr = $this->inicio->format('Y-m-d');
        $finStr = $this->fin ? $this->fin->format('Y-m-d') : null;

        $inicioValido = $inicioStr <= $fechaStr;
        $finValido = !$finStr || $finStr >= $fechaStr;

        return $inicioValido && $finValido;
    }
}
