// Importamos componentes e íconos necesarios para construir la página.
'use client';
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
import { credits, Credit } from '@/lib/data';
import Link from 'next/link';

// Esta es la función principal que define la página de Cobro Judicial.
export default function CobroJudicialPage() {
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
            {judicialCredits.map((credit) => (
              <TableRow key={credit.operationNumber}>
                <TableCell className="font-medium">
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
                  ₡{credit.balance.toLocaleString('de-DE')}
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
                            Ver Crédito
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>Ver Expediente</DropdownMenuItem>
                      <DropdownMenuItem>Registrar Actuación</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
