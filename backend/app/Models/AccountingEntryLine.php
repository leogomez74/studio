<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountingEntryLine extends Model
{
    protected $fillable = [
        'accounting_entry_config_id',
        'line_order',
        'movement_type',
        'account_type',
        'account_key',
        'description',
        'amount_component',
        'cargo_adicional_key',
    ];

    /**
     * Relación con la configuración
     */
    public function config(): BelongsTo
    {
        return $this->belongsTo(AccountingEntryConfig::class, 'accounting_entry_config_id');
    }
}
