<?php
require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Credit;
use App\Models\CreditPayment;
use App\Models\PlanDePago;
use Illuminate\Support\Facades\DB;

echo "=== REGENERACIÓN DE PLANES DE PAGO Y ELIMINACIÓN DE PAGOS ===\n\n";

// 1. ELIMINAR TODOS LOS PAGOS
echo "1. Eliminando pagos...\n";
$totalPagos = CreditPayment::count();
CreditPayment::truncate();
echo "   ✓ Eliminados $totalPagos pagos\n\n";

// 2. ELIMINAR TODOS LOS PLANES DE PAGO
echo "2. Eliminando planes de pago...\n";
$totalPlanes = PlanDePago::count();
PlanDePago::truncate();
echo "   ✓ Eliminados $totalPlanes registros de plan de pagos\n\n";

// 3. RESETEAR SALDOS DE CRÉDITOS
echo "3. Reseteando saldos de créditos...\n";
DB::table('credits')
    ->where('status', 'Formalizado')
    ->update([
        'saldo' => DB::raw('monto_credito'),
    ]);
echo "   ✓ Saldos reseteados\n\n";

// 4. REGENERAR PLANES DE PAGO
echo "4. Regenerando planes de pago con tasa correcta (51.21%)...\n";
$creditos = Credit::where('status', 'Formalizado')->get();

$controller = new \App\Http\Controllers\Api\CreditController();
$reflection = new ReflectionClass($controller);
$method = $reflection->getMethod('generateAmortizationSchedule');
$method->setAccessible(true);

$regenerados = 0;
foreach ($creditos as $credit) {
    try {
        // Verificar que no tenga plan antes de generar
        $tienePlan = $credit->planDePagos()->exists();
        if ($tienePlan) {
            echo "   ⚠ Crédito {$credit->id} ya tiene plan, saltando...\n";
            continue;
        }

        // Llamar al método privado para generar el plan
        $method->invoke($controller, $credit);
        $regenerados++;

        if ($regenerados % 20 == 0) {
            echo "   ... $regenerados créditos procesados\n";
        }
    } catch (\Exception $e) {
        echo "   ❌ Error en crédito {$credit->id}: {$e->getMessage()}\n";
    }
}

echo "   ✓ $regenerados planes de pago regenerados\n\n";

// 5. VERIFICAR RESULTADO
echo "5. Verificando resultado...\n";
$creditosConPlan = Credit::where('status', 'Formalizado')
    ->whereHas('planDePagos')
    ->count();

$totalCuotas = PlanDePago::where('numero_cuota', '>', 0)->count();

echo "   ✓ Créditos con plan: $creditosConPlan / {$creditos->count()}\n";
echo "   ✓ Total de cuotas generadas: $totalCuotas\n\n";

echo "=== PROCESO COMPLETADO ===\n";
