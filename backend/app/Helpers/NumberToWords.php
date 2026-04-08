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

    // ── English conversion ────────────────────────────────────────────────────

    private static array $onesEN = [
        '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
        'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
        'seventeen', 'eighteen', 'nineteen',
    ];

    private static array $tensEN = [
        '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
    ];

    private static function belowThousandEN(int $n): string
    {
        if ($n === 0)  return '';
        if ($n < 20)   return self::$onesEN[$n];
        if ($n < 100) {
            $t = intdiv($n, 10);
            $o = $n % 10;
            return $o === 0 ? self::$tensEN[$t] : self::$tensEN[$t] . '-' . self::$onesEN[$o];
        }
        $h    = intdiv($n, 100);
        $r    = $n % 100;
        $rStr = $r > 0 ? ' and ' . self::belowThousandEN($r) : '';
        return self::$onesEN[$h] . ' hundred' . $rStr;
    }

    public static function convertEN(float $amount, string $currency = 'dollars'): string
    {
        $entero  = (int) $amount;
        $decimal = (int) round(($amount - $entero) * 100);
        $partes  = [];

        $millions  = intdiv($entero, 1_000_000);
        $thousands = intdiv($entero % 1_000_000, 1000);
        $remainder = $entero % 1000;

        if ($millions  > 0) $partes[] = self::belowThousandEN($millions) . ' million';
        if ($thousands > 0) $partes[] = self::belowThousandEN($thousands) . ' thousand';
        if ($remainder > 0) $partes[] = self::belowThousandEN($remainder);

        $words = empty($partes) ? 'zero' : implode(', ', $partes);
        $cents = $decimal > 0 ? " and {$decimal}/100" : ' exactly';
        return ucfirst($words) . $cents . ' ' . $currency;
    }

    // ── Fecha en palabras ─────────────────────────────────────────────────────

    public static function dateToWordsES(string $date): string
    {
        $d = \DateTime::createFromFormat('Y-m-d', $date);
        if (!$d) return $date;
        $meses = ['enero','febrero','marzo','abril','mayo','junio',
                  'julio','agosto','septiembre','octubre','noviembre','diciembre'];
        return $d->format('j') . ' de ' . $meses[(int)$d->format('n') - 1] . ' del año ' . $d->format('Y');
    }

    public static function dateToWordsEN(string $date): string
    {
        $d = \DateTime::createFromFormat('Y-m-d', $date);
        if (!$d) return $date;
        $months = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];
        return $months[(int)$d->format('n') - 1] . ' ' . $d->format('j') . ', ' . $d->format('Y');
    }

    // ── Plazo en palabras ─────────────────────────────────────────────────────

    public static function plazoToWordsES(int $meses): string
    {
        if ($meses % 12 === 0) {
            $a = $meses / 12;
            return $a . ' ' . ($a === 1 ? 'año' : 'años') . ' (' . $meses . ' meses)';
        }
        return $meses . ' meses';
    }

    public static function plazoToWordsEN(int $meses): string
    {
        if ($meses % 12 === 0) {
            $a = $meses / 12;
            return $a . ' ' . ($a === 1 ? 'year' : 'years') . ' (' . $meses . ' months)';
        }
        return $meses . ' months';
    }

    // ── Forma de pago ─────────────────────────────────────────────────────────

    public static function formaPagoES(string $forma): string
    {
        return match(strtoupper($forma)) {
            'MENSUAL'    => 'mensual',
            'TRIMESTRAL' => 'trimestral',
            'SEMESTRAL'  => 'semestral',
            'ANUAL'      => 'anual',
            default      => strtolower($forma),
        };
    }

    public static function formaPagoEN(string $forma): string
    {
        return match(strtoupper($forma)) {
            'MENSUAL'    => 'monthly',
            'TRIMESTRAL' => 'quarterly',
            'SEMESTRAL'  => 'semi-annually',
            'ANUAL'      => 'annually',
            default      => strtolower($forma),
        };
    }
}
