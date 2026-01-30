// Importamos los componentes e íconos necesarios para construir la página.
import React from 'react';
import { PlusCircle, MapPin, PackageCheck, User, Calendar, MoreHorizontal, Truck } from "lucide-react";
import { ProtectedPage } from "@/components/ProtectedPage";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
// $$$ CONECTOR ERP/MYSQL: Se importan datos de ejemplo. En el futuro, estos datos vendrán del ERP y la base de datos MySQL.
import { pendingPickups, routes, couriers } from "@/lib/data";

/**
 * Esta es la función principal que define la página de Rutas.
 * Muestra las recogidas de documentos pendientes y las rutas planificadas para los mensajeros.
 */
export default function RutasPage() {
  return (
    <ProtectedPage module="rutas">
      {/* Usamos un layout de rejilla (grid) para organizar las tarjetas de contenido. */}
      <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
      {/* Tarjeta 1: Recogidas Pendientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Recogidas Pendientes
          </CardTitle>
          <CardDescription>
            Documentos listos en puntos autorizados esperando ser asignados a una ruta de recogida.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {/* Tabla para mostrar los documentos pendientes. */}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Punto Autorizado</TableHead>
                        <TableHead>Caso</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Documentos</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {/* $$$ CONECTOR ERP: Se itera sobre recogidas pendientes. Esta información será consultada al ERP. */}
                    {pendingPickups.map((pickup) => (
                        <TableRow key={pickup.id}>
                            <TableCell>
                                <div className="font-medium">{pickup.branchName}</div>
                                <div className="text-sm text-muted-foreground">{pickup.branchId}</div>
                            </TableCell>
                            <TableCell>{pickup.caseId}</TableCell>
                            <TableCell>{pickup.clientName}</TableCell>
                            <TableCell className="text-right">{pickup.documentCount}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      
      {/* Tarjeta 2: Planificación y Rutas Activas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div className="grid gap-2">
                <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5"/>
                    Rutas Planificadas
                </CardTitle>
                <CardDescription>
                    Gestiona y visualiza las rutas de los mensajeros.
                </CardDescription>
            </div>
          {/* $$$ CONECTOR ERP: La creación de una nueva ruta se registrará en el ERP. */}
          <Button size="sm" className="gap-1">
            <PlusCircle className="h-4 w-4" />
            Crear Nueva Ruta
          </Button>
        </CardHeader>
        <CardContent>
          {/* Usamos un Acordeón para mostrar cada ruta de forma colapsable. */}
          <Accordion type="single" collapsible className="w-full">
            {/* $$$ CONECTOR ERP: Se itera sobre las rutas. Esta información provendrá del ERP. */}
            {routes.map((route) => (
              <AccordionItem value={route.id} key={route.id}>
                <AccordionTrigger>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="font-medium">{route.routeName}</div>
                        <Badge variant={route.status === 'Completada' ? 'secondary' : 'default'}>{route.status}</Badge>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    {/* Contenido detallado de cada ruta. */}
                    <div className="space-y-4 pl-2">
                        <div className="flex flex-col gap-2 md:flex-row md:justify-between">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Mensajero:</span>
                                <span>{route.courierName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Fecha:</span>
                                <span>{route.date}</span>
                            </div>
                            {/* $$$ CONECTOR ERP: Las acciones sobre la ruta (ver hoja, completar, cancelar) se comunicarán con el ERP. */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="h-7 gap-1">
                                    <span className="sr-only sm:not-sr-only">Acciones</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuItem>Ver Hoja de Ruta</DropdownMenuItem>
                                <DropdownMenuItem>Marcar como Completada</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Cancelar Ruta</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        
                        {/* Lista de paradas (puntos autorizados) en la ruta. */}
                        <div className="space-y-2">
                           <h4 className="font-semibold">Paradas:</h4>
                           <ul className="space-y-2">
                            {route.stops.map(stop => (
                                <li key={stop.branchId} className="flex items-start gap-3 rounded-lg border bg-muted/50 p-3">
                                    <MapPin className="h-5 w-5 mt-1 text-primary"/>
                                    <div>
                                        <p className="font-medium">{stop.branchName}</p>
                                        <p className="text-sm text-muted-foreground">{stop.address}</p>
                                        {/* Documentos a recoger en esta parada. */}
                                        {stop.pickups.length > 0 && (
                                            <div className="mt-2 text-xs">
                                                <p className="font-medium">Recoger para casos:</p>
                                                <p className="text-muted-foreground">{stop.pickups.map(p => p.caseId).join(', ')}</p>
                                            </div>
                                        )}
                                    </div>
                                </li>
                            ))}
                           </ul>
                        </div>
                    </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
    </ProtectedPage>
  );
}
