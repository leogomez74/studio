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
        'validated_at',
    ];

    protected $casts = [
        'active' => 'boolean',
        'validated_at' => 'datetime',
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

    /**
     * Marcar cuenta como validada (usada exitosamente en un asiento)
     */
    public function markValidated(): void
    {
        $this->update(['validated_at' => now()]);
    }

    /**
     * Marcar múltiples cuentas como validadas por sus account_codes
     */
    public static function markCodesValidated(array $accountCodes): void
    {
        static::whereIn('account_code', $accountCodes)
            ->where('active', true)
            ->update(['validated_at' => now()]);
    }

    /**
     * Scope: cuentas activas que nunca han sido validadas
     */
    public function scopeNeverValidated($query)
    {
        return $query->where('active', true)->whereNull('validated_at');
    }
}
