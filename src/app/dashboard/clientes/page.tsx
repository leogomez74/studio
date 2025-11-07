// 'use client' indica que es un Componente de Cliente, necesario para interactividad.
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
// $$$ CONECTOR MYSQL: Se importan los datos. En el futuro, vendrán de la base de datos.
import { clients, Client, leads, Lead } from '@/lib/data'; 
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


/**
 * Componente principal de la página de Clientes y Leads.
 * Muestra una vista con pestañas para gestionar clientes y leads.
 */
export default function ClientesPage() {
  return (
    <Tabs defaultValue="clientes">
      <div className="flex items-center justify-between mb-4">
        <TabsList>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
            {/* $$$ CONECTOR MYSQL: La acción de este botón creará un nuevo registro en la tabla de clientes o leads. */}
            <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                Agregar
            </Button>
        </div>
      </div>
      <TabsContent value="clientes">
        <Card>
          <CardHeader>
            <CardTitle>Clientes</CardTitle>
            <CardDescription>
              Gestiona los clientes existentes de Credipep.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClientsTable />
          </CardContent>
        </Card>
      </TabsContent>
       <TabsContent value="leads">
        <Card>
          <CardHeader>
            <CardTitle>Leads</CardTitle>
            <CardDescription>
                Gestiona los leads o clientes potenciales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeadsTable />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}


function ClientsTable() {
    /**
     * Función para obtener la variante de color de la insignia según el estado del cliente.
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
            {/* $$$ CONECTOR MYSQL: Se itera sobre la lista de clientes. Esta será una consulta a la tabla de clientes. */}
            {clients.map((client) => (
              <ClientTableRow key={client.id} client={client} getStatusVariant={getStatusVariant} />
            ))}
          </TableBody>
        </Table>
    )
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


function LeadsTable() {
    return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead className="hidden md:table-cell">Contacto</TableHead>
              <TableHead className="hidden md:table-cell">Asignado a</TableHead>
              <TableHead className="hidden md:table-cell">Registrado El</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <LeadTableRow key={lead.id} lead={lead} />
            ))}
          </TableBody>
        </Table>
    );
}

/**
 * Componente que renderiza una única fila de la tabla de leads.
 */
const LeadTableRow = React.memo(function LeadTableRow({ lead }: { lead: Lead }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={lead.avatarUrl} alt={lead.name} />
            <AvatarFallback>{lead.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="font-medium">{lead.name}</div>
        </div>
      </TableCell>
      <TableCell>{lead.cedula}</TableCell>
      <TableCell className="hidden md:table-cell">
          <div className="text-sm text-muted-foreground">{lead.email}</div>
          <div className="text-sm text-muted-foreground">{lead.phone}</div>
      </TableCell>
      <TableCell className="hidden md:table-cell">{lead.assignedTo}</TableCell>
      <TableCell className="hidden md:table-cell">{lead.registeredOn}</TableCell>
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
            <DropdownMenuItem>Convertir a Cliente</DropdownMenuItem>
            <DropdownMenuItem>Crear Oportunidad</DropdownMenuItem>
            <DropdownMenuItem>Editar</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});
