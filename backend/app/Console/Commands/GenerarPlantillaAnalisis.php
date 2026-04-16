<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Color;

class GenerarPlantillaAnalisis extends Command
{
    protected $signature = 'generar:plantilla-analisis
                            {salida? : Ruta de salida del archivo .xlsx}
                            {--solo-vacios : Solo incluir analisis con datos incompletos}';

    protected $description = 'Genera plantilla Excel pre-poblada para actualizar analisis (manchas, juicios, embargos e ingresos)';

    private array $colores = [
        'ANALISIS' => 'FF1F3864',
        'MANCHAS'  => 'FFB22222',
        'JUICIOS'  => 'FFA0522D',
        'EMBARGOS' => 'FF8B4513',
    ];

    public function handle(): int
    {
        $salida    = $this->argument('salida') ?? public_path('importaciones/plantilla_actualizacion_analisis.xlsx');
        $soloVacios = $this->option('solo-vacios');

        $this->info('Leyendo datos de analisis desde la BD...');

        $hayPersons = DB::select("SELECT COUNT(*) as c FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='persons'")[0]->c > 0;

        $query = DB::table('analisis as a');

        if ($hayPersons) {
            $query->leftJoin('persons as p', 'a.lead_id', '=', 'p.id')
                ->select(
                    'a.id as analisis_id', 'a.reference',
                    'p.cedula', 'p.name', 'p.apellido1', 'p.apellido2',
                    'a.cargo', 'a.nombramiento',
                    'a.ingreso_bruto', 'a.ingreso_neto',
                    'a.ingreso_bruto_2', 'a.ingreso_neto_2',
                    'a.ingreso_bruto_3', 'a.ingreso_neto_3',
                    'a.ingreso_bruto_4', 'a.ingreso_neto_4',
                    'a.ingreso_bruto_5', 'a.ingreso_neto_5',
                    'a.ingreso_bruto_6', 'a.ingreso_neto_6',
                    'a.ingreso_bruto_7', 'a.ingreso_neto_7',
                    'a.ingreso_bruto_8', 'a.ingreso_neto_8',
                    'a.ingreso_bruto_9', 'a.ingreso_neto_9',
                    'a.ingreso_bruto_10', 'a.ingreso_neto_10',
                    'a.ingreso_bruto_11', 'a.ingreso_neto_11',
                    'a.ingreso_bruto_12', 'a.ingreso_neto_12',
                    'a.monto_solicitado', 'a.monto_sugerido', 'a.cuota', 'a.plazo',
                    'a.propuesta', 'a.description',
                    'a.estado_pep', 'a.estado_cliente', 'a.divisa',
                    'a.numero_manchas', 'a.numero_juicios', 'a.numero_embargos',
                    'a.opportunity_id'
                );

            if ($soloVacios) {
                $query->where(function ($q) {
                    $q->whereNull('p.cedula')
                      ->orWhereNull('a.ingreso_bruto')->orWhere('a.ingreso_bruto', 0)
                      ->orWhereNull('a.cargo')->orWhere('a.cargo', '');
                });
            }
        } else {
            $query->selectRaw(
                'a.id as analisis_id, a.reference,
                 NULL as cedula, NULL as name, NULL as apellido1, NULL as apellido2,
                 a.cargo, a.nombramiento,
                 a.ingreso_bruto, a.ingreso_neto,
                 a.ingreso_bruto_2, a.ingreso_neto_2,
                 a.ingreso_bruto_3, a.ingreso_neto_3,
                 a.ingreso_bruto_4, a.ingreso_neto_4,
                 a.ingreso_bruto_5, a.ingreso_neto_5,
                 a.ingreso_bruto_6, a.ingreso_neto_6,
                 a.ingreso_bruto_7, a.ingreso_neto_7,
                 a.ingreso_bruto_8, a.ingreso_neto_8,
                 a.ingreso_bruto_9, a.ingreso_neto_9,
                 a.ingreso_bruto_10, a.ingreso_neto_10,
                 a.ingreso_bruto_11, a.ingreso_neto_11,
                 a.ingreso_bruto_12, a.ingreso_neto_12,
                 a.monto_solicitado, a.monto_sugerido, a.cuota, a.plazo,
                 a.propuesta, a.description,
                 a.estado_pep, a.estado_cliente, a.divisa,
                 a.numero_manchas, a.numero_juicios, a.numero_embargos,
                 a.opportunity_id'
            );

            if ($soloVacios) {
                $query->where(function ($q) {
                    $q->whereNull('a.ingreso_bruto')->orWhere('a.ingreso_bruto', 0)
                      ->orWhereNull('a.cargo')->orWhere('a.cargo', '');
                });
            }
        }

        $analisis = $query->orderBy('a.id')->get();

        if ($analisis->isEmpty()) {
            $this->warn('No se encontraron analisis.');
            return 0;
        }

        $this->info("Analisis encontrados: {$analisis->count()}");

        $ids = $analisis->pluck('analisis_id');
        $manchasExistentes  = $this->cargarDetalles('mancha_detalles',  $ids);
        $juiciosExistentes  = $this->cargarDetalles('juicio_detalles',  $ids);
        $embargosExistentes = $this->cargarDetalles('embargo_detalles', $ids);

        $spreadsheet = new Spreadsheet();
        $spreadsheet->getProperties()->setTitle('Actualización de Analisis');

        $this->crearHojaAnalisis($spreadsheet, $analisis);
        $this->crearHojaDetalle($spreadsheet, 'MANCHAS',  $analisis, $manchasExistentes,
            ['cedula', 'nombre (ref)', 'fecha_inicio', 'fecha_fin', 'descripcion', 'monto'],
            fn($r) => [$r->fecha_inicio ?? '', $r->fecha_fin ?? '', $r->descripcion ?? '', $r->monto ?? 0]
        );
        $this->crearHojaDetalle($spreadsheet, 'JUICIOS',  $analisis, $juiciosExistentes,
            ['cedula', 'nombre (ref)', 'fecha_inicio', 'fecha_fin', 'estado', 'expediente', 'monto'],
            fn($r) => [$r->fecha_inicio ?? '', $r->fecha_fin ?? '', $r->estado ?? 'activo', $r->expediente ?? '', $r->monto ?? 0]
        );
        $this->crearHojaDetalle($spreadsheet, 'EMBARGOS', $analisis, $embargosExistentes,
            ['cedula', 'nombre (ref)', 'fecha_inicio', 'fecha_fin', 'motivo', 'monto'],
            fn($r) => [$r->fecha_inicio ?? '', $r->fecha_fin ?? '', $r->motivo ?? '', $r->monto ?? 0]
        );
        $this->crearHojaInstrucciones($spreadsheet);

        $spreadsheet->setActiveSheetIndex(0);

        $dir = dirname($salida);
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        (new Xlsx($spreadsheet))->save($salida);

        $this->info("Plantilla generada: {$salida}");
        return 0;
    }

