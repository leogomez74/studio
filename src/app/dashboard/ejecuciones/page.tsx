// Importamos componentes e íconos necesarios para construir la página.
import { MoreHorizontal, PlusCircle } from "lucide-react";
import React from 'react';
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
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
// Importamos los datos de los casos desde nuestro archivo de datos de ejemplo.
import { cases, Case } from "@/lib/data";
import Link from "next/link";
import { cn } from "@/lib/utils";


/**
 * Esta función determina el color de la insignia (Badge) según el estado del caso.
 * @param {string} status - El estado actual del caso.
 * @returns {'secondary' | 'default' | 'outline' | 'destructive'} La variante de color para el Badge.
 */
const getStatusVariant = (status: string) => {
    switch (status) {
        case 'Abierto': return 'secondary';
        case 'En Progreso': return 'default';
        case 'En Espera': return 'outline';
        case 'Cerrado': return 'destructive';
        default: return 'secondary';
    }
}

/**
 * Esta es la función principal que define la página de listado de Ejecuciones de Sentencia.
 */
export default function EjecucionesPage() {
  // Filtramos los datos para obtener solo las ejecuciones (identificadas por tener un ID que termina en '-CA').
  const ejecuciones = cases.filter(c => c.id.endsWith('-CA'));

  return (
    <Tabs defaultValue="all">
        {/* Aquí se definen las pestañas y el botón para agregar una nueva ejecución. */}
        <div className="flex items-center justify-between">
            <TabsList>
                <TabsTrigger value="all">Todas</TabsTrigger>
            </TabsList>
            <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                Agregar Ejecución
            </Button>
        </div>
      {/* Contenido que muestra una tabla con todas las ejecuciones. */}
      <TabsContent value="all">
        <Card>
          <CardHeader>
            <CardTitle>Todas las Ejecuciones</CardTitle>
            <CardDescription>Gestiona el cobro de los amparos ganados.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Reutilizamos el componente ExecutionsTable para mostrar la tabla. */}
            <ExecutionsTable cases={ejecuciones} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

/**
 * Este es un componente reutilizable para mostrar la tabla de ejecuciones.
 * Recibe la lista de casos (ejecuciones) a mostrar como una propiedad (props).
 * @param {{ cases: Case[] }} props - Las propiedades del componente, que incluyen la lista de casos.
 */
const ExecutionsTable = React.memo(function ExecutionsTable({ cases }: { cases: Case[] }) {
    return (
        <div className="relative w-full overflow-auto">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Número de Caso</TableHead>
                <TableHead className="hidden md:table-cell">Número de Amparo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Ciclo de Vida</TableHead>
                <TableHead className="hidden md:table-cell">Última Actualización</TableHead>
                <TableHead>
                    <span className="sr-only">Acciones</span>
                </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {/* Mapeamos cada ejecución a una fila de la tabla. */}
                {cases.map((caseItem) => (
                <TableRow key={caseItem.id} className="hover:bg-muted/50">
                    <TableCell>
                      {/* El enlace lleva al detalle de la ejecución específica. */}
                      <Link href={`/dashboard/ejecuciones/${caseItem.id.toLowerCase()}`} className="font-medium hover:underline">
                        {caseItem.id}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{caseItem.amparoId}</TableCell>
                    <TableCell>{caseItem.clientName}</TableCell>
                    <TableCell>
                      {/* Usamos la función getStatusVariant para darle color al estado. */}
                      <Badge variant={getStatusVariant(caseItem.status)}>{caseItem.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                        {/* Mostramos una barra de progreso para el ciclo de vida de la oportunidad. */}
                        <div className="flex items-center gap-2">
                            <Progress value={caseItem.opportunityLifecycle} aria-label={`${caseItem.opportunityLifecycle}% completado`} className="h-2"/>
                            <span className="text-xs text-muted-foreground">{caseItem.opportunityLifecycle}%</span>
                        </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{caseItem.lastUpdate}</TableCell>
                    <TableCell>
                    {/* Menú de acciones para cada ejecución. */}
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
                            <Link href={`/dashboard/ejecuciones/${caseItem.id.toLowerCase()}`}>Ver Detalles</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>Actualizar Estado</DropdownMenuItem>
                        <DropdownMenuItem>Gestionar Documentos</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </div>
    );
});
