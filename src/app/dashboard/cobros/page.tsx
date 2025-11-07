'use client';
import { MoreHorizontal, Phone, MessageSquareWarning } from 'lucide-react';
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

const getStatusVariant = (status: Credit['status']) => {
  switch (status) {
    case 'Al día':
      return 'secondary';
    case 'En mora':
      return 'destructive';
    default:
      return 'outline';
  }
};

const filterCreditsByArrears = (
  daysStart: number,
  daysEnd: number | null = null
) => {
  return credits.filter(c => {
    if (c.status !== 'En mora') return false;
    const daysInArrears = c.daysInArrears || 0;
    if (daysEnd === null) {
      return daysInArrears >= daysStart;
    }
    return daysInArrears >= daysStart && daysInArrears <= daysEnd;
  });
};

const alDiaCredits = credits.filter((c) => c.status === 'Al día');
const mora30 = filterCreditsByArrears(1, 30);
const mora60 = filterCreditsByArrears(31, 60);
const mora90 = filterCreditsByArrears(61, 90);
const mora180 = filterCreditsByArrears(91, 180);
const mas180 = filterCreditsByArrears(181);

export default function CobrosPage() {
  return (
    <Tabs defaultValue="al-dia">
      <CardHeader>
        <CardTitle>Gestión de Cobros</CardTitle>
        <CardDescription>
          Administra los créditos y su estado de morosidad.
        </CardDescription>
      </CardHeader>
      <div className="px-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="al-dia">Al día ({alDiaCredits.length})</TabsTrigger>
          <TabsTrigger value="30-dias">30 días ({mora30.length})</TabsTrigger>
          <TabsTrigger value="60-dias">60 días ({mora60.length})</TabsTrigger>
          <TabsTrigger value="90-dias">90 días ({mora90.length})</TabsTrigger>
          <TabsTrigger value="180-dias">180 días ({mora180.length})</TabsTrigger>
          <TabsTrigger value="mas-180-dias">+180 días ({mas180.length})</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="al-dia">
        <Card>
          <CardContent className="pt-6">
            <CobrosTable credits={alDiaCredits} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="30-dias">
        <Card>
          <CardContent className="pt-6">
            <CobrosTable credits={mora30} />
          </CardContent>
        </Card>
      </TabsContent>
       <TabsContent value="60-dias">
        <Card>
          <CardContent className="pt-6">
            <CobrosTable credits={mora60} />
          </CardContent>
        </Card>
      </TabsContent>
       <TabsContent value="90-dias">
        <Card>
          <CardContent className="pt-6">
            <CobrosTable credits={mora90} />
          </CardContent>
        </Card>
      </TabsContent>
       <TabsContent value="180-dias">
        <Card>
          <CardContent className="pt-6">
            <CobrosTable credits={mora180} />
          </CardContent>
        </Card>
      </TabsContent>
       <TabsContent value="mas-180-dias">
        <Card>
          <CardContent className="pt-6">
            <CobrosTable credits={mas180} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function CobrosTable({ credits }: { credits: Credit[] }) {
  return (
    <div className="relative w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Operación</TableHead>
            <TableHead>Deudor</TableHead>
            <TableHead className="hidden md:table-cell">Monto Cuota</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden md:table-cell">Días de Atraso</TableHead>
            <TableHead>
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {credits.map((credit) => (
            <TableRow key={credit.operationNumber} className="hover:bg-muted/50">
              <TableCell className="font-medium">
                <Link href={`/dashboard/creditos/${credit.operationNumber}`} className="hover:underline">
                  {credit.operationNumber}
                </Link>
              </TableCell>
              <TableCell>{credit.debtorName}</TableCell>
              <TableCell className="hidden md:table-cell">
                ₡{credit.fee.toLocaleString('de-DE')}
              </TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(credit.status)}>
                  {credit.status}
                </Badge>
              </TableCell>
              <TableCell className="hidden font-medium md:table-cell">
                {credit.daysInArrears || 0}
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
                    <DropdownMenuItem>
                      <MessageSquareWarning className="mr-2 h-4 w-4" />
                      Enviar Recordatorio
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Phone className="mr-2 h-4 w-4" />
                      Registrar Llamada
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      Enviar a Cobro Judicial
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
