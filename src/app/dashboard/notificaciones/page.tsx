// Importamos componentes e íconos necesarios.
// 'use client' indica que es un componente de cliente para permitir interactividad (menús).
'use client';
import React from 'react';
import { MoreHorizontal, AlertTriangle, Inbox } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Importamos los datos de ejemplo.
import { judicialNotifications, undefinedNotifications, JudicialNotification, UndefinedNotification } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Función para obtener la variante de la insignia según el estado (leída/pendiente).
 * @param {'Leída' | 'Pendiente'} status - El estado de la notificación.
 * @returns {'secondary' | 'default'} La variante de color para el Badge.
 */
const getStatusVariant = (status: 'Leída' | 'Pendiente') => {
    switch (status) {
        case 'Leída': return 'secondary';
        case 'Pendiente': return 'default';
        default: return 'secondary';
    }
};

/**
 * Función para obtener la variante de la insignia según el tipo de acto judicial.
 * @param {JudicialNotification['acto']} acto - El tipo de acto judicial.
 * @returns {'destructive' | 'default' | 'secondary' | 'outline'} La variante de color para el Badge.
 */
const getActoVariant = (acto: JudicialNotification['acto']) => {
    switch (acto) {
        case 'Prevención': return 'destructive';
        case 'Con Lugar con Costas': return 'default';
        case 'Con Lugar sin Costas': return 'secondary';
        default: return 'outline';
    }
};

/**
 * Página principal de Notificaciones.
 * Organiza las notificaciones en dos pestañas: Judiciales e Indefinidas (correos sin clasificar).
 */
export default function NotificacionesPage() {
  return (
    <Tabs defaultValue="judiciales">
        <TabsList className="mb-4">
            <TabsTrigger value="judiciales">Notificaciones Judiciales</TabsTrigger>
            <TabsTrigger value="indefinidas">
                Notificaciones Indefinidas
                {/* Muestra un contador con las notificaciones indefinidas pendientes. */}
                <Badge variant="destructive" className="ml-2">{undefinedNotifications.length}</Badge>
            </TabsTrigger>
        </TabsList>
        <TabsContent value="judiciales">
            <Card>
            <CardHeader>
                <CardTitle>Notificaciones Judiciales</CardTitle>
                <CardDescription>
                Gestiona las notificaciones judiciales recibidas y clasificadas automáticamente.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <NotificationsTable notifications={judicialNotifications} />
            </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="indefinidas">
            <Card>
                <CardHeader>
                    <CardTitle>Notificaciones Indefinidas</CardTitle>
                    <CardDescription>
                        Estas notificaciones no pudieron ser procesadas automáticamente. Por favor, clasifíquelas para entrenar al sistema.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <UndefinedNotificationsTable notifications={undefinedNotifications} />
                </CardContent>
            </Card>
        </TabsContent>
    </Tabs>
  );
}

/**
 * Componente para la tabla de notificaciones judiciales.
 * Usamos React.memo para optimizar el rendimiento, evitando que se renderice si las props no cambian.
 * @param {{ notifications: JudicialNotification[] }} props - Las notificaciones a mostrar.
 */
const NotificationsTable = React.memo(function NotificationsTable({ notifications }: { notifications: JudicialNotification[] }) {
    return (
        <div className="relative w-full overflow-auto">
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Expediente</TableHead>
                    <TableHead>Acto</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Asignada a</TableHead>
                    <TableHead>
                        <span className="sr-only">Acciones</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {notifications.map((notification) => (
                <TableRow 
                    key={notification.id} 
                    className={cn(
                        "hover:bg-muted/50",
                        // Resalta en rojo las filas que son una 'Prevención'.
                        notification.acto === 'Prevención' && "bg-destructive/10 hover:bg-destructive/20"
                    )}
                >
                    <TableCell className="font-medium">{notification.expediente}</TableCell>
                    <TableCell>
                      <Badge variant={getActoVariant(notification.acto)}>
                        {notification.acto === 'Prevención' && <AlertTriangle className="mr-1 h-3 w-3" />}
                        {notification.acto}
                      </Badge>
                    </TableCell>
                    <TableCell>{notification.fecha}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(notification.status)}>{notification.status}</Badge>
                    </TableCell>
                    <TableCell>{notification.asignadaA}</TableCell>
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
                        <DropdownMenuItem>Ver Documento Adjunto</DropdownMenuItem>
                        <DropdownMenuItem>Marcar como Leída</DropdownMenuItem>
                        <DropdownMenuItem>Asignar a...</DropdownMenuItem>
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

/**
 * Componente para la tabla de notificaciones indefinidas (correos).
 * Usamos React.memo para optimizar el rendimiento.
 * @param {{ notifications: UndefinedNotification[] }} props - Las notificaciones a mostrar.
 */
const UndefinedNotificationsTable = React.memo(function UndefinedNotificationsTable({ notifications }: { notifications: UndefinedNotification[] }) {
    return (
        <div className="relative w-full overflow-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Asunto del Correo</TableHead>
                        <TableHead>Fecha de Recibido</TableHead>
                        <TableHead>Asignada a</TableHead>
                        <TableHead>
                            <span className="sr-only">Acciones</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {notifications.map((notification) => (
                        <TableRow key={notification.id} className="hover:bg-muted/50">
                            <TableCell>
                                <div className="font-medium flex items-center gap-2">
                                    <Inbox className="h-4 w-4 text-muted-foreground"/>
                                    {notification.subject}
                                </div>
                            </TableCell>
                            <TableCell>{notification.receivedDate}</TableCell>
                            <TableCell>{notification.assignedTo}</TableCell>
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
                                        <DropdownMenuItem>Ver Correo Original</DropdownMenuItem>
                                        <DropdownMenuItem>Clasificar y Entrenar</DropdownMenuItem>
                                        <DropdownMenuItem>Asignar a...</DropdownMenuItem>
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
