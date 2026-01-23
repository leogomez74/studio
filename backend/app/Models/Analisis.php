<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Analisis extends Model
{
    use HasFactory;

    protected $table = 'analisis';
    protected $fillable = [
        'reference',
        'title',
        'status',
        'category',
        'monto_credito',
        'lead_id',
        'opportunity_id',
        'assigned_to',
        'opened_at',
        'description',
        'divisa',
        'plazo',
        'ingreso_bruto',
        'ingreso_neto',
        'propuesta',
    ];

    protected $casts = [
        'opened_at' => 'date',
        'monto_credito' => 'decimal:2',
        'ingreso_bruto' => 'decimal:2',
        'ingreso_neto' => 'decimal:2',
        'plazo' => 'integer',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            if (empty($model->reference)) {
                $model->reference = static::generateReference(
                    $model->empresa_code ?? 1,
                    $model->producto_code ?? 1
                );
            }
        });
    }

    /**
     * Generar referencia con formato: YY-XXXXX-EPP-AN
     * YY = Año (2 dígitos)
     * XXXXX = Consecutivo (5 dígitos)
     * E = Empresa (1 dígito)
     * PP = Producto (2 dígitos)
     * AN = Proceso (Análisis)
     *
     * @param int $empresaCode Código de empresa (1-9)
     * @param int $productoCode Código de producto (1-99)
     * @return string
     */
    public static function generateReference(int $empresaCode = 1, int $productoCode = 1): string
    {
        $year = date('y');
        $suffix = '-AN';

        // Buscar el último consecutivo del año actual
        $lastRecord = static::where('reference', 'like', $year . '-%' . $suffix)
            ->orderByRaw("CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(reference, '-', 2), '-', -1) AS UNSIGNED) DESC")
            ->first();

        $sequence = 1;
        if ($lastRecord) {
            // Extraer consecutivo: 26-00004-101-AN -> 00004
            $parts = explode('-', $lastRecord->reference);
            if (count($parts) >= 2) {
                $sequence = intval($parts[1]) + 1;
            }
        }

        // Formato: YY-XXXXX-EPP-AN
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

    // Relationships
    public function lead()
    {
        return $this->belongsTo(Lead::class);
    }

    public function opportunity()
    {
        return $this->belongsTo(Opportunity::class);
    }
}
