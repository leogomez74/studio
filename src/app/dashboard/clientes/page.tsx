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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { users } from '@/lib/data';
import Link from 'next/link';

export default function ClientesPage() {
  const clientes = users.filter((u) => u.status === 'Cliente');

  const getStatusVariant = (status: 'Activo' | 'Suspendido') => {
    return status === 'Activo' ? 'default' : 'destructive';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Clientes</CardTitle>
            <CardDescription>
              Gestiona los clientes existentes de Credipep.
            </CardDescription>
          </div>
          <Button size="sm" className="gap-1">
            <PlusCircle className="h-4 w-4" />
            Agregar Cliente
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead className="hidden md:table-cell">Contacto</TableHead>
              <TableHead>Créditos Activos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">
                Registrado El
              </TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="font-medium">{user.name}</div>
                  </div>
                </TableCell>
                <TableCell>{user.cedula}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="text-sm text-muted-foreground">
                    {user.email}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {user.phone}
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="link" asChild>
                    <Link
                      href={`/dashboard/creditos?debtorId=${encodeURIComponent(
                        user.cedula
                      )}`}
                    >
                      <Badge variant="default">{user.activeCredits}</Badge>
                    </Link>
                  </Button>
                </TableCell>
                <TableCell>
                  {user.clientStatus &&
                    (user.clientStatus === 'Suspendido' &&
                    user.unsignedCreditId ? (
                      <Button variant="link" asChild className="h-auto p-0">
                        <Link
                          href={`/dashboard/creditos/${user.unsignedCreditId.toLowerCase()}`}
                        >
                          <Badge variant={getStatusVariant(user.clientStatus)}>
                            {user.clientStatus}
                          </Badge>
                        </Link>
                      </Button>
                    ) : (
                      <Badge variant={getStatusVariant(user.clientStatus)}>
                        {user.clientStatus}
                      </Badge>
                    ))}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {user.registeredOn}
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
                      <DropdownMenuItem>Ver Perfil</DropdownMenuItem>
                      <DropdownMenuItem>Crear Crédito</DropdownMenuItem>
                      <DropdownMenuItem>Editar</DropdownMenuItem>
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
      </CardContent>
    </Card>
  );
}
