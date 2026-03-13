<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlanillaReport extends Model
{
    protected $fillable = [
        'deductora_id',
        'periodo',
        'tipo',
        'nombre_archivo',
        'ruta_archivo',
        'user_id',
    ];

    public function deductora()
    {
        return $this->belongsTo(Deductora::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public static function yaGenerado(int $deductoraId, string $periodo, string $tipo): bool
    {
        return self::where('deductora_id', $deductoraId)
            ->where('periodo', $periodo)
            ->where('tipo', $tipo)
            ->exists();
    }
}