    // ─── Hoja ANALISIS ──────────────────────────────────────────────────────────

    private function crearHojaAnalisis(Spreadsheet $spreadsheet, $analisis): void
    {
        $sheet = $spreadsheet->getActiveSheet()->setTitle('ANALISIS');

        $headers = [
            'cedula', 'referencia_oportunidad', 'nombre_completo (ref)', 'oportunidad (ref)',
            'cargo', 'nombramiento',
            'ingreso_bruto', 'ingreso_neto',
            'ingreso_bruto_2', 'ingreso_neto_2',
            'ingreso_bruto_3', 'ingreso_neto_3',
            'ingreso_bruto_4', 'ingreso_neto_4',
            'ingreso_bruto_5', 'ingreso_neto_5',
            'ingreso_bruto_6', 'ingreso_neto_6',
            'ingreso_bruto_7', 'ingreso_neto_7',
            'ingreso_bruto_8', 'ingreso_neto_8',
            'ingreso_bruto_9', 'ingreso_neto_9',
            'ingreso_bruto_10', 'ingreso_neto_10',
            'ingreso_bruto_11', 'ingreso_neto_11',
            'ingreso_bruto_12', 'ingreso_neto_12',
            'monto_solicitado', 'monto_sugerido', 'cuota', 'plazo',
            'propuesta', 'description',
            'estado_pep', 'estado_cliente', 'divisa',
            'numero_manchas', 'numero_juicios', 'numero_embargos',
        ];

        foreach ($headers as $i => $h) {
            $sheet->setCellValue($this->col($i + 1) . '1', $h);
        }

        $this->estiloEncabezado($sheet, 1, count($headers), 'ANALISIS');

        $row = 2;
        foreach ($analisis as $a) {
            $valores = [
                $a->cedula ?? '',
                $a->opportunity_id ?? '',
                trim(($a->name ?? '') . ' ' . ($a->apellido1 ?? '') . ' ' . ($a->apellido2 ?? '')),
                $a->opportunity_id ?? '',
                $a->cargo ?? '',
                $a->nombramiento ?? '',
                $a->ingreso_bruto,   $a->ingreso_neto,
                $a->ingreso_bruto_2,  $a->ingreso_neto_2,
                $a->ingreso_bruto_3,  $a->ingreso_neto_3,
                $a->ingreso_bruto_4,  $a->ingreso_neto_4,
                $a->ingreso_bruto_5,  $a->ingreso_neto_5,
                $a->ingreso_bruto_6,  $a->ingreso_neto_6,
                $a->ingreso_bruto_7,  $a->ingreso_neto_7,
                $a->ingreso_bruto_8,  $a->ingreso_neto_8,
                $a->ingreso_bruto_9,  $a->ingreso_neto_9,
                $a->ingreso_bruto_10, $a->ingreso_neto_10,
                $a->ingreso_bruto_11, $a->ingreso_neto_11,
                $a->ingreso_bruto_12, $a->ingreso_neto_12,
                $a->monto_solicitado, $a->monto_sugerido, $a->cuota, $a->plazo,
                $a->propuesta ?? '', $a->description ?? '',
                $a->estado_pep ?? 'Pendiente', $a->estado_cliente ?? '',
                $a->divisa ?? 'CRC',
                $a->numero_manchas, $a->numero_juicios, $a->numero_embargos,
            ];

            foreach ($valores as $i => $v) {
                $sheet->setCellValue($this->col($i + 1) . $row, $v);
            }

            if ($row % 2 === 0) {
                $sheet->getStyle('A' . $row . ':' . $this->col(count($headers)) . $row)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFF0F4FF');
            }

            $row++;
        }

        $this->autoSize($sheet, count($headers));
        $sheet->freezePane('A2');
    }

