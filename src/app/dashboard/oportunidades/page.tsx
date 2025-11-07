// Importamos iconos y componentes de la interfaz de usuario.
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
// Importamos los datos de ejemplo para las oportunidades.
import { opportunities } from "@/lib/data";

// Esta es la función principal que define la página de Oportunidades.
export default function DealsPage() {
  return (
    <Card>
      {/* El encabezado de la tarjeta con título, descripción y botón para agregar. */}
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Oportunidades</CardTitle>
                <CardDescription>Gestiona las oportunidades de clientes potenciales.</CardDescription>
            </div>
            <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                Agregar Oportunidad
            </Button>
        </div>
      </CardHeader>
      {/* El contenido de la tarjeta es la tabla con la lista de oportunidades. */}
      <CardContent>
        <Table>
          {/* El encabezado de la tabla define las columnas. */}
          <TableHeader>
            <TableRow>
              <TableHead>Cédula del Lead</TableHead>
              <TableHead>Monto Solicitado</TableHead>
              <TableHead>Tipo de Crédito</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Fecha de Inicio</TableHead>
              <TableHead className="hidden md:table-cell">Asignado a</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          {/* El cuerpo de la tabla se llena con los datos de las oportunidades. */}
          <TableBody>
            {opportunities.map((opportunity) => (
              <TableRow key={opportunity.id}>
                <TableCell className="font-medium">{opportunity.leadCedula}</TableCell>
                <TableCell>
                  ₡{opportunity.amount.toLocaleString('de-DE')}
                </TableCell>
                <TableCell>{opportunity.creditType}</TableCell>
                <TableCell>
                  <Badge variant={opportunity.status === 'Convertido' ? 'default' : 'secondary'}>{opportunity.status}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">{opportunity.startDate}</TableCell>
                <TableCell className="hidden md:table-cell">{opportunity.assignedTo}</TableCell>
                <TableCell>
                  {/* Menú desplegable con acciones para cada oportunidad. */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Alternar menú</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuItem>Ver Detalle</DropdownMenuItem>
                      <DropdownMenuItem>Convertir a Crédito</DropdownMenuItem>
                      <DropdownMenuItem>Editar</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
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
