// 'use client' indica que este es un Componente de Cliente, lo que permite interactividad.
'use client';
import React from 'react';
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
// $$$ CONECTOR MYSQL: Se importan los datos de créditos. En el futuro, estos datos provendrán de una consulta a la base de datos.
import { credits, Credit } from '@/lib/data'; 
import Link from 'next/link';

/**
 * Función para obtener la variante de color de la insignia según el estado del crédito.
 * @param {Credit['status']} status - El estado del crédito.
 * @returns {'secondary' | 'destructive' | 'outline'} La variante de color para el Badge.
 */
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

/**
 * Función que filtra los créditos por rango de días en mora.
 * @param {number} daysStart - El inicio del rango de días.
 * @param {number | null} [daysEnd=null] - El fin del rango de días. Si es null, filtra desde daysStart en adelante.
 * @returns {Credit[]} Un array de créditos filtrados.
 */
// $$$ CONECTOR MYSQL: Esta lógica de filtrado se traducirá en consultas SQL (ej: SELECT ... WHERE dias_en_mora BETWEEN 31 AND 60).
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

// $$$ CONECTOR MYSQL: Estas listas pre-filtradas serán reemplazadas por consultas a la base de datos para mejorar el rendimiento.
const alDiaCredits = credits.filter((c) => c.status === 'Al día');
const mora30 = filterCreditsByArrears(1, 30);
const mora60 = filterCreditsByArrears(31, 60);
const mora90 = filterCreditsByArrears(61, 90);
const mora180 = filterCreditsByArrears(91, 180);
const mas180 = filterCreditsByArrears(181);

/**
 * Componente principal de la página de Gestión de Cobros.
 * Utiliza un sistema de pestañas para organizar los créditos según su estado de morosidad.
 */
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
          {/* $$$ CONECTOR MYSQL: Los contadores en cada pestaña serán el resultado de una consulta COUNT(*) en la base de datos. */}
          <TabsTrigger value="al-dia">Al día ({alDiaCredits.length})</TabsTrigger>
          <TabsTrigger value="30-dias">30 días ({mora30.length})</TabsTrigger>
          <TabsTrigger value="60-dias">60 días ({mora60.length})</TabsTrigger>
          <TabsTrigger value="90-dias">90 días ({mora90.length})</TabsTrigger>
          <TabsTrigger value="180-dias">180 días ({mora180.length})</TabsTrigger>
          <TabsTrigger value="mas-180-dias">+180 días ({mas180.length})</TabsTrigger>
        </TabsList>
      </div>

      {/* Cada TabsContent corresponde a una pestaña y muestra la tabla filtrada. */}
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

/**
 * Componente reutilizable que renderiza la tabla de créditos.
 * Usamos React.memo para evitar que la tabla se vuelva a renderizar si la lista de créditos no ha cambiado.
 * @param {{ credits: Credit[] }} props - Las propiedades del componente, que incluyen la lista de créditos a mostrar.
 */
const CobrosTable = React.memo(function CobrosTable({ credits }: { credits: Credit[] }) {
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
                {/* $$$ CONECTOR MYSQL/ERP: Las acciones de este menú (enviar recordatorio, registrar llamada, enviar a judicial) ejecutarán lógica de negocio y actualizarán la base de datos. */}
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
});
