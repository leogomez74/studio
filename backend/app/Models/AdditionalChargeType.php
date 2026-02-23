<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdditionalChargeType extends Model
{
    protected $fillable = [
        'key',
        'name',
        'description',
        'default_amount',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
        'default_amount' => 'decimal:2',
    ];

    /**
     * Scope para obtener solo tipos activos
     */
    public function scopeActive($query)
    {
        return $query->where('active', true);
    }

    /**
     * Scope para buscar por key
     */
    public function scopeByKey($query, string $key)
    {
        return $query->where('key', $key);
    }
}
