<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Credit;
use App\Models\PlanDePago;

// Tomar un crédito 2 (formalized hoy)
$credit2 = Credit::where('formalized_at', '>=', '2026-02-12')->first();
echo "Credit 2 ID: {$credit2->id}\n";
echo "Reference: {$credit2->reference}\n";
echo "Cuota (campo): {$credit2->cuota}\n";
echo "Formalized at: {$credit2->formalized_at}\n\n";

$planes = PlanDePago::where('credit_id', $credit2->id)
    ->orderBy('numero_cuota')
    ->get();

echo "Total plan entries: {$planes->count()}\n";
foreach ($planes->take(5) as $p) {
    echo sprintf("  Cuota #%d | Estado: %-10s | Cuota: %10s | Int: %10s | Amort: %10s | Fecha: %s\n",
        $p->numero_cuota, $p->estado, $p->cuota, $p->interes_corriente, $p->amortizacion, $p->fecha_corte
    );
}

// Verificar cuotas pendientes (las que el cascade busca)
$pendientes = PlanDePago::where('credit_id', $credit2->id)
    ->where('numero_cuota', '>', 0)
    ->whereIn('estado', ['Mora', 'Pendiente', 'Parcial'])
    ->count();
echo "\nCuotas pendientes (Mora/Pendiente/Parcial): {$pendientes}\n";

// Ahora verificar un crédito 1 para comparar
$credit1 = Credit::where('formalized_at', '<', '2026-01-01')->first();
echo "\n--- Credit 1 ---\n";
echo "Credit 1 ID: {$credit1->id}\n";
echo "Reference: {$credit1->reference}\n";
echo "Cuota: {$credit1->cuota}\n";

$pendientes1 = PlanDePago::where('credit_id', $credit1->id)
    ->where('numero_cuota', '>', 0)
    ->whereIn('estado', ['Mora', 'Pendiente', 'Parcial'])
    ->count();
echo "Cuotas pendientes: {$pendientes1}\n";

$pagadas1 = PlanDePago::where('credit_id', $credit1->id)
    ->where('numero_cuota', '>', 0)
    ->where('estado', 'Pagado')
    ->count();
echo "Cuotas pagadas: {$pagadas1}\n";
