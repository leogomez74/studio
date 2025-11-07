// Importamos iconos y componentes de la interfaz de usuario.
import { MoreHorizontal, PlusCircle } from "lucide-react";
import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// $$$ CONECTOR MYSQL: Se importan los datos de ejemplo. En el futuro, esta información vendrá de la tabla de leads en la base de datos.
import { leads, Lead } from "@/lib/data";

/**
 * Esta es la función principal que define la página de Leads.
 * Muestra una lista de todos los leads o clientes potenciales en una tabla.
 */
export default function LeadsPage() {
  // La función devuelve una tarjeta (Card) que contiene la tabla de leads.
  return (
    <Card>
      {/* El encabezado de la tarjeta con título, descripción y botón para agregar. */}
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Leads</CardTitle>
                <CardDescription>Gestiona los leads.</CardDescription>
            </div>
            {/* $$$ CONECTOR MYSQL: La acción de este botón creará un nuevo registro en la tabla de leads. */}
            <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                Agregar Lead
            </Button>
        </div>
      </CardHeader>
      {/* El contenido de la tarjeta es la tabla con la lista de leads. */}
      <CardContent>
        <Table>
          {/* El encabezado de la tabla define las columnas. */}
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
          {/* El cuerpo de la tabla se llena con los datos de los leads. */}
          <TableBody>
            {/* $$$ CONECTOR MYSQL: Se itera sobre la lista de leads. Esto será una consulta a la base de datos (SELECT * FROM leads). */}
            {leads.map((lead) => (
              <LeadTableRow key={lead.id} lead={lead} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * Componente que renderiza una única fila de la tabla de leads.
 * Usamos React.memo para optimizar el rendimiento, evitando que se vuelva a renderizar si sus props no cambian.
 * @param {{ lead: Lead }} props - Las propiedades del componente, que incluyen un objeto de lead.
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
        {/* Menú desplegable con acciones para cada lead. */}
        {/* $$$ CONECTOR MYSQL: Las acciones de este menú (convertir, editar, eliminar) afectarán los registros en la base de datos. */}
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
            <DropdownMenuItem>Convertir a Oportunidad</DropdownMenuItem>
            <DropdownMenuItem>Editar</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});