    // ─── Hoja de detalle genérica (MANCHAS / JUICIOS / EMBARGOS) ───────────────

    private function crearHojaDetalle(
        Spreadsheet $spreadsheet,
        string $nombre,
        $analisis,
        array $existentes,
        array $headers,
        \Closure $extraerCampos
    ): void {
        $sheet = $spreadsheet->createSheet()->setTitle($nombre);

        foreach ($headers as $i => $h) {
            $sheet->setCellValue($this->col($i + 1) . '1', $h);
        }
        $this->estiloEncabezado($sheet, 1, count($headers), $nombre);

        $row = 2;

        foreach ($analisis as $a) {
            $cedula = $a->cedula ?? '';
            $nombre_ref = trim(($a->name ?? '') . ' ' . ($a->apellido1 ?? ''));
            $registros = $existentes[$a->analisis_id] ?? [];

            // Contadores según hoja
            $contador = match ($nombre) {
                'MANCHAS'  => $a->numero_manchas,
                'JUICIOS'  => $a->numero_juicios,
                'EMBARGOS' => $a->numero_embargos,
                default    => 0,
            };

            if (!empty($registros)) {
                // Volcar detalles existentes
                foreach ($registros as $reg) {
                    $campos = $extraerCampos($reg);
                    $sheet->setCellValue('A' . $row, $cedula);
                    $sheet->setCellValue('B' . $row, $nombre_ref);
                    foreach ($campos as $i => $v) {
                        $sheet->setCellValue($this->col($i + 3) . $row, $v);
                    }
                    $row++;
                }
            } elseif ($contador > 0) {
                // El contador dice que hay registros pero no hay detalle
                // Generar filas vacías marcadas en amarillo para completar
                for ($i = 0; $i < $contador; $i++) {
                    $sheet->setCellValue('A' . $row, $cedula);
                    $sheet->setCellValue('B' . $row, $nombre_ref . ' [COMPLETAR]');

                    // Vaciar columnas de detalle
                    $camposVacios = $extraerCampos((object)array_fill_keys(
                        ['fecha_inicio','fecha_fin','descripcion','motivo','estado','expediente','monto'],
                        null
                    ));
                    foreach ($camposVacios as $j => $v) {
                        $sheet->setCellValue($this->col($j + 3) . $row, '');
                    }

                    // Marcar amarillo
                    $sheet->getStyle('A' . $row . ':' . $this->col(count($headers)) . $row)
                        ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFFFF3CD');

                    $row++;
                }
            }
            // Si contador=0 y no hay registros → no agregar filas (correcto)
        }

        // Fila de notas
        $notas = match ($nombre) {
            'MANCHAS'  => ['','← misma cédula que ANALISIS','YYYY-MM-DD','(opcional)','Descripción','Monto (0 si no aplica)'],
            'JUICIOS'  => ['','← misma cédula que ANALISIS','YYYY-MM-DD','(opcional)','activo/resuelto/prescrito','Nº expediente','Monto demandado'],
            'EMBARGOS' => ['','← misma cédula que ANALISIS','YYYY-MM-DD','(opcional)','Motivo del embargo','Monto'],
            default    => [],
        };
        foreach ($notas as $i => $nota) {
            $sheet->setCellValue($this->col($i + 1) . $row, $nota);
        }
        $sheet->getStyle('A' . $row . ':' . $this->col(count($headers)) . $row)
            ->getFont()->setItalic(true)->setColor(new Color('FF888888'));

        $this->autoSize($sheet, count($headers));
        $sheet->freezePane('A2');
    }

