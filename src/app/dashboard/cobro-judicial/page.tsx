// Importamos componentes e íconos necesarios para construir la página.
// 'use client' indica que es un componente de cliente, necesario para menús interactivos.
'use client';
import React from 'react';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
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
import { credits, Credit } from '@/lib/data'; // Importamos los datos de créditos.
import Link from 'next/link';

/**
 * Componente principal de la página de Cobro Judicial.
 * Muestra una tabla con los créditos que han sido escalados a proceso judicial.
 */
export default function CobroJudicialPage() {
  // Filtramos los créditos para obtener solo aquellos con estado 'En cobro judicial'.
  const judicialCredits = credits.filter(
    (c) => c.status === 'En cobro judicial'
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cobro Judicial</CardTitle>
        <CardDescription>
          Módulo para la gestión de casos en cobro judicial.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operación</TableHead>
              <TableHead>Expediente Judicial</TableHead>
              <TableHead>Deudor</TableHead>
              <TableHead className="text-right">Saldo Actual</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Iteramos sobre la lista de créditos en cobro judicial para crear una fila por cada uno. */}
            {judicialCredits.map((credit) => (
              <JudicialCreditTableRow key={credit.operationNumber} credit={credit} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * Componente que renderiza una única fila de la tabla de cobro judicial.
 * Usamos React.memo para optimizar el rendimiento, evitando renderizados innecesarios si las props no cambian.
 * @param {{ credit: Credit }} props - Las propiedades del componente, que incluyen el objeto de crédito.
 */
const JudicialCreditTableRow = React.memo(function JudicialCreditTableRow({ credit }: { credit: Credit }) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        {/* Enlace al detalle del crédito. */}
        <Link
          href={`/dashboard/creditos/${credit.operationNumber}`}
          className="hover:underline"
        >
          {credit.operationNumber}
        </Link>
      </TableCell>
      <TableCell>{credit.expediente}</TableCell>
      <TableCell>{credit.debtorName}</TableCell>
      <TableCell className="text-right font-mono">
        {/* Formateamos el saldo con separadores de miles. */}
        ₡{credit.balance.toLocaleString('de-DE')}
      </TableCell>
      <TableCell>
        {/* Menú de acciones rápidas para cada caso judicial. */}
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
                  Ver Crédito
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>Ver Expediente</DropdownMenuItem>
            <DropdownMenuItem>Registrar Actuación</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});
