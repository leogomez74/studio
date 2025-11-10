// 'use client' indica que es un Componente de Cliente, lo que permite usar hooks como useState y useSearchParams.
'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { MoreHorizontal, PlusCircle, Calendar as CalendarIcon, FileDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// $$$ CONECTOR MYSQL: Se importan los datos de créditos. En el futuro, estos datos provendrán de la base de datos.
import { credits, Credit } from '@/lib/data'; 
import Link from 'next/link';
import { useSearchParams } from 'next/navigation'; // Hook para leer parámetros de la URL.
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf'; // Librería para generar PDFs.
import 'jspdf-autotable'; // Extensión para crear tablas en jsPDF.

// Definimos un tipo que extiende jsPDF para incluir el método autoTable.
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

/**
 * Función para obtener la variante de color de la insignia según el estado del crédito.
 * @param {Credit['status']} status - El estado del crédito.
 * @returns {'secondary' | 'destructive' | 'outline' | 'default'} La variante de color para el Badge.
 */
const getStatusVariant = (status: Credit['status']) => {
  switch (status) {
    case 'Al día':
      return 'secondary';
    case 'En mora':
      return 'destructive';
    case 'Cancelado':
      return 'outline';
    default:
      return 'default';
  }
};

/**
 * Componente principal de la página de Créditos.
 * Muestra una lista de créditos con pestañas para filtrarlos por tipo.
 * Permite filtrar por cliente (via URL) y por rango de fechas.
 */
export default function CreditsPage() {
  const searchParams = useSearchParams();
  const debtorId = searchParams.get('debtorId'); // Obtenemos el 'debtorId' de la URL si existe.
  const [date, setDate] = useState<DateRange | undefined>(undefined); // Estado para el rango de fechas del calendario.

  // $$$ CONECTOR MYSQL: La lógica de filtrado se convertirá en cláusulas WHERE en una consulta SQL.
  // Filtramos los créditos base. Si hay un debtorId, filtramos por él; si no, usamos todos los créditos.
  const baseFilteredCredits = debtorId
    ? credits.filter((c) => c.debtorId === debtorId)
    : credits;

  // Aplicamos el filtro de fecha sobre los créditos ya filtrados por deudor (si aplica).
  const filteredCredits = baseFilteredCredits.filter(credit => {
    if (!date?.from) return true; // Si no hay fecha de inicio, no filtramos.
    const creditDate = new Date(credit.creationDate);
    const from = new Date(date.from);
    from.setHours(0, 0, 0, 0); // Ajustamos la hora a medianoche para incluir todo el día.

    if (!date.to) { // Si solo hay fecha de inicio, comparamos solo con esa.
        return creditDate >= from;
    }
    const to = new Date(date.to);
    to.setHours(23, 59, 59, 999); // Ajustamos la hora al final del día para incluir todo el día.
    return creditDate >= from && creditDate <= to;
  })

  // Título y descripción dinámicos dependiendo si estamos filtrando por un deudor.
  // $$$ CONECTOR MYSQL: El nombre del deudor vendrá de una consulta a la tabla de clientes.
  const pageTitle = debtorId ? `Créditos de ${filteredCredits[0]?.debtorName || ''}` : 'Todos los Créditos';
  const pageDescription = debtorId ? `Viendo todos los créditos para el cliente.` : 'Gestiona todos los créditos activos e históricos.';
  
  /**
   * Maneja la exportación de los datos de la tabla a un archivo PDF.
   * @param {Credit[]} data - Los datos de los créditos a exportar.
   */
  // $$$ CONECTOR ERP: La generación de reportes podría ser un servicio del ERP o requerir datos consolidados por él.
  const handleExportPDF = (data: Credit[]) => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    
    doc.text(pageTitle, 14, 16);
    
    doc.autoTable({
        startY: 22,
        head: [['Operación', 'Deudor', 'Monto Otorgado', 'Saldo Actual', 'Estado', 'Vencimiento']],
        body: data.map(c => [
            c.operationNumber,
            c.debtorName,
            c.amount.toLocaleString('de-DE'), // Usamos el formato local sin el símbolo para evitar problemas.
            c.balance.toLocaleString('de-DE'),
            c.status,
            c.dueDate
        ]),
        headStyles: { fillColor: [19, 85, 156] }, // Color de cabecera (azul primario).
    });

    doc.save('creditos.pdf'); // Descarga el archivo.
  };

  return (
    <Tabs defaultValue="all">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="regular">Crédito Regular</TabsTrigger>
          <TabsTrigger value="micro">Micro-Crédito</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
           {/* Si estamos filtrando por un deudor, mostramos un botón para volver a ver todos los créditos. */}
           {debtorId && (
            <Button variant="outline" asChild>
              <Link href="/dashboard/creditos">Ver todos los créditos</Link>
            </Button>
          )}
          {/* $$$ CONECTOR MYSQL: Este botón iniciará un flujo para crear un nuevo registro en la tabla de créditos. */}
          <Button size="sm" className="gap-1">
            <PlusCircle className="h-4 w-4" />
            Agregar Crédito
          </Button>
        </div>
      </div>
      <TabsContent value="all">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle>{pageTitle}</CardTitle>
                    <CardDescription>{pageDescription}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    {/* Componente Popover que contiene el calendario para seleccionar el rango de fechas. */}
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                            "w-[300px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (
                            date.to ? (
                                <>
                                {format(date.from, "LLL dd, y")} -{" "}
                                {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                            ) : (
                            <span>Seleccionar rango de fechas</span>
                            )}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={2}
                        />
                        </PopoverContent>
                    </Popover>
                    <Button variant="secondary" onClick={() => setDate(undefined)}>Limpiar</Button>
                    <Button variant="outline" size="sm" onClick={() => handleExportPDF(filteredCredits.filter(c => c.status !== 'Cancelado'))}>
                        <FileDown className="mr-2 h-4 w-4"/>
                        Exportar a PDF
                    </Button>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* $$$ CONECTOR MYSQL: La tabla se llenará con los resultados de la consulta a la base de datos, aplicando los filtros correspondientes. */}
            <CreditsTable credits={filteredCredits.filter(c => c.status !== 'Cancelado')} />
          </CardContent>
        </Card>
      </TabsContent>
       <TabsContent value="regular">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Créditos Regulares</CardTitle>
                <CardDescription>Todos los créditos de tipo regular.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleExportPDF(filteredCredits.filter(c => c.type === 'Regular' && c.status !== 'Cancelado'))}>
                  <FileDown className="mr-2 h-4 w-4"/>
                  Exportar a PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <CreditsTable credits={filteredCredits.filter(c => c.type === 'Regular' && c.status !== 'Cancelado')} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="micro">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Micro-Créditos</CardTitle>
                <CardDescription>Todos los créditos de tipo micro-crédito.</CardDescription>
              </div>
               <Button variant="outline" size="sm" onClick={() => handleExportPDF(filteredCredits.filter(c => c.type === 'Micro-crédito' && c.status !== 'Cancelado'))}>
                  <FileDown className="mr-2 h-4 w-4"/>
                  Exportar a PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <CreditsTable credits={filteredCredits.filter(c => c.type === 'Micro-crédito' && c.status !== 'Cancelado')} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="history">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle>Historial de Créditos</CardTitle>
                    <CardDescription>Créditos que ya han sido cancelados.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleExportPDF(filteredCredits.filter(c => c.status === 'Cancelado'))}>
                    <FileDown className="mr-2 h-4 w-4"/>
                    Exportar a PDF
                </Button>
            </div>
          </CardHeader>
          <CardContent>
            <CreditsTable credits={filteredCredits.filter(c => c.status === 'Cancelado')} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

