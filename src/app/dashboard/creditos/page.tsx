'use client';

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
import { credits, Credit } from '@/lib/data';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}


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

export default function CreditsPage() {
  const searchParams = useSearchParams();
  const debtorId = searchParams.get('debtorId');
  const [date, setDate] = useState<DateRange | undefined>(undefined);

  const baseFilteredCredits = debtorId
    ? credits.filter((c) => c.debtorId === debtorId)
    : credits;

  const filteredCredits = baseFilteredCredits.filter(credit => {
    if (!date?.from) return true;
    const creditDate = new Date(credit.creationDate);
    const from = new Date(date.from);
    from.setHours(0,0,0,0);
    
    if (!date.to) {
        return creditDate >= from;
    }
    const to = new Date(date.to);
    to.setHours(23,59,59,999);
    return creditDate >= from && creditDate <= to;
  })

  const pageTitle = debtorId ? `Créditos de ${filteredCredits[0]?.debtorName || ''}` : 'Todos los Créditos';
  const pageDescription = debtorId ? `Viendo todos los créditos para el cliente.` : 'Gestiona todos los créditos activos e históricos.';
  
  const handleExportPDF = (data: Credit[]) => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    
    doc.text(pageTitle, 14, 16);
    
    doc.autoTable({
        startY: 22,
        head: [['Operación', 'Deudor', 'Monto Otorgado', 'Saldo Actual', 'Estado', 'Vencimiento']],
        body: data.map(c => [
            c.operationNumber,
            c.debtorName,
            `₡${c.amount.toLocaleString('de-DE')}`,
            `₡${c.balance.toLocaleString('de-DE')}`,
            c.status,
            c.dueDate
        ]),
        headStyles: { fillColor: [19, 85, 156] }, // #13559c
    });

    doc.save('creditos.pdf');
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
           {debtorId && (
            <Button variant="outline" asChild>
              <Link href="/dashboard/creditos">Ver todos los créditos</Link>
            </Button>
          )}
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
            <TableRow key={credit.operationNumber} className="hover:bg-muted/50">
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
