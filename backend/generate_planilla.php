<?php
require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use App\Models\Credit;

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();

// Encabezados
$sheet->setCellValue('A1', 'Cédula');
$sheet->setCellValue('B1', 'Monto');
$sheet->setCellValue('C1', 'Nombre');

// Estilo
$sheet->getStyle('A1:C1')->getFont()->setBold(true);
$sheet->getStyle('A1:C1')->getFill()
    ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
    ->getStartColor()->setRGB('4472C4');
$sheet->getStyle('A1:C1')->getFont()->getColor()->setRGB('FFFFFF');

// Datos
$credits = Credit::with('lead')
    ->where('status', 'Formalizado')
    ->where('cuota', '>', 0)
    ->get();

$row = 2;
foreach($credits as $c) {
    if($c->lead && $c->lead->cedula) {
        $sheet->setCellValue('A' . $row, $c->lead->cedula);
        $sheet->setCellValue('B' . $row, $c->cuota);
        $sheet->setCellValue('C' . $row, $c->lead->name);
        $row++;
    }
}

// Autosize
$sheet->getColumnDimension('A')->setAutoSize(true);
$sheet->getColumnDimension('B')->setAutoSize(true);
$sheet->getColumnDimension('C')->setAutoSize(true);

// Guardar
$writer = new Xlsx($spreadsheet);
$filename = storage_path('app/public/planilla_test_coopenacional.xlsx');
$writer->save($filename);

echo "✓ Archivo creado: planilla_test_coopenacional.xlsx\n";
echo "✓ Encabezados: Cédula | Monto | Nombre\n";
echo "✓ Total de registros: " . ($row - 2) . "\n";