/**
 * Componente reutilizable que renderiza la tabla de créditos.
 * @param {{ credits: Credit[] }} props - Las propiedades, que incluyen la lista de créditos a mostrar.
 */
function CreditsTable({ credits }: { credits: Credit[] }) {
  return (
    <div className="relative w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Operación</TableHead>
            <TableHead>Deudor</TableHead>
            <TableHead className="hidden md:table-cell">Tipo</TableHead>
            <TableHead className="text-right">Monto Otorgado</TableHead>
            <TableHead className="text-right">Saldo Actual</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden md:table-cell">Vencimiento</TableHead>
            <TableHead>
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {credits.map((credit) => (
            <CreditTableRow key={credit.operationNumber} credit={credit} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}


/**
 * Componente que renderiza una única fila de la tabla de créditos.
 * Usamos React.memo para optimizar el rendimiento, evitando que se vuelva a renderizar si sus props no cambian.
 * @param {{ credit: Credit }} props - Las propiedades del componente, que incluyen el objeto de crédito.
 */
const CreditTableRow = React.memo(function CreditTableRow({ credit }: { credit: Credit }) {
  return (
      <TableRow className="hover:bg-muted/50">
        <TableCell>
          <Link
            href={`/dashboard/creditos/${credit.operationNumber}`}
            className="font-medium hover:underline"
          >
            {credit.operationNumber}
          </Link>
        </TableCell>
        <TableCell>
            <div className="font-medium">{credit.debtorName}</div>
            <div className="text-sm text-muted-foreground">{credit.debtorId}</div>
        </TableCell>
        <TableCell className="hidden md:table-cell">{credit.type}</TableCell>
        <TableCell className="text-right font-mono">
          ₡{credit.amount.toLocaleString('de-DE')}
        </TableCell>
        <TableCell className="text-right font-mono font-semibold">
          ₡{credit.balance.toLocaleString('de-DE')}
        </TableCell>
        <TableCell>
          <Badge variant={getStatusVariant(credit.status)}>
            {credit.status}
          </Badge>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          {credit.dueDate}
        </TableCell>
        <TableCell>
          {/* $$$ CONECTOR MYSQL: Las acciones de este menú (actualizar, eliminar) afectarán la base de datos. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-haspopup="true" size="icon" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Alternar menú</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/creditos/${credit.operationNumber}`}>
                  Ver Detalles
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>Actualizar Estado</DropdownMenuItem>
              <DropdownMenuItem>Gestionar Documentos</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
  );
});
