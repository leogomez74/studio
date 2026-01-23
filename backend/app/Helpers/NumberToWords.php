<?php

namespace App\Helpers;

class NumberToWords
{
    private static array $unidades = [
        '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
        'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE',
        'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUN', 'VEINTIDOS', 'VEINTITRES',
        'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'
    ];

    private static array $decenas = [
        '', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'
    ];

    private static array $centenas = [
        '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
        'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'
    ];

    /**
     * Convierte un número a su representación en palabras en español
     */
    public static function convert(float $numero, string $moneda = 'COLONES'): string
    {
        if ($numero < 0) {
            return 'MENOS ' . self::convert(abs($numero), $moneda);
        }

        if ($numero == 0) {
            return 'CERO ' . $moneda . ' EXACTOS';
        }

        $entero = (int) floor($numero);
        $decimales = round(($numero - $entero) * 100);

        $resultado = self::convertirEntero($entero);

        if ($decimales > 0) {
            $resultado .= ' ' . $moneda . ' CON ' . self::convertirEntero((int) $decimales) . ' CENTIMOS';
        } else {
            $resultado .= ' ' . $moneda . ' EXACTOS';
        }

        return $resultado;
    }

    private static function convertirEntero(int $numero): string
    {
        if ($numero == 0) {
            return 'CERO';
        }

        if ($numero == 100) {
            return 'CIEN';
        }

        if ($numero < 30) {
            return self::$unidades[$numero];
        }

        if ($numero < 100) {
            $decena = (int) floor($numero / 10);
            $unidad = $numero % 10;
            if ($unidad == 0) {
                return self::$decenas[$decena];
            }
            return self::$decenas[$decena] . ' Y ' . self::$unidades[$unidad];
        }

        if ($numero < 1000) {
            $centena = (int) floor($numero / 100);
            $resto = $numero % 100;
            if ($resto == 0) {
                return $numero == 100 ? 'CIEN' : self::$centenas[$centena];
            }
            return self::$centenas[$centena] . ' ' . self::convertirEntero($resto);
        }

        if ($numero < 1000000) {
            $miles = (int) floor($numero / 1000);
            $resto = $numero % 1000;

            $resultado = '';
            if ($miles == 1) {
                $resultado = 'MIL';
            } else {
                $resultado = self::convertirEntero($miles) . ' MIL';
            }

            if ($resto > 0) {
                $resultado .= ' ' . self::convertirEntero($resto);
            }

            return $resultado;
        }

        if ($numero < 1000000000000) {
            $millones = (int) floor($numero / 1000000);
            $resto = $numero % 1000000;

            $resultado = '';
            if ($millones == 1) {
                $resultado = 'UN MILLON';
            } else {
                $resultado = self::convertirEntero($millones) . ' MILLONES';
            }

            if ($resto > 0) {
                $resultado .= ' ' . self::convertirEntero($resto);
            }

            return $resultado;
        }

        return 'NUMERO MUY GRANDE';
    }
}
