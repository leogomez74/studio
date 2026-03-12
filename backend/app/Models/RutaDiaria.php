<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RutaDiaria extends Model
{
    protected $table = 'rutas_diarias';

    protected $fillable = [
        'fecha',
        'mensajero_id',
        'status',
        'total_tareas',
        'completadas',
        'notas',
        'confirmada_por',
        'confirmada_at',
    ];

    protected $casts = [
        'fecha' => 'date',
        'confirmada_at' => 'datetime',
    ];

    public function mensajero(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mensajero_id');
    }

    public function confirmadaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmada_por');
    }

    public function tareas(): HasMany
    {
        return $this->hasMany(TareaRuta::class)->orderBy('posicion');
    }

    /**
     * Recalcular contadores y auto-completar ruta si todas las tareas están resueltas.
     */
    public function recalcularConteo(): void
    {
        $this->total_tareas = $this->tareas()->count();
        $this->completadas = $this->tareas()->where('status', 'completada')->count();
        $this->save();

        // Auto-completar ruta si todas las tareas están completadas o fallidas (ninguna en tránsito/asignada)
        if ($this->status === 'en_progreso' && $this->total_tareas > 0) {
            $pendientes = $this->tareas()->whereIn('status', ['asignada', 'en_transito'])->count();
            if ($pendientes === 0) {
                $this->update(['status' => 'completada']);
            }
        }
    }

    public function scopeDelMensajero($query, int $userId)
    {
        return $query->where('mensajero_id', $userId);
    }

    public function scopeActivas($query)
    {
        return $query->whereIn('status', ['confirmada', 'en_progreso']);
    }
}
