<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as XlDate;
use App\Models\Investment;
use App\Models\InvestmentCoupon;
use Carbon\Carbon;

class ImportarRebajos extends Command
{
    protected $signature   = 'importar:rebajos {archivo?} {--dry-run : Solo mostrar sin insertar}';
    protected $description = 'Importa cupones/rebajos desde cada hoja individual del Excel de inversiones';

    private Carbon $hoy;

    public function handle(): int
    {
        $this->hoy = Carbon::today();

        $archivo = $this->argument('archivo')
            ?? public_path('importaciones/INVERSIONES Y RESERVAS REVISADO.xlsx');

        if (! file_exists($archivo)) {
            $this->error("Archivo no encontrado: {$archivo}");
            return 1;
        }

        $dryRun = $this->option('dry-run');
        if ($dryRun) {
            $this->warn('--- MODO DRY-RUN (no se insertará nada) ---');
        }

        $this->info("Leyendo: {$archivo}");
        $spreadsheet = IOFactory::load($archivo);

        $totalCreados = 0;
        $totalOmitidos = 0;

        foreach ($spreadsheet->getAllSheets() as $sheet) {
            $nombre = $sheet->getTitle();

            // Extraer número de desembolso del nombre de la hoja: ej. "Jairo 16-C" → "16-C"
            if (! preg_match('/(\d+[-][CD])\s*$/i', $nombre, $m)) {
                $this->line("<fg=gray>Hoja '{$nombre}' omitida (sin ID de desembolso)</>");
                continue;
            }

            $numeroDesembolso = strtoupper($m[1]);

            $investment = Investment::where('numero_desembolso', $numeroDesembolso)->first();
            if (! $investment) {
                $this->warn("  [{$nombre}] Inversión '{$numeroDesembolso}' no encontrada en BD, omitida.");
                continue;
            }

            $this->info("\n[{$nombre}] → {$numeroDesembolso} (ID: {$investment->id})");

            $filas = $sheet->toArray(null, true, true, false);

            // Encontrar la fila cabecera con "Fecha" y la columna donde está
            $headerRow = null;
            $colFecha  = null;

            foreach ($filas as $idx => $fila) {
                foreach ($fila as $colIdx => $celda) {
                    if (strtolower(trim((string) $celda)) === 'fecha') {
                        $headerRow = $idx;
                        $colFecha  = $colIdx;
                        break 2;
                    }
                }
            }

            if ($headerRow === null) {
                $this->warn("  No se encontró cabecera 'Fecha', hoja omitida.");
                continue;
            }

            // Columnas relativas a colFecha:
            // colFecha+0 = Fecha
            // colFecha+1 = Interés Bruto
            // colFecha+2 = Retención
            // colFecha+3 = Interés Neto (Pago de interés)
            $colInteres   = $colFecha + 1;
            $colRetencion = $colFecha + 2;
            $colNeto      = $colFecha + 3;

            $creados   = 0;
            $omitidos  = 0;

            for ($i = $headerRow + 1; $i < count($filas); $i++) {
                $fila  = $filas[$i];
                $fecha = $this->parsearFecha($fila[$colFecha] ?? null);

                if (! $fecha) {
                    continue; // fila vacía o "TOTALES"
                }

                $interesBruto = $this->parsearNumero($fila[$colInteres]   ?? 0);
                $retencion    = $this->parsearNumero($fila[$colRetencion] ?? 0);
                $interesNeto  = $this->parsearNumero($fila[$colNeto]      ?? 0);

                // Si el neto no vino en col+3, calcularlo
                if ($interesNeto == 0 && $interesBruto > 0) {
                    $interesNeto = round($interesBruto - $retencion, 2);
                }

                $esPagado = $fecha->lte($this->hoy);
                $estado   = $esPagado ? 'Pagado' : 'Pendiente';

                // Evitar duplicados
                $existe = InvestmentCoupon::where('investment_id', $investment->id)
                    ->where('fecha_cupon', $fecha->toDateString())
                    ->exists();

                if ($existe) {
                    $omitidos++;
                    continue;
                }

                if (! $dryRun) {
                    InvestmentCoupon::create([
                        'investment_id'    => $investment->id,
                        'fecha_cupon'      => $fecha->toDateString(),
                        'interes_bruto'    => $interesBruto,
                        'retencion'        => $retencion,
                        'interes_neto'     => $interesNeto,
                        'monto_pagado_real' => $esPagado ? $interesNeto : null,
                        'monto_reservado'  => 0,
                        'capital_acumulado' => 0,
                        'estado'           => $estado,
                        'fecha_pago'       => $esPagado ? $fecha->toDateString() : null,
                    ]);
                }

                $this->line(sprintf(
                    '  %s %s | bruto: %s | ret: %s | neto: %s',
                    $esPagado ? '✓' : '○',
                    $fecha->format('M-Y'),
                    number_format($interesBruto, 2),
                    number_format($retencion, 2),
                    number_format($interesNeto, 2)
                ));

                $creados++;
            }

            $totalCreados  += $creados;
            $totalOmitidos += $omitidos;

            $this->info("  → {$creados} cupones insertados" . ($omitidos ? ", {$omitidos} ya existían" : ''));
        }

        $this->newLine();
        $this->info("Total cupones creados:  {$totalCreados}");
        if ($totalOmitidos) {
            $this->line("Total ya existían:     {$totalOmitidos}");
        }

        return 0;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function parsearFecha(mixed $valor): ?Carbon
    {
        if ($valor === null || $valor === '') {
            return null;
        }

        // Serial numérico de Excel
        if (is_numeric($valor)) {
            try {
                return Carbon::instance(XlDate::excelToDateTimeObject((float) $valor));
            } catch (\Throwable) {}
        }

        $str = trim((string) $valor);

        // Detectar "TOTALES" u otros textos no-fecha
        if (preg_match('/[a-z]{4,}/i', $str) && ! preg_match('/^[a-z]{3}[-\s]/i', $str)) {
            return null;
        }

        // Formatos comunes del Excel: "Feb-22", "Jan-24", "19-Feb-19"
        $formatos = ['M-y', 'M-Y', 'd-M-y', 'd-M-Y', 'Y-m-d', 'd/m/Y'];
        foreach ($formatos as $fmt) {
            try {
                $dt = Carbon::createFromFormat($fmt, $str);
                if ($dt && $dt->year > 2000) {
                    return $dt->startOfMonth();
                }
            } catch (\Throwable) {}
        }

        try {
            $dt = Carbon::parse($str);
            if ($dt->year > 2000) {
                return $dt;
            }
        } catch (\Throwable) {}

        return null;
    }

    private function parsearNumero(mixed $valor): float
    {
        if (is_numeric($valor)) {
            return abs((float) $valor);
        }
        // Limpiar símbolos: ₡, $, comas, espacios
        $limpio = preg_replace('/[^\d.\-]/', '', str_replace(',', '', (string) $valor));
        return abs((float) $limpio);
    }
}
