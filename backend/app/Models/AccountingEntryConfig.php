<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountingEntryConfig extends Model
{
    protected $fillable = [
        'entry_type',
        'name',
        'description',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    /**
     * Relación con las líneas de la configuración
     */
    public function lines(): HasMany
    {
        return $this->hasMany(AccountingEntryLine::class)->orderBy('line_order');
    }

    /**
     * Scope para obtener solo configuraciones activas
     */
    public function scopeActive($query)
    {
        return $query->where('active', true);
    }

    /**
     * Scope para obtener configuración por tipo
     */
    public function scopeByType($query, string $type)
    {
        return $query->where('entry_type', $type);
    }
}
