<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Credit;
use App\Models\CreditPayment;
use App\Models\SaldoPendiente;
use App\Models\PlanDePago;

// Ver saldos pendientes
$saldos = SaldoPendiente::with('credit')->get();
echo "=== SALDOS PENDIENTES: {$saldos->count()} ===\n";
foreach ($saldos->take(5) as $s) {
    echo "  ID {$s->id} | Credit {$s->credit_id} ({$s->credit->reference}) | Monto: {$s->monto} | Cedula: {$s->cedula}\n";
}

echo "\n";

// Tomar una persona que tiene sobrante para analizar
$saldo1 = $saldos->first();
if (!$saldo1) { echo "No hay saldos\n"; exit; }

$cedula = $saldo1->cedula;
echo "=== ANALIZANDO CEDULA: {$cedula} ===\n\n";

// Créditos de esta persona
$credits = Credit::whereHas('lead', function($q) use ($cedula) {
    $q->where('cedula', $cedula);
})->orderBy('formalized_at', 'asc')->get();

foreach ($credits as $c) {
    echo "Credit {$c->id} ({$c->reference})\n";
    echo "  Cuota campo: {$c->cuota}\n";
    echo "  Saldo: {$c->saldo}\n";
    echo "  Formalized: {$c->formalized_at}\n";
    echo "  Status: {$c->status}\n";

    // Pagos de este crédito
    $payments = CreditPayment::where('credit_id', $c->id)->orderBy('id')->get();
    echo "  Pagos: {$payments->count()}\n";
    foreach ($payments as $p) {
        echo "    Pago #{$p->id} | Cuota #{$p->numero_cuota} | Monto entrada: {$p->monto} | movimiento_total: {$p->movimiento_total} | Source: {$p->source}\n";
    }

    // Plan de pagos cuotas pagadas
    $cuotas = PlanDePago::where('credit_id', $c->id)
        ->where('numero_cuota', '>', 0)
        ->orderBy('numero_cuota')
        ->take(5)
        ->get();
    echo "  Plan de pagos (primeras 5):\n";
    foreach ($cuotas as $q) {
        $totalComponentes = $q->interes_corriente + $q->int_corriente_vencido + $q->interes_moratorio + $q->poliza + $q->amortizacion;
        echo "    Cuota #{$q->numero_cuota} | Estado: {$q->estado} | Cuota: {$q->cuota} | Components: {$totalComponentes} | Int: {$q->interes_corriente} | Amort: {$q->amortizacion} | Mora: {$q->interes_moratorio} | mov_total: {$q->movimiento_total}\n";
    }

    echo "\n";
}

// Verificar si planilla generada tiene el monto correcto
echo "=== VERIFICACION MONTO PLANILLA ===\n";
$c1 = $credits->first();
$c2 = $credits->skip(1)->first();
if ($c1 && $c2) {
    echo "Cuota Credit 1: {$c1->cuota}\n";
    echo "Cuota Credit 2: {$c2->cuota}\n";
    echo "Suma esperada planilla mes3: " . ($c1->cuota + $c2->cuota) . "\n";
    echo "Sobrante encontrado: {$saldo1->monto}\n";
    echo "Diferencia no explicada: " . ($saldo1->monto) . "\n";
}
