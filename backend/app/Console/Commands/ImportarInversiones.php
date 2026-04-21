<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use PhpOffice\PhpSpreadsheet\IOFactory;
use App\Models\Investment;
use Carbon\Carbon;

class ImportarInversiones extends Command
{
    protected $signature   = 'importar:inversiones {archivo?}';
    protected $description = 'Importa inversiones desde Excel (TABLA GENERAL con secciones DOLARES y COLONES)';

    public function handle(): int
    {
        $archivo = $this->argument('archivo')
            ?? public_path('importaciones/INVERSIONES Y RESERVAS REVISADO.xlsx');

        if (! file_exists($archivo)) {
            $this->error("Archivo no encontrado: {$archivo}");
            return 1;
        }

        $this->info("Leyendo: {$archivo}");

        $spreadsheet = IOFactory::load($archivo);

        $sheet = null;
        foreach ($spreadsheet->getAllSheets() as $s) {
            if (stripos($s->getTitle(), 'TABLA GENERAL') !== false) {
                $sheet = $s;
                break;
            }
        }
        $sheet ??= $spreadsheet->getActiveSheet();

        $this->info("Hoja: {$sheet->getTitle()}");

        $filas = $sheet->toArray(null, true, true, false);

        // Detectar secciones buscando filas cuya col A diga DOLARES / COLONES
        $secciones = [];  // [ ['moneda'=>'USD','inicio'=>5,'fin'=>6], ... ]
        $monedaActual = null;
        $inicioActual = null;

        foreach ($filas as $idx => $fila) {
            $colA = strtoupper(trim((string) ($fila[0] ?? '')));

            if (str_contains($colA, 'DOLAR')) {
                $monedaActual = 'USD';
                $inicioActual = null;
                continue;
            }

            if (str_contains($colA, 'COLON')) {
                $monedaActual = 'CRC';
                $inicioActual = null;
                continue;
            }

            if ($monedaActual !== null) {
                // Fila de datos: col A con patrón de número de desembolso
                if ($this->esNumeroDesembolso($fila[0] ?? '')) {
                    if ($inicioActual === null) {
                        $inicioActual = $idx;
                    }
                }

                // Fin de sección: "Totales" o fila vacía después de haber iniciado datos
                if ($inicioActual !== null && str_contains($colA, 'TOTAL')) {
                    $secciones[] = [
                        'moneda' => $monedaActual,
                        'inicio' => $inicioActual,
                        'fin'    => $idx - 1,
                    ];
                    $monedaActual = null;
                    $inicioActual = null;
                }
            }
        }

        if (empty($secciones)) {
            $this->error('No se encontraron secciones DOLARES/COLONES con datos.');
            return 1;
        }

        $creadas = 0;
        $errores = 0;

        foreach ($secciones as $seccion) {
            $this->info("Sección {$seccion['moneda']}: filas {$seccion['inicio']}–{$seccion['fin']}");
            [$c, $e] = $this->importarFilas($filas, $seccion['inicio'], $seccion['fin'], $seccion['moneda']);
            $creadas += $c;
            $errores += $e;
        }

        $this->newLine();
        $this->info("Inversiones creadas: {$creadas}");
        if ($errores > 0) {
            $this->warn("Filas con error:    {$errores}");
        }

        return 0;
    }

    // ─── Importar filas de una sección ───────────────────────────────────────

    private function importarFilas(array $filas, int $inicio, int $fin, string $moneda): array
    {
        $creadas = 0;
        $errores = 0;

        for ($i = $inicio; $i <= $fin; $i++) {
            $fila = $filas[$i];

            $numeroDesembolso = trim((string) ($fila[0] ?? ''));
            if (! $this->esNumeroDesembolso($numeroDesembolso)) {
                continue;
            }

            // Normalizar número: "20-c" → "20-C"
            $numeroDesembolso = strtoupper($numeroDesembolso);

            try {
                $monto            = $this->parsearNumero($fila[2] ?? 0);
                $plazoMeses       = (int) ($fila[3] ?? 0);
                $fechaInicio      = $this->parsearFecha($fila[4] ?? null);
                $fechaVencimiento = $this->parsearFecha($fila[5] ?? null);
                $tasaAnual        = $this->parsearTasa($fila[6] ?? 0);

                // FORMA DE PAGO: en DOLARES es col 11 (L), en COLONES también col 11
                $formaPago = $this->normalizarFormaPago($fila[11] ?? ($fila[10] ?? ''));

                if (! $monto || ! $plazoMeses || ! $fechaInicio || ! $fechaVencimiento) {
                    $this->warn("  Fila {$i} ({$numeroDesembolso}): datos incompletos, omitida.");
                    $errores++;
                    continue;
                }

                if (Investment::where('numero_desembolso', $numeroDesembolso)->exists()) {
                    $this->line("  Ya existe {$numeroDesembolso}, omitida.");
                    continue;
                }

                Investment::create([
                    'numero_desembolso' => $numeroDesembolso,
                    'investor_id'       => null,
                    'monto_capital'     => $monto,
                    'plazo_meses'       => $plazoMeses,
                    'fecha_inicio'      => $fechaInicio,
                    'fecha_vencimiento' => $fechaVencimiento,
                    'tasa_anual'        => $tasaAnual,
                    'tasa_retencion'    => 0.15,
                    'moneda'            => $moneda,
                    'forma_pago'        => $formaPago,
                    'es_capitalizable'  => false,
                    'estado'            => 'Activa',
                ]);

                $this->line("  ✓ {$numeroDesembolso} | {$moneda} | " . number_format($monto, 2) . " | {$formaPago}");
                $creadas++;

            } catch (\Throwable $e) {
                $this->error("  Fila {$i} ({$numeroDesembolso}): {$e->getMessage()}");
                $errores++;
            }
        }

        return [$creadas, $errores];
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function esNumeroDesembolso(mixed $valor): bool
    {
        return (bool) preg_match('/^\d+[-]\w$/i', trim((string) $valor));
    }

    private function parsearNumero(mixed $valor): float
    {
        if (is_numeric($valor)) {
            return (float) $valor;
        }
        $limpio = str_replace([',', ' '], ['', ''], (string) $valor);
        return (float) $limpio;
    }

    private function parsearFecha(mixed $valor): ?Carbon
    {
        if ($valor === null || $valor === '') {
            return null;
        }

        if (is_numeric($valor)) {
            try {
                return Carbon::instance(
                    \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $valor)
                );
            } catch (\Throwable) {}
        }

        $formatos = ['d-M-y', 'd-M-Y', 'Y-m-d', 'd/m/Y', 'm/d/Y', 'd-m-Y'];
        foreach ($formatos as $fmt) {
            try {
                return Carbon::createFromFormat($fmt, trim((string) $valor));
            } catch (\Throwable) {}
        }

        try {
            return Carbon::parse((string) $valor);
        } catch (\Throwable) {}

        return null;
    }

    private function parsearTasa(mixed $valor): float
    {
        $n = (float) str_replace(['%', ','], ['', '.'], (string) $valor);
        return $n > 1 ? round($n / 100, 6) : round($n, 6);
    }

    private function normalizarFormaPago(mixed $valor): string
    {
        $upper = strtoupper(trim((string) $valor));
        foreach (['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'RESERVA'] as $opcion) {
            if (str_contains($upper, $opcion)) {
                return $opcion;
            }
        }
        return 'MENSUAL';
    }
}
