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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { credits, Credit } from '@/lib/data';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

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

  const filteredCredits = debtorId
    ? credits.filter((c) => c.debtorId === debtorId)
    : credits;

  const pageTitle = debtorId ? `Créditos de ${filteredCredits[0]?.debtorName}` : 'Todos los Créditos';
  const pageDescription = debtorId ? `Viendo todos los créditos para el cliente.` : 'Gestiona todos los créditos activos e históricos.';

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
            <CardTitle>{pageTitle}</CardTitle>
            <CardDescription>{pageDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <CreditsTable credits={filteredCredits.filter(c => c.status !== 'Cancelado')} />
          </CardContent>
        </Card>
      </TabsContent>
       <TabsContent value="regular">
        <Card>
          <CardHeader>
            <CardTitle>Créditos Regulares</CardTitle>
            <CardDescription>Todos los créditos de tipo regular.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreditsTable credits={filteredCredits.filter(c => c.type === 'Regular' && c.status !== 'Cancelado')} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="micro">
        <Card>
          <CardHeader>
            <CardTitle>Micro-Créditos</CardTitle>
            <CardDescription>Todos los créditos de tipo micro-crédito.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreditsTable credits={filteredCredits.filter(c => c.type === 'Micro-crédito' && c.status !== 'Cancelado')} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="history">
        <Card>
          <CardHeader>
            <CardTitle>Historial de Créditos</CardTitle>
            <CardDescription>Créditos que ya han sido cancelados.</CardDescription>
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
            <TableHead>Estado</TableHead>
            <TableHead className="hidden md:table-cell">Vencimiento</TableHead>
            <TableHead className="hidden md:table-cell">Creación</TableHead>
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
              <TableCell>
                <Badge variant={getStatusVariant(credit.status)}>
                  {credit.status}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {credit.dueDate}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {credit.creationDate}
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
