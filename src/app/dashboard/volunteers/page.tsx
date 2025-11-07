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
// Importamos los datos de ejemplo para los voluntarios.
import { volunteers, Volunteer } from "@/lib/data";

/**
 * Esta es la función principal que define la página de Voluntarios.
 * Muestra una tabla con la lista de voluntarios registrados.
 */
export default function VolunteersPage() {
  // La función devuelve una tarjeta (Card) que contiene la tabla de voluntarios.
  return (
    <Card>
      {/* El encabezado de la tarjeta con título, descripción y botón para agregar. */}
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Voluntarios</CardTitle>
                <CardDescription>Gestiona los voluntarios registrados y su información.</CardDescription>
            </div>
            <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                Agregar Voluntario
            </Button>
        </div>
      </CardHeader>
      {/* El contenido de la tarjeta es la tabla con la lista de voluntarios. */}
      <CardContent>
        <Table>
          {/* El encabezado de la tabla define las columnas. */}
          <TableHeader>
            <TableRow>
              <TableHead>Voluntario</TableHead>
              <TableHead>Especialidad</TableHead>
              <TableHead className="hidden md:table-cell">Disponibilidad</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          {/* El cuerpo de la tabla se llena con los datos de los voluntarios. */}
          <TableBody>
            {/* Usamos la función 'map' para crear una fila por cada voluntario. */}
            {volunteers.map((volunteer) => (
              <VolunteerTableRow key={volunteer.id} volunteer={volunteer} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * Componente que renderiza una única fila de la tabla de voluntarios.
 * Usamos React.memo para optimizar el rendimiento, evitando que se vuelva a renderizar si sus props no cambian.
 * @param {{ volunteer: Volunteer }} props - Las propiedades del componente, que incluyen un objeto de voluntario.
 */
const VolunteerTableRow = React.memo(function VolunteerTableRow({ volunteer }: { volunteer: (typeof volunteers)[0] }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={volunteer.avatarUrl} alt={volunteer.name} />
            <AvatarFallback>{volunteer.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{volunteer.name}</div>
            <div className="text-sm text-muted-foreground">{volunteer.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>{volunteer.expertise}</TableCell>
      <TableCell className="hidden md:table-cell">{volunteer.availability}</TableCell>
      <TableCell>
        {/* Menú desplegable con acciones para cada voluntario. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-haspopup="true" size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem>Ver Perfil</DropdownMenuItem>
            <DropdownMenuItem>Editar</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});
