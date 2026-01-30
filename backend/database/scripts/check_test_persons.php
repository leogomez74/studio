<?php

require __DIR__ . '/../../vendor/autoload.php';

$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$cedulas = ['118280563', '207140827', '111110002', '111110003'];

echo "Buscando personas con cédulas: " . implode(', ', $cedulas) . "\n\n";

$persons = DB::table('persons')
    ->whereIn('cedula', $cedulas)
    ->get(['id', 'name', 'cedula', 'person_type_id']);

echo "Personas encontradas: " . $persons->count() . "\n\n";

foreach ($persons as $p) {
    echo "ID: {$p->id} | {$p->name} | Cédula: {$p->cedula} | Type: {$p->person_type_id}\n";

    // Buscar créditos de esta persona
    $credits = DB::table('credits')
        ->where('lead_id', $p->id)
        ->get(['id', 'numero_operacion', 'status', 'monto_credito', 'plazo']);

    echo "  Créditos: {$credits->count()}\n";
    foreach ($credits as $c) {
        echo "    - ID: {$c->id} | {$c->numero_operacion} | Status: {$c->status} | Monto: {$c->monto_credito} | Plazo: {$c->plazo}\n";
    }
    echo "\n";
}
