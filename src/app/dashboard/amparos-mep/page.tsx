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
 * Esta es la función principal que define la página de listado de Casos de Amparo del MEP.
 * Utiliza un sistema de pestañas para filtrar los casos por categoría.
 */
export default function AmparosMepPage() {
  // Filtramos los casos para obtener solo los que son amparos contra el MEP.
  const amparosMep = cases.filter(c => c.title && c.title.includes('MEP'));
  
  // La página utiliza un sistema de pestañas (Tabs) para filtrar los casos.
  return (
    <Tabs defaultValue="all">
        {/* Aquí se definen las pestañas y el botón para agregar un nuevo caso. */}
        <div className="flex items-center justify-between">
            <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="contenciosa">Contenciosa</TabsTrigger>
                <TabsTrigger value="no-contenciosa">No Contenciosa</TabsTrigger>
            </TabsList>
            <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                Agregar Amparo MEP
            </Button>
        </div>
      {/* Contenido de la pestaña "Todos". Muestra una tabla con todos los casos. */}
      <TabsContent value="all">
        <Card>
          <CardHeader>
            <CardTitle>Todos los Amparos MEP</CardTitle>
            <CardDescription>Gestiona todos los amparos relacionados con el MEP.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Reutilizamos el componente CasesTable para mostrar la tabla. */}
            <CasesTable cases={amparosMep} />
          </CardContent>
        </Card>
      </TabsContent>
      {/* Contenido de la pestaña "Contenciosa". Muestra solo los casos de esa categoría. */}
      <TabsContent value="contenciosa">
        <Card>
          <CardHeader>
            <CardTitle>Amparos MEP de Contenciosa</CardTitle>
            <CardDescription>Gestiona los amparos MEP de tipo contenciosa.</CardDescription>
          </CardHeader>
          <CardContent>
            <CasesTable cases={amparosMep.filter(c => c.category === 'Contenciosa')} />
          </CardContent>
        </Card>
      </TabsContent>
      {/* Contenido de la pestaña "No Contenciosa". */}
      <TabsContent value="no-contenciosa">
        <Card>
          <CardHeader>
            <CardTitle>Amparos MEP de No Contenciosa</CardTitle>
            <CardDescription>Gestiona los amparos MEP de tipo no contenciosa.</CardDescription>
          </CardHeader>
          <CardContent>
            <CasesTable cases={amparosMep.filter(c => c.category === 'No Contenciosa')} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

/**
 * Este es un componente reutilizable para mostrar la tabla de casos.
 * Recibe la lista de casos a mostrar como una propiedad (props).
 * Usamos React.memo para optimizar el rendimiento, evitando que se vuelva a renderizar si sus props no cambian.
 * @param {{ cases: Case[] }} props - Las propiedades del componente, que incluyen la lista de casos.
 */
const CasesTable = React.memo(function CasesTable({ cases }: { cases: Case[] }) {
    return (
        <div className="relative w-full overflow-auto">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Título del Amparo</TableHead>
                <TableHead className="hidden md:table-cell">Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Especialidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Ciclo de Vida</TableHead>
                <TableHead className="hidden md:table-cell">Última Actualización</TableHead>
                <TableHead>
                    <span className="sr-only">Acciones</span>
                </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {/* Mapeamos cada caso a una fila de la tabla. */}
                {cases.map((caseItem) => (
                <TableRow key={caseItem.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Link href={`/dashboard/amparos-mep/${caseItem.id.toLowerCase()}`} className="font-medium hover:underline">
                        {caseItem.title}
                      </Link>
                      <div className="text-sm text-muted-foreground">{caseItem.id}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{caseItem.clientName}</TableCell>
                    <TableCell className="hidden md:table-cell">{caseItem.specialty}</TableCell>
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
                    {/* Menú de acciones para cada caso. */}
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
                            <Link href={`/dashboard/amparos-mep/${caseItem.id.toLowerCase()}`}>Ver Detalles</Link>
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
