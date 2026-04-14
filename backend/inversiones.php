<?php

/**
 * inversiones.php
 *
 * Script para poblar inversiones desde el Excel:
 *   1. Crea los 6 inversionistas
 *   2. Importa las 28 inversiones (hoja TABLA GENERAL)
 *   3. Importa los cupones/rebajos (hojas individuales)
 *
 * USO: php inversiones.php
 * USO (sin confirmación): php inversiones.php --yes
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\Investor;
use App\Models\Investment;
use App\Models\InvestmentCoupon;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as XlDate;
use Carbon\Carbon;

$autoConfirm = in_array('--yes', $argv ?? []);

echo "\n";
echo "╔══════════════════════════════════════════════════════╗\n";
echo "║         IMPORTACIÓN DE INVERSIONES - CREDIPEP        ║\n";
echo "╚══════════════════════════════════════════════════════╝\n\n";
echo "Este script realizará las siguientes acciones:\n";
echo "  1. Crear 6 inversionistas\n";
echo "  2. Importar 28 inversiones desde Excel (TABLA GENERAL)\n";
echo "  3. Importar cupones/rebajos desde cada hoja individual\n\n";

if (!$autoConfirm) {
    echo "¿Deseas continuar? (s/n): ";
    $handle = fopen('php://stdin', 'r');
    $line = trim(fgets($handle));
    fclose($handle);
    if (strtolower($line) !== 's') {
        echo "Operación cancelada.\n\n";
        exit(0);
    }
}

$excel = __DIR__ . '/public/importaciones/INVERSIONES Y RESERVAS REVISADO.xlsx';

if (!file_exists($excel)) {
    echo "\n[ERROR] Archivo no encontrado: {$excel}\n\n";
    exit(1);
}

$hoy = Carbon::today();

// ─────────────────────────────────────────────────────────────────────────────
// PASO 1 — Inversionistas
// ─────────────────────────────────────────────────────────────────────────────
echo "\n── PASO 1: Inversionistas ───────────────────────────────\n";

$investorsData = [
    ['name' => 'Jairo',                           'tipo_persona' => 'fisica',   'status' => 'Activo'],
    ['name' => 'Alysa Gottlieb',                  'tipo_persona' => 'fisica',   'status' => 'Activo'],
    ['name' => 'Leonardo Gómez',                  'tipo_persona' => 'fisica',   'status' => 'Activo'],
    ['name' => 'Fundacion Derecho sin Fronteras', 'tipo_persona' => 'juridica', 'status' => 'Activo'],
    ['name' => 'Janis, Christopher James',        'tipo_persona' => 'fisica',   'status' => 'Activo'],
    ['name' => 'Frank Brown',                     'tipo_persona' => 'fisica',   'status' => 'Activo'],
];

$investorMap = []; // name => id

foreach ($investorsData as $data) {
    $inv = Investor::firstOrCreate(['name' => $data['name']], $data);
    $investorMap[$inv->name] = $inv->id;
    echo "  ✓ {$inv->name} (ID: {$inv->id})\n";
}

// ─────────────────────────────────────────────────────────────────────────────
// PASO 2 — Inversiones desde TABLA GENERAL
// ─────────────────────────────────────────────────────────────────────────────
echo "\n── PASO 2: Inversiones (TABLA GENERAL) ─────────────────\n";

$spreadsheet = IOFactory::load($excel);

$sheet = null;
foreach ($spreadsheet->getAllSheets() as $s) {
    if (stripos($s->getTitle(), 'TABLA GENERAL') !== false) { $sheet = $s; break; }
}
$sheet ??= $spreadsheet->getActiveSheet();

$filas = $sheet->toArray(null, true, true, false);

// Mapa de nombre en Excel → investor_id
$nameToInvestorId = [
    'Jairo'                           => $investorMap['Jairo'],
    'Jairo ( Joshua)'                 => $investorMap['Jairo'],
    'Jairo (Reychel y Rasea)'         => $investorMap['Jairo'],
    'Alysa Gottlieb'                  => $investorMap['Alysa Gottlieb'],
    'Leonardo Gómez'                  => $investorMap['Leonardo Gómez'],
    'Gomez Salazar, Leonardo'         => $investorMap['Leonardo Gómez'],
    'Gomez Salazar, Leonardo (David)' => $investorMap['Leonardo Gómez'],
    'Fundacion Derecho sin Fronteras' => $investorMap['Fundacion Derecho sin Fronteras'],
    'Janis, Chritopher James'         => $investorMap['Janis, Christopher James'],
    'Frank Brown'                     => $investorMap['Frank Brown'],
];

// Detectar secciones
$secciones = [];
$monedaActual = null;
$inicioActual = null;

foreach ($filas as $idx => $fila) {
    $colA = strtoupper(trim((string)($fila[0] ?? '')));

    if (str_contains($colA, 'DOLAR'))  { $monedaActual = 'USD'; $inicioActual = null; continue; }
    if (str_contains($colA, 'COLON'))  { $monedaActual = 'CRC'; $inicioActual = null; continue; }

    if ($monedaActual !== null) {
        if (esNumeroDesembolso($fila[0] ?? '') && $inicioActual === null) {
            $inicioActual = $idx;
        }
        if ($inicioActual !== null && str_contains($colA, 'TOTAL')) {
            $secciones[] = ['moneda' => $monedaActual, 'inicio' => $inicioActual, 'fin' => $idx - 1];
            $monedaActual = null; $inicioActual = null;
        }
    }
}

$invCreadas = 0;
$invOmitidas = 0;

foreach ($secciones as $sec) {
    echo "  Sección {$sec['moneda']}: filas {$sec['inicio']}–{$sec['fin']}\n";

    for ($i = $sec['inicio']; $i <= $sec['fin']; $i++) {
        $fila = $filas[$i];
        $num  = strtoupper(trim((string)($fila[0] ?? '')));
        if (!esNumeroDesembolso($num)) continue;

        if (Investment::where('numero_desembolso', $num)->exists()) {
            echo "    Ya existe {$num}, omitida.\n";
            $invOmitidas++;
            continue;
        }

        $nombreInv  = trim((string)($fila[1] ?? ''));
        $investorId = resolverInvestorId($nombreInv, $nameToInvestorId);

        $monto    = parsearNumero($fila[2] ?? 0);
        $plazo    = (int)($fila[3] ?? 0);
        $fInicio  = parsearFecha($fila[4] ?? null);
        $fVence   = parsearFecha($fila[5] ?? null);
        $tasa     = parsearTasa($fila[6] ?? 0);
        $forma    = normalizarFormaPago($fila[11] ?? ($fila[10] ?? ''));

        if (!$monto || !$plazo || !$fInicio || !$fVence) {
            echo "    [SKIP] {$num}: datos incompletos.\n";
            continue;
        }

        Investment::create([
            'numero_desembolso' => $num,
            'investor_id'       => $investorId,
            'monto_capital'     => $monto,
            'plazo_meses'       => $plazo,
            'fecha_inicio'      => $fInicio,
            'fecha_vencimiento' => $fVence,
            'tasa_anual'        => $tasa,
            'tasa_retencion'    => 0.15,
            'moneda'            => $sec['moneda'],
            'forma_pago'        => $forma,
            'es_capitalizable'  => false,
            'estado'            => 'Activa',
        ]);

        echo "    ✓ {$num} | {$sec['moneda']} | " . number_format($monto, 2) . " | {$forma}\n";
        $invCreadas++;
    }
}

echo "\n  Inversiones creadas: {$invCreadas} | Omitidas: {$invOmitidas}\n";

// ─────────────────────────────────────────────────────────────────────────────
// PASO 3 — Cupones / Rebajos por hoja individual
// ─────────────────────────────────────────────────────────────────────────────
echo "\n── PASO 3: Cupones / Rebajos ────────────────────────────\n";

$totalCupones = 0;
$totalOmitidos = 0;

foreach ($spreadsheet->getAllSheets() as $s) {
    $nombre = $s->getTitle();

    if (!preg_match('/(\d+[-][CD])\s*$/i', $nombre, $m)) continue;

    $numDesembolso = strtoupper($m[1]);
    $investment    = Investment::where('numero_desembolso', $numDesembolso)->first();

    if (!$investment) {
        echo "  [{$nombre}] Inversión '{$numDesembolso}' no encontrada, omitida.\n";
        continue;
    }

    $rows = $s->toArray(null, true, true, false);

    // Encontrar fila cabecera con "Fecha"
    $headerRow = null;
    $colFecha  = null;
    foreach ($rows as $idx => $fila) {
        foreach ($fila as $colIdx => $celda) {
            if (strtolower(trim((string)$celda)) === 'fecha') {
                $headerRow = $idx; $colFecha = $colIdx; break 2;
            }
        }
    }

    if ($headerRow === null) {
        echo "  [{$nombre}] Sin cabecera 'Fecha', omitida.\n";
        continue;
    }

    $creados  = 0;
    $omitidos = 0;

    for ($i = $headerRow + 1; $i < count($rows); $i++) {
        $fila  = $rows[$i];
        $fecha = parsearFecha($fila[$colFecha] ?? null);
        if (!$fecha) continue;

        $bruto = parsearNumero($fila[$colFecha + 1] ?? 0);
        $ret   = parsearNumero($fila[$colFecha + 2] ?? 0);
        $neto  = parsearNumero($fila[$colFecha + 3] ?? 0);
        if ($neto == 0 && $bruto > 0) $neto = round($bruto - $ret, 2);

        $existe = InvestmentCoupon::where('investment_id', $investment->id)
            ->where('fecha_cupon', $fecha->toDateString())
            ->exists();

        if ($existe) { $omitidos++; continue; }

        $esPagado = $fecha->lte($hoy);

        InvestmentCoupon::create([
            'investment_id'     => $investment->id,
            'fecha_cupon'       => $fecha->toDateString(),
            'interes_bruto'     => $bruto,
            'retencion'         => $ret,
            'interes_neto'      => $neto,
            'monto_pagado_real' => $esPagado ? $neto : null,
            'monto_reservado'   => 0,
            'capital_acumulado' => 0,
            'estado'            => $esPagado ? 'Pagado' : 'Pendiente',
            'fecha_pago'        => $esPagado ? $fecha->toDateString() : null,
        ]);

        $creados++;
    }

    $totalCupones  += $creados;
    $totalOmitidos += $omitidos;
    echo "  ✓ [{$nombre}] → {$creados} cupones" . ($omitidos ? ", {$omitidos} ya existían" : '') . "\n";
}

echo "\n  Cupones creados: {$totalCupones} | Ya existían: {$totalOmitidos}\n";

// ─────────────────────────────────────────────────────────────────────────────
echo "\n╔══════════════════════════════════════════════════════╗\n";
echo "║                  IMPORTACIÓN COMPLETA               ║\n";
echo "╚══════════════════════════════════════════════════════╝\n\n";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function esNumeroDesembolso(mixed $v): bool {
    return (bool) preg_match('/^\d+[-]\w$/i', trim((string)$v));
}

function parsearNumero(mixed $v): float {
    if (is_numeric($v)) return abs((float)$v);
    return abs((float) preg_replace('/[^\d.\-]/', '', str_replace(',', '', (string)$v)));
}

function parsearFecha(mixed $v): ?Carbon {
    if ($v === null || $v === '') return null;
    if (is_numeric($v)) {
        try { return Carbon::instance(XlDate::excelToDateTimeObject((float)$v)); } catch (\Throwable) {}
    }
    $s = trim((string)$v);
    if (preg_match('/[a-z]{4,}/i', $s) && !preg_match('/^[a-z]{3}[-\s]/i', $s)) return null;
    foreach (['M-y','M-Y','d-M-y','d-M-Y','Y-m-d','d/m/Y'] as $fmt) {
        try {
            $dt = Carbon::createFromFormat($fmt, $s);
            if ($dt && $dt->year > 2000) return $dt->startOfMonth();
        } catch (\Throwable) {}
    }
    try { $dt = Carbon::parse($s); if ($dt->year > 2000) return $dt; } catch (\Throwable) {}
    return null;
}

function parsearTasa(mixed $v): float {
    $n = (float) str_replace(['%',',',' '], ['','','.'], (string)$v);
    return $n > 1 ? round($n / 100, 6) : round($n, 6);
}

function normalizarFormaPago(mixed $v): string {
    $u = strtoupper(trim((string)$v));
    foreach (['MENSUAL','TRIMESTRAL','SEMESTRAL','ANUAL','RESERVA'] as $o) {
        if (str_contains($u, $o)) return $o;
    }
    return 'MENSUAL';
}

function resolverInvestorId(string $nombre, array $map): ?int {
    if (isset($map[$nombre])) return $map[$nombre];
    // Búsqueda parcial
    foreach ($map as $key => $id) {
        if (stripos($nombre, explode(' ', $key)[0]) !== false) return $id;
    }
    return null;
}
