<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Opportunity extends Model
{
    use HasFactory;

    protected $table = 'opportunities';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'lead_cedula',
        'opportunity_type',
        'vertical',
        'amount',
        'status',
        'expected_close_date',
        'comments',
        'assigned_to_id'
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'expected_close_date' => 'date',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = static::generateId(
                    $model->empresa_code ?? 1,
                    $model->producto_code ?? 1
                );
            }
        });
    }

    /**
     * Generar ID con formato: YY-XXXXX-EPP-OP
     * YY = Año (2 dígitos)
     * XXXXX = Consecutivo (5 dígitos)
     * E = Empresa (1 dígito)
     * PP = Producto (2 dígitos)
     * OP = Proceso (Oportunidad)
     *
     * @param int $empresaCode Código de empresa (1-9)
     * @param int $productoCode Código de producto (1-99)
     * @return string
     */
    public static function generateId(int $empresaCode = 1, int $productoCode = 1): string
    {
        $year = date('y');
        $suffix = '-OP';

        // Buscar el último consecutivo del año actual
        $lastRecord = static::where('id', 'like', $year . '-%' . $suffix)
            ->orderByRaw("CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(id, '-', 2), '-', -1) AS UNSIGNED) DESC")
            ->first();

        $sequence = 1;
        if ($lastRecord) {
            // Extraer consecutivo: 26-00004-101-OP -> 00004
            $parts = explode('-', $lastRecord->id);
            if (count($parts) >= 2) {
                $sequence = intval($parts[1]) + 1;
            }
        }

        // Formato: YY-XXXXX-EPP-OP
        $empresaPart = (string) $empresaCode;
        $productoPart = str_pad((string) $productoCode, 2, '0', STR_PAD_LEFT);

        return sprintf(
            '%s-%s-%s%s%s',
            $year,
            str_pad((string) $sequence, 5, '0', STR_PAD_LEFT),
            $empresaPart,
            $productoPart,
            $suffix
        );
    }

    // Relación con Person (FK: lead_cedula -> persons.cedula)
    // Usa Person en lugar de Lead para incluir tanto Leads (type=1) como Clientes (type=2)
    public function lead()
    {
        return $this->belongsTo(Person::class, 'lead_cedula', 'cedula');
    }

    // Relación con User (Agente asignado)
    public function user()
    {
        return $this->belongsTo(User::class, 'assigned_to_id');
    }

    // Relación con Analisis
    public function analisis()
    {
        return $this->hasOne(Analisis::class, 'opportunity_id');
    }
}
