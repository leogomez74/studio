<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ErpAccountingAccount extends Model
{
    protected $fillable = [
        'key',
        'account_code',
        'account_name',
        'description',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    /**
     * Obtener el código de cuenta por su key interno
     */
    public static function getCode(string $key): ?string
    {
        $account = static::where('key', $key)->where('active', true)->first();
        return $account?->account_code ?: null;
    }

    /**
     * Obtener todas las cuentas activas como mapa key => code
     */
    public static function getActiveCodesMap(): array
    {
        return static::where('active', true)
            ->pluck('account_code', 'key')
            ->toArray();
    }
}
