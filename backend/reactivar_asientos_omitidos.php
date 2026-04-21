<?php

/**
 * reactivar_asientos_omitidos.php
 *
 * Reactiva asientos contables que quedaron en estado "Omitido" (skipped)
 * para que puedan ser reintentados desde la UI o automáticamente.
 *
 * USO:
 *   php reactivar_asientos_omitidos.php           → preview
 *   php reactivar_asientos_omitidos.php --yes     → ejecuta
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\AccountingEntryLog;
use App\Traits\AccountingTrigger;

$autoYes = in_array('--yes', $argv ?? []);

echo "\n";
echo "╔══════════════════════════════════════════════════════╗\n";
echo "║     REACTIVAR ASIENTOS CONTABLES OMITIDOS            ║\n";
echo "╚══════════════════════════════════════════════════════╝\n\n";

// Buscar todos los ANULACION_SALDO_APLICADO omitidos
$omitidos = AccountingEntryLog::where('entry_type', 'ANULACION_SALDO_APLICADO')
    ->where('status', 'skipped')
    ->orderBy('id')
    ->get();

if ($omitidos->isEmpty()) {
    echo "✔ No hay asientos omitidos de ANULACION_SALDO_APLICADO.\n\n";
    exit(0);
}

echo "[ASIENTOS A REACTIVAR (" . $omitidos->count() . ")]\n";
foreach ($omitidos as $log) {
    echo sprintf("  ID#%d | %s | ₡%s | %s | %s\n",
        $log->id,
        $log->reference,
        number_format((float) $log->amount, 2),
        $log->source_method,
        $log->error_message
    );
}
echo "\n";

if (!$autoYes) {
    echo "¿Reactivar y re-disparar estos asientos? (escribe 'si' para continuar): ";
    if (trim(fgets(STDIN)) !== 'si') {
        echo "\nCancelado.\n\n";
        exit(0);
    }
    echo "\n";
}

// Re-disparar cada asiento usando el contexto guardado en el log
$trigger = new class {
    use AccountingTrigger;
    public function disparar(string $type, float $amount, string $ref, array $ctx): array {
        return $this->triggerAccountingEntry($type, $amount, $ref, $ctx);
    }
};

foreach ($omitidos as $log) {
    $context = is_array($log->context) ? $log->context : json_decode($log->context, true);
    $amount  = (float) $log->amount;

    // Asegurar amount_breakdown en el contexto
    if (empty($context['amount_breakdown'])) {
        $context['amount_breakdown'] = [
            'total'                    => $amount,
            'capital'                  => $amount,
            'interes_corriente'        => 0,
            'interes_moratorio'        => 0,
            'poliza'                   => 0,
            'sobrante'                 => 0,
            'cargos_adicionales_total' => 0,
            'cargos_adicionales'       => [],
        ];
    }

    // Marcar el log viejo como error para que no interfiera
    AccountingEntryLog::where('id', $log->id)->update([
        'status'        => 'error',
        'error_message' => 'Reemplazado por re-disparo manual',
    ]);

    // Re-disparar con nueva referencia para evitar cualquier bloqueo
    $nuevaRef = $log->reference . '-RETRY';
    $result = $trigger->disparar(
        'ANULACION_SALDO_APLICADO',
        $amount,
        $nuevaRef,
        array_merge($context, ['reference' => $nuevaRef])
    );

    $estado = ($result['success'] ?? false) ? '✔ Exitoso' : ('⚠ ' . ($result['error'] ?? 'Error'));
    echo "  ID#" . $log->id . " → {$estado}\n";
}

echo "\n✔ Completado.\n\n";
