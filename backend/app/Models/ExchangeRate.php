<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExchangeRate extends Model
{
    protected $fillable = ['fecha', 'compra', 'venta', 'fuente'];

    protected $casts = [
        'fecha' => 'date',
        'compra' => 'decimal:4',
        'venta' => 'decimal:4',
    ];

    public static function latest(): ?self
    {
        return static::query()->orderByDesc('fecha')->first();
    }

    public static function forDate(string $date): ?self
    {
        return static::where('fecha', $date)->first();
    }

    public static function ventaActual(): float
    {
        return (float) (static::latest()?->venta ?? config('services.inversiones.tipo_cambio_usd', 500));
    }
}
