// 'use client' indica que este es un Componente de Cliente, necesario para interactividad como menús desplegables.
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { clients, Client } from '@/lib/data'; // Importamos los datos de clientes.
import Link from 'next/link';

/**
 * Componente principal de la página de Clientes.
 * Muestra una tabla con la lista de todos los clientes de Credipep.
 */
export default function ClientesPage() {

  /**
   * Función para obtener la variante de color de la insignia según el estado del cliente.
   * @param {Client['clientStatus']} status - El estado del cliente.
   * @returns {'default' | 'destructive' | 'secondary' | 'outline'} La variante de color para el Badge.
   */
  const getStatusVariant = (status: Client['clientStatus']) => {
    switch (status) {
        case 'Activo': return 'default';
        case 'Moroso': return 'destructive';
        case 'En cobro': return 'destructive';
        case 'Inactivo': return 'secondary';
        case 'Fallecido': return 'outline';
        default: return 'outline';
    }
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
            {/* Iteramos sobre la lista de clientes para crear una fila por cada uno. */}
            {clients.map((client) => (
              <ClientTableRow key={client.id} client={client} getStatusVariant={getStatusVariant} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * Props para el componente ClientTableRow.
 */
interface ClientTableRowProps {
  client: Client;
  getStatusVariant: (status: Client['clientStatus']) => 'default' | 'destructive' | 'secondary' | 'outline';
}

/**
 * Componente que renderiza una única fila de la tabla de clientes.
 * Usamos React.memo para optimizar el rendimiento, evitando que se vuelva a renderizar si sus props no han cambiado.
 * @param {ClientTableRowProps} props - Las propiedades del componente.
 */
const ClientTableRow = React.memo(function ClientTableRow({ client, getStatusVariant }: ClientTableRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={client.avatarUrl} alt={client.name} />
            <AvatarFallback>{client.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="font-medium">{client.name}</div>
        </div>
      </TableCell>
      <TableCell>{client.cedula}</TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="text-sm text-muted-foreground">
          {client.email}
        </div>
        <div className="text-sm text-muted-foreground">
          {client.phone}
        </div>
      </TableCell>
      <TableCell>
        {/* Este botón-enlace lleva a la página de créditos, filtrada por el ID del cliente. */}
        <Button variant="link" asChild>
          <Link
            href={`/dashboard/creditos?debtorId=${encodeURIComponent(
              client.cedula
            )}`}
          >
            <Badge variant="default">{client.activeCredits}</Badge>
          </Link>
        </Button>
      </TableCell>
      <TableCell>
        {/* Mostramos la insignia de estado si el cliente tiene uno. */}
        {client.clientStatus &&
            <Badge variant={getStatusVariant(client.clientStatus)}>
              {client.clientStatus}
            </Badge>
        }
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {client.registeredOn}
      </TableCell>
      <TableCell>
        {/* Menú de acciones rápidas para cada cliente. */}
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
  );
});
