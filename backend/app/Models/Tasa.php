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
        $fecha = $fecha ? Carbon::parse($fecha) : Carbon::now();

        return $query->where('activo', true)
            ->where('inicio', '<=', $fecha)
            ->where(function ($q) use ($fecha) {
                $q->whereNull('fin')
                  ->orWhere('fin', '>=', $fecha);
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
        $fecha = $fecha ? Carbon::parse($fecha) : Carbon::now();

        if (!$this->activo) {
            return false;
        }

        $inicioValido = $this->inicio <= $fecha;
        $finValido = !$this->fin || $this->fin >= $fecha;

        return $inicioValido && $finValido;
    }
}
