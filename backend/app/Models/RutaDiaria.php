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

    public function recalcularConteo(): void
    {
        $this->total_tareas = $this->tareas()->count();
        $this->completadas = $this->tareas()->where('status', 'completada')->count();
        $this->save();
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
