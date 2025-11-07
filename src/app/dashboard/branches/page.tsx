// Importamos los iconos y componentes de la interfaz de usuario que necesitamos.
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
// Importamos los datos de ejemplo para los puntos autorizados.
import { branches } from "@/lib/data";

/**
 * Esta es la función principal que define la página de Puntos Autorizados.
 * Muestra una lista de todos los puntos autorizados en una tabla.
 */
export default function BranchesPage() {
  // La función devuelve una tarjeta (Card) que contiene la tabla de puntos autorizados.
  return (
    <Card>
      {/* El encabezado de la tarjeta muestra el título y un botón para agregar nuevos puntos. */}
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Puntos Autorizados</CardTitle>
                <CardDescription>Gestiona los puntos autorizados y su información.</CardDescription>
            </div>
            <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                Agregar Punto Autorizado
            </Button>
        </div>
      </CardHeader>
      {/* El contenido de la tarjeta es la tabla con la lista de puntos autorizados. */}
      <CardContent>
        <Table>
          {/* El encabezado de la tabla define las columnas. */}
          <TableHeader>
            <TableRow>
              <TableHead>Nombre del Punto Autorizado</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead className="hidden md:table-cell">Gerente</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          {/* El cuerpo de la tabla se llena con los datos de los puntos autorizados. */}
          <TableBody>
            {/* Usamos la función 'map' para crear una fila en la tabla por cada punto en nuestros datos. */}
            {branches.map((branch) => (
              <BranchTableRow key={branch.id} branch={branch} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * Componente que renderiza una fila de la tabla de puntos autorizados.
 * Usamos React.memo para optimizar el rendimiento, evitando que se vuelva a renderizar si sus props no cambian.
 * @param {{ branch: (typeof branches)[0] }} props - Las propiedades del componente, que incluyen un objeto de punto autorizado.
 */
const BranchTableRow = React.memo(function BranchTableRow({ branch }: { branch: (typeof branches)[0] }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{branch.name}</TableCell>
      <TableCell>{branch.address}</TableCell>
      <TableCell className="hidden md:table-cell">{branch.manager}</TableCell>
      <TableCell>
        {/* Cada fila tiene un menú desplegable con acciones como ver detalles, editar o eliminar. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-haspopup="true" size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Alternar menú</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem>Ver Detalles</DropdownMenuItem>
            <DropdownMenuItem>Editar</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});
