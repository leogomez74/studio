<?php

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Credit;
use App\Models\Deductora;
use App\Models\PlanDePago;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

echo "═══════════════════════════════════════════════════════════════════\n";
echo "SIMULACIÓN DE 12 MESES - PLANILLA COPE NACIONAL\n";
echo "═══════════════════════════════════════════════════════════════════\n\n";

// Obtener COOPENACIONAL
$deductora = Deductora::where('nombre', 'LIKE', '%COOPE%')->first();

if (!$deductora) {
    echo "❌ Error: No se encontró la deductora COOPENACIONAL\n";
    exit(1);
}

echo "Deductora: {$deductora->nombre}\n\n";

// Obtener todos los créditos de COPE
$creditos = Credit::where('deductora_id', $deductora->id)
    ->where('status', 'Formalizado')
    ->with('lead')
    ->get();

if ($creditos->isEmpty()) {
    echo "❌ No hay créditos en COPE Nacional\n";
    exit(1);
}

echo "Créditos encontrados: {$creditos->count()}\n\n";

// Definir patrones diferentes para cada crédito
$patrones = [
    '109920246' => [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Teresita: Paga todo
    '112800778' => [1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1], // Adriana: Patrón original
    '112910426' => [1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1], // Marjorie: Irregular
    '205790114' => [1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1], // Johnny: 3 meses sin pagar
    '502670528' => [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Rafael: Mal inicio
];

// Mostrar patrones
echo "PATRONES DE PAGO (1=Paga, 0=No paga):\n";
echo str_repeat('-', 70) . "\n";
foreach ($creditos as $credit) {
    $cedula = $credit->lead->cedula;
    $nombre = $credit->lead->name;
    $patron = $patrones[$cedula] ?? [1,1,1,1,1,1,1,1,1,1,1,1];
    $patronStr = implode(' ', $patron);
    echo str_pad($nombre, 25) . " | {$patronStr}\n";
}
echo "\n";

$meses = [
    'Diciembre 2025',
    'Enero 2026',
    'Febrero 2026',
    'Marzo 2026',
    'Abril 2026',
    'Mayo 2026',
    'Junio 2026',
    'Julio 2026',
    'Agosto 2026',
    'Septiembre 2026',
    'Octubre 2026',
    'Noviembre 2026',
];

$fechaFormalizacion = Carbon::parse('2025-11-15');

echo "═══════════════════════════════════════════════════════════════════\n\n";

// Procesar mes por mes
for ($mesIndex = 0; $mesIndex < 12; $mesIndex++) {
    $mesNumero = $mesIndex + 1;
    $mesNombre = $meses[$mesIndex];
    $fechaProcesamiento = $fechaFormalizacion->copy()->addMonths($mesNumero);

    echo "┌─────────────────────────────────────────────────────────────────┐\n";
    echo "│ MES {$mesNumero}: {$mesNombre} (Planilla: " . $fechaProcesamiento->format('d/m/Y') . ")\n";
    echo "└─────────────────────────────────────────────────────────────────┘\n\n";

    // Determinar quiénes pagan este mes
    $creditosQuePagan = [];
    $creditosQueNoPagan = [];

    foreach ($creditos as $credit) {
        $cedula = $credit->lead->cedula;
        $patron = $patrones[$cedula] ?? [1,1,1,1,1,1,1,1,1,1,1,1];
        $paga = $patron[$mesIndex];

        if ($paga) {
            $creditosQuePagan[] = $credit;
        } else {
            $creditosQueNoPagan[] = $credit;
        }
    }

    echo "Créditos que PAGAN: " . count($creditosQuePagan) . "\n";
    echo "Créditos que NO PAGAN: " . count($creditosQueNoPagan) . "\n\n";

    // 1. Calcular mora para los que NO pagan
    if (!empty($creditosQueNoPagan)) {
        echo "→ Calculando mora para ausentes...\n";

        $controller = new \App\Http\Controllers\Api\CreditPaymentController();
        $reflection = new ReflectionClass($controller);
        $method = $reflection->getMethod('calcularMoraAusentes');
        $method->setAccessible(true);

        $creditIdsQuePagan = array_map(fn($c) => $c->id, $creditosQuePagan);
        $method->invoke($controller, $deductora->id, $creditIdsQuePagan, $fechaProcesamiento, 30, 0.14);

        foreach ($creditosQueNoPagan as $credit) {
            $cuotaMora = PlanDePago::where('credit_id', $credit->id)
                ->where('estado', 'Mora')
                ->orderBy('numero_cuota')
                ->first();

            if ($cuotaMora) {
                echo "  ❌ {$credit->lead->name}: Cuota #{$cuotaMora->numero_cuota} → MORA (₡" . number_format($cuotaMora->interes_moratorio, 2) . ")\n";
            }
        }
        echo "\n";
    }

    // 2. Procesar pagos de los que SÍ pagan
    if (!empty($creditosQuePagan)) {
        echo "→ Procesando pagos...\n";

        foreach ($creditosQuePagan as $credit) {
            // Buscar cuota a pagar
            $primerCuota = PlanDePago::where('credit_id', $credit->id)
                ->where('numero_cuota', '>', 0)
                ->whereIn('estado', ['Pendiente', 'Mora', 'Parcial'])
                ->orderBy('numero_cuota')
                ->first();

            if (!$primerCuota) continue;

            $montoPago = $primerCuota->cuota;

            $controller = new \App\Http\Controllers\Api\CreditPaymentController();
            $reflection = new ReflectionClass($controller);
            $method = $reflection->getMethod('processPaymentTransaction');
            $method->setAccessible(true);

            try {
                $method->invoke(
                    $controller,
                    $credit,
                    $montoPago,
                    $fechaProcesamiento,
                    'Planilla',
                    null,
                    "Planilla {$mesNombre}"
                );

                echo "  ✓ {$credit->lead->name}: Pagó ₡" . number_format($montoPago, 2) . "\n";

            } catch (Exception $e) {
                echo "  ❌ {$credit->lead->name}: Error - {$e->getMessage()}\n";
            }
        }
    }

    echo "\n" . str_repeat('-', 70) . "\n\n";
}

echo "═══════════════════════════════════════════════════════════════════\n";
echo "RESUMEN FINAL POR CRÉDITO\n";
echo "═══════════════════════════════════════════════════════════════════\n\n";

foreach ($creditos as $credit) {
    $credit->refresh();

    $cuotasPagadas = PlanDePago::where('credit_id', $credit->id)->where('estado', 'Pagado')->count();
    $cuotasMora = PlanDePago::where('credit_id', $credit->id)->where('estado', 'Mora')->count();
    $cuotasParciales = PlanDePago::where('credit_id', $credit->id)->where('estado', 'Parcial')->count();

    echo "{$credit->lead->name} ({$credit->lead->cedula})\n";
    echo "  Estado: {$credit->status} | Saldo: ₡" . number_format($credit->saldo, 2) . "\n";
    echo "  Pagadas: {$cuotasPagadas} | Mora: {$cuotasMora} | Parcial: {$cuotasParciales}\n\n";
}

echo "═══════════════════════════════════════════════════════════════════\n";
echo "✓ SIMULACIÓN COMPLETADA\n";
echo "═══════════════════════════════════════════════════════════════════\n";
