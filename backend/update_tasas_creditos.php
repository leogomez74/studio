<?php
require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Credit;
use App\Models\Tasa;

// Obtener la Tasa Micro Crédito (ID 2)
$tasaMicro = Tasa::find(2);

if (!$tasaMicro) {
    die("❌ Error: No se encontró la Tasa Micro Crédito\n");
}

echo "Tasa Micro Crédito: {$tasaMicro->tasa}% (Máxima: {$tasaMicro->tasa_maxima}%)\n\n";

$actualizados = 0;
$creditos = Credit::where('status', 'Formalizado')->get();

foreach ($creditos as $c) {
    // Actualizar TODOS a Tasa Micro
    $c->tasa_id = 2;
    $c->tasa_anual = $tasaMicro->tasa;
    $c->tasa_maxima = $tasaMicro->tasa_maxima;
    $c->save();
    $actualizados++;
}

echo "✓ Créditos actualizados con Tasa Micro: $actualizados\n";
