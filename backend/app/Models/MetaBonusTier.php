<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MetaBonusTier extends Model
{
    protected $table = 'meta_bonus_tiers';

    protected $fillable = [
        'meta_venta_id',
        'creditos_minimos',
        'porcentaje',
        'puntos_reward',
        'descripcion',
    ];

    protected $casts = [
        'porcentaje'       => 'decimal:4',
        'creditos_minimos' => 'integer',
        'puntos_reward'    => 'integer',
    ];

    public function metaVenta(): BelongsTo
    {
        return $this->belongsTo(MetaVenta::class, 'meta_venta_id');
    }
}