    // ─── Hoja INSTRUCCIONES ─────────────────────────────────────────────────────

    private function crearHojaInstrucciones(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet()->setTitle('INSTRUCCIONES');

        $row = 1;

        // ── Título principal ────────────────────────────────────────────────────
        $sheet->setCellValue('A' . $row, 'GUÍA DE USO — PLANTILLA ACTUALIZACIÓN DE ANALISIS');
        $sheet->mergeCells('A' . $row . ':G' . $row);
        $sheet->getStyle('A' . $row)->getFont()->setBold(true)->setSize(14)->setColor(new Color('FFFFFFFF'));
        $sheet->getStyle('A' . $row)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF1F3864');
        $sheet->getStyle('A' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getRowDimension($row)->setRowHeight(28);
        $row += 2;

        // ── SECCIÓN 1: Paso a paso ──────────────────────────────────────────────
        $row = $this->seccion($sheet, $row, 'CÓMO LLENAR ESTA PLANTILLA', 'FF2E75B6');

        $pasos = [
            '1. Hoja ANALISIS'  => 'Completa o corrige los campos de cada persona: ingresos, cargo, nombramiento, propuesta, estado PEP, etc. Las celdas que dejes vacías NO se modifican en el sistema.',
            '2. Hoja MANCHAS'   => 'Una fila por mancha. Si una persona tiene 3 manchas, escribe 3 filas con la misma cédula. Si la persona no tenía manchas y quieres agregarle, simplemente agrega sus filas aquí.',
            '3. Hoja JUICIOS'   => 'Una fila por juicio. El campo "estado" puede ser: activo, resuelto o prescrito. El expediente es opcional.',
            '4. Hoja EMBARGOS'  => 'Una fila por embargo. El campo "motivo" es opcional.',
            '5. Filas AMARILLO' => 'Esas filas ya tienen cédula porque el sistema sabe que hay registros, pero les falta el detalle. Complétalas con la información real.',
        ];

        foreach ($pasos as $paso => $desc) {
            $sheet->setCellValue('A' . $row, $paso);
            $sheet->setCellValue('C' . $row, $desc);
            $sheet->getStyle('A' . $row)->getFont()->setBold(true);
            $sheet->getStyle('C' . $row)->getAlignment()->setWrapText(true);
            $sheet->getRowDimension($row)->setRowHeight(32);
            $row++;
        }
        $row++;

        // ── SECCIÓN 2: Cómo identificar la persona ──────────────────────────────
        $row = $this->seccion($sheet, $row, 'CÓMO IDENTIFICA EL SISTEMA A CADA PERSONA', 'FF2E75B6');

        $sheet->setCellValue('A' . $row, 'Cada fila se identifica usando la cédula y/o la referencia del analisis. Ambas columnas vienen pre-llenadas — no las borres.');
        $sheet->mergeCells('A' . $row . ':G' . $row);
        $sheet->getStyle('A' . $row)->getAlignment()->setWrapText(true);
        $sheet->getRowDimension($row)->setRowHeight(25);
        $row += 2;

        $identificadores = [
            ['Cédula + Referencia oportunidad', 'La combinación más precisa. Úsala cuando la persona tiene más de un analisis — así sabes exactamente cuál se actualiza.'],
            ['Solo Referencia oportunidad',     'El número de oportunidad (ej: 26-00001-OP) es único por analisis. Identifica el correcto aunque dejes la cédula vacía.'],
            ['Solo Cédula',         'Si no tienes la referencia, el sistema busca la persona por cédula y toma su analisis más reciente.'],
        ];

        foreach ($identificadores as [$campo, $desc]) {
            $sheet->setCellValue('A' . $row, $campo);
            $sheet->setCellValue('C' . $row, $desc);
            $sheet->getStyle('A' . $row)->getFont()->setBold(true)->setColor(new Color('FF1F3864'));
            $sheet->getStyle('C' . $row)->getAlignment()->setWrapText(true);
            $sheet->getRowDimension($row)->setRowHeight(30);
            $row++;
        }
        $row++;

        // ── SECCIÓN 3: Reglas importantes ──────────────────────────────────────
        $row = $this->seccion($sheet, $row, 'REGLAS IMPORTANTES', 'FFCC0000');

        $reglas = [
            '⚠  Manchas / Juicios / Embargos: REEMPLAZO TOTAL'
                => 'Si agregas filas para una persona, el sistema borra todo lo que tenía antes e inserta lo que pusiste. Si quieres conservar las existentes, inclúyelas también en el Excel.',
            '✅  Si no pones filas para una persona'
                => 'Sus manchas, juicios o embargos anteriores NO se tocan. Solo se actualizan quienes aparecen en esas hojas.',
            '✅  Hoja ANALISIS: solo actualiza lo que llenes'
                => 'Una celda vacía significa "no cambiar ese campo". Solo se actualizan los campos que tengan valor.',
            '⚠  Fecha de inicio'
                => 'Es obligatoria en manchas, juicios y embargos. Si no la conoces con exactitud, escribe la fecha aproximada.',
        ];

        foreach ($reglas as $titulo => $desc) {
            $sheet->setCellValue('A' . $row, $titulo);
            $sheet->setCellValue('C' . $row, $desc);
            $sheet->getStyle('A' . $row)->getFont()->setBold(true);
            $sheet->getStyle('C' . $row)->getAlignment()->setWrapText(true);
            $sheet->getRowDimension($row)->setRowHeight(35);
            $row++;
        }
        $row++;

        // ── SECCIÓN 4: Ejemplos visuales ───────────────────────────────────────
        $row = $this->seccion($sheet, $row, 'EJEMPLOS', 'FF375623');

        // Ejemplo MANCHAS
        $sheet->setCellValue('A' . $row, 'Hoja MANCHAS — persona con 2 manchas:');
        $sheet->getStyle('A' . $row)->getFont()->setBold(true)->setItalic(true);
        $row++;

        $ejManchas = [
            ['cedula', 'nombre (ref)', 'fecha_inicio', 'fecha_fin', 'descripcion', 'monto'],
            ['603850364', 'Siney Villalobos', '2023-05-01', '', 'Mora CCSS', '150000'],
            ['603850364', 'Siney Villalobos', '2024-01-15', '2024-06-30', 'Tarjeta BCR vencida', '80000'],
        ];
        foreach ($ejManchas as $i => $cols) {
            foreach ($cols as $j => $v) {
                $sheet->setCellValue($this->col($j + 1) . $row, $v);
            }
            if ($i === 0) {
                $sheet->getStyle('A' . $row . ':F' . $row)
                    ->getFont()->setBold(true)->setColor(new Color('FFFFFFFF'));
                $sheet->getStyle('A' . $row . ':F' . $row)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFB22222');
            } else {
                $sheet->getStyle('A' . $row . ':F' . $row)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFFCE4E4');
            }
            $row++;
        }

        $sheet->setCellValue('A' . $row, '→ Resultado: se registran 2 manchas para esa cédula y numero_manchas queda en 2.');
        $sheet->getStyle('A' . $row)->getFont()->setItalic(true)->setColor(new Color('FF375623'));
        $sheet->mergeCells('A' . $row . ':G' . $row);
        $row += 2;

        // Ejemplo JUICIOS
        $sheet->setCellValue('A' . $row, 'Hoja JUICIOS — persona sin juicios previos a la que se le agrega uno:');
        $sheet->getStyle('A' . $row)->getFont()->setBold(true)->setItalic(true);
        $row++;

        $ejJuicios = [
            ['cedula', 'nombre (ref)', 'fecha_inicio', 'fecha_fin', 'estado', 'expediente', 'monto'],
            ['304470608', 'Alonso Martinez', '2022-08-10', '', 'activo', '22-000123-0182-CI', '500000'],
        ];
        foreach ($ejJuicios as $i => $cols) {
            foreach ($cols as $j => $v) {
                $sheet->setCellValue($this->col($j + 1) . $row, $v);
            }
            if ($i === 0) {
                $sheet->getStyle('A' . $row . ':G' . $row)
                    ->getFont()->setBold(true)->setColor(new Color('FFFFFFFF'));
                $sheet->getStyle('A' . $row . ':G' . $row)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFA0522D');
            } else {
                $sheet->getStyle('A' . $row . ':G' . $row)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFFFF0E8');
            }
            $row++;
        }

        $sheet->setCellValue('A' . $row, '→ Resultado: aunque el analisis tenía numero_juicios=0, se registra 1 juicio y el contador queda en 1.');
        $sheet->getStyle('A' . $row)->getFont()->setItalic(true)->setColor(new Color('FF375623'));
        $sheet->mergeCells('A' . $row . ':G' . $row);
        $row += 2;

        // Ejemplo ANALISIS (actualización parcial)
        $sheet->setCellValue('A' . $row, 'Hoja ANALISIS — actualizar solo el ingreso y la propuesta (dejar el resto vacío):');
        $sheet->getStyle('A' . $row)->getFont()->setBold(true)->setItalic(true);
        $row++;

        $ejAnalisis = [
            ['cedula', 'referencia_oportunidad', 'nombre (ref)', 'cargo', 'ingreso_bruto', 'ingreso_neto', 'propuesta'],
            ['603850364', '26-00001-OP', 'Siney Villalobos', '', '850000', '620000', 'Aprobado con garantía salarial'],
        ];
        foreach ($ejAnalisis as $i => $cols) {
            foreach ($cols as $j => $v) {
                $sheet->setCellValue($this->col($j + 1) . $row, $v);
            }
            if ($i === 0) {
                $sheet->getStyle('A' . $row . ':G' . $row)
                    ->getFont()->setBold(true)->setColor(new Color('FFFFFFFF'));
                $sheet->getStyle('A' . $row . ':G' . $row)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF1F3864');
            } else {
                $sheet->getStyle('A' . $row . ':G' . $row)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFF0F4FF');
            }
            $row++;
        }

        $sheet->setCellValue('A' . $row, '→ Solo se actualiza ingreso_bruto, ingreso_neto y propuesta. El campo "cargo" vacío no modifica nada en BD.');
        $sheet->getStyle('A' . $row)->getFont()->setItalic(true)->setColor(new Color('FF375623'));
        $sheet->mergeCells('A' . $row . ':G' . $row);
        $row += 2;

        // ── SECCIÓN 5: Valores válidos ──────────────────────────────────────────
        $row = $this->seccion($sheet, $row, 'VALORES VÁLIDOS POR CAMPO', 'FF2E75B6');

        $valores = [
            ['Campo',           'Valores aceptados',                                  'Notas'],
            ['estado_pep',      'Pendiente / Aprobado / Rechazado / En revisión',     ''],
            ['estado_cliente',  'Nuevo / Recurrente / VIP / Inactivo',                ''],
            ['nombramiento',    'Propietario / Interino / Contrato / Pensionado',      ''],
            ['divisa',          'CRC / USD',                                           'Por defecto CRC'],
            ['estado (juicio)', 'activo / resuelto / prescrito',                      'Solo en hoja JUICIOS'],
            ['fecha_inicio',    'YYYY-MM-DD  ó  DD/MM/YYYY',                          'Obligatoria en MANCHAS/JUICIOS/EMBARGOS'],
            ['fecha_fin',       'YYYY-MM-DD  ó  DD/MM/YYYY',                          'Opcional — dejar vacía si sigue vigente'],
            ['monto',           'Número sin puntos de miles. Punto decimal.',          'Ej: 1500000.00   (NO: 1.500.000)'],
        ];

        foreach ($valores as $i => $cols) {
            foreach ($cols as $j => $v) {
                $sheet->setCellValue($this->col($j + 1) . $row, $v);
            }
            if ($i === 0) {
                $sheet->getStyle('A' . $row . ':C' . $row)
                    ->getFont()->setBold(true)->setColor(new Color('FFFFFFFF'));
                $sheet->getStyle('A' . $row . ':C' . $row)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF2E75B6');
            } elseif ($i % 2 === 0) {
                $sheet->getStyle('A' . $row . ':C' . $row)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFF0F4FF');
            }
            $sheet->getStyle('B' . $row)->getAlignment()->setWrapText(true);
            $sheet->getStyle('C' . $row)->getAlignment()->setWrapText(true);
            $row++;
        }

        // Anchos de columna
        $sheet->getColumnDimension('A')->setWidth(30);
        $sheet->getColumnDimension('B')->setWidth(20);
        $sheet->getColumnDimension('C')->setWidth(55);
        $sheet->getColumnDimension('D')->setWidth(20);
        $sheet->getColumnDimension('E')->setWidth(18);
        $sheet->getColumnDimension('F')->setWidth(18);
        $sheet->getColumnDimension('G')->setWidth(30);
    }

    /** Imprime un encabezado de sección y retorna la siguiente fila */
    private function seccion($sheet, int $row, string $titulo, string $color): int
    {
        $sheet->setCellValue('A' . $row, $titulo);
        $sheet->mergeCells('A' . $row . ':G' . $row);
        $sheet->getStyle('A' . $row)->getFont()->setBold(true)->setSize(11)->setColor(new Color('FFFFFFFF'));
        $sheet->getStyle('A' . $row)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF' . ltrim($color, '#F'));
        $sheet->getStyle('A' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
        $sheet->getRowDimension($row)->setRowHeight(20);
        return $row + 1;
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    /** Convierte índice numérico (base 1) a letra(s) de columna: 1→A, 27→AA */
    private function col(int $n): string
    {
        return Coordinate::stringFromColumnIndex($n);
    }

    private function estiloEncabezado($sheet, int $row, int $numCols, string $hoja): void
    {
        $rango = 'A' . $row . ':' . $this->col($numCols) . $row;
        $style = $sheet->getStyle($rango);
        $style->getFont()->setBold(true)->setColor(new Color('FFFFFFFF'));
        $style->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB($this->colores[$hoja] ?? 'FF1F3864');
        $style->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
        $style->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getRowDimension($row)->setRowHeight(22);
    }

    private function autoSize($sheet, int $numCols): void
    {
        for ($i = 1; $i <= $numCols; $i++) {
            $sheet->getColumnDimension($this->col($i))->setAutoSize(true);
        }
    }

    private function cargarDetalles(string $tabla, $ids): array
    {
        try {
            $rows = DB::table($tabla)->whereIn('analisis_id', $ids)->get();
            $agrupado = [];
            foreach ($rows as $r) {
                $agrupado[$r->analisis_id][] = $r;
            }
            return $agrupado;
        } catch (\Throwable) {
            return [];
        }
    }
}
