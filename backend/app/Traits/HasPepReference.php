<?php

declare(strict_types=1);

namespace App\Traits;

trait HasPepReference
{
    /**
     * Tipos de producto PEP
     */
    public static array $tiposProducto = [
        '01' => 'Micro crédito',
        '02' => 'Crédito',
        '03' => 'Divorcio',
        '04' => 'Testamento',
        '05' => 'Notariado',
        '06' => 'Descuento de factura',
    ];

    /**
     * Genera la referencia PEP en formato: AÑO-CONSECUTIVO-TIPO-PEP
     * Ejemplo: 26-000001-01-PEP
     */
    public static function generatePepReference(string $tipoCode): string
    {
        $year = date('y');
        $suffix = '-PEP';

        // Buscar el último consecutivo para este tipo en este año
        $pattern = $year . '%-' . $tipoCode . $suffix;

        $lastRecord = static::where(static::getReferenceColumn(), 'like', $pattern)
            ->orderByRaw('CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(' . static::getReferenceColumn() . ', "-", 2), "-", -1) AS UNSIGNED) DESC')
            ->first();

        $sequence = 1;
        if ($lastRecord) {
            $reference = $lastRecord->{static::getReferenceColumn()};
            // Extraer consecutivo: 26-000001-01-PEP -> 000001
            $parts = explode('-', $reference);
            if (count($parts) >= 2) {
                $sequence = intval($parts[1]) + 1;
            }
        }

        return $year . '-' . str_pad((string)$sequence, 6, '0', STR_PAD_LEFT) . '-' . $tipoCode . $suffix;
    }

    /**
     * Obtiene el nombre del tipo de producto por código
     */
    public static function getTipoNombre(string $codigo): string
    {
        return static::$tiposProducto[$codigo] ?? 'Desconocido';
    }

    /**
     * Extrae el código de tipo de una referencia
     */
    public static function extractTipoFromReference(string $reference): ?string
    {
        $parts = explode('-', $reference);
        if (count($parts) >= 3) {
            return $parts[2];
        }
        return null;
    }

    /**
     * Nombre de la columna que contiene la referencia
     * Puede ser sobrescrito en el modelo
     */
    protected static function getReferenceColumn(): string
    {
        return 'reference';
    }
}
