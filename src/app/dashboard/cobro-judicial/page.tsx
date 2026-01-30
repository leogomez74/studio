// 'use client' indica que este es un componente de cliente, necesario para menús interactivos y pestañas.
'use client';
import React from 'react';
import { MoreHorizontal, AlertTriangle, Inbox } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProtectedPage } from "@/components/ProtectedPage";
// $$$ CONECTOR MYSQL: Se importan los datos de ejemplo.
import { credits, Credit, judicialNotifications, JudicialNotification, undefinedNotifications, UndefinedNotification } from '@/lib/data'; 
import Link from 'next/link';
import { cn } from "@/lib/utils";

// --- TAB: Casos ---

/**
 * Componente que renderiza una única fila de la tabla de cobro judicial.
 */
const JudicialCreditTableRow = React.memo(function JudicialCreditTableRow({ credit }: { credit: Credit }) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link
          href={`/dashboard/cobro-judicial/${credit.operationNumber}`}
          className="hover:underline"
        >
          {credit.operationNumber}
        </Link>
      </TableCell>
      <TableCell>{credit.expediente}</TableCell>
      <TableCell>{credit.debtorName}</TableCell>
      <TableCell className="text-right font-mono">
        ₡{(credit.balance ?? 0).toLocaleString('de-DE')}
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
             <DropdownMenuItem asChild>
               <Link href={`/dashboard/cobro-judicial/${credit.operationNumber}`}>
                  Ver Detalle del Juicio
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>Ver Expediente</DropdownMenuItem>
            <DropdownMenuItem>Registrar Actuación</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});

// --- TAB: Notificaciones Judiciales ---

const getNotifStatusVariant = (status: 'Leída' | 'Pendiente') => {
    switch (status) {
        case 'Leída': return 'secondary';
        case 'Pendiente': return 'default';
        default: return 'secondary';
    }
};

const getActoVariant = (acto: JudicialNotification['acto']) => {
    switch (acto) {
        case 'Prevención': return 'destructive';
        case 'Con Lugar con Costas': return 'default';
        case 'Con Lugar sin Costas': return 'secondary';
        default: return 'outline';
    }
};

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
                      <Badge variant={getNotifStatusVariant(notification.status)}>{notification.status}</Badge>
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

// --- TAB: Notificaciones Indefinidas ---

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


/**
 * Componente principal de la página de Cobro Judicial.
 * Muestra una tabla con los créditos que han sido escalados a proceso judicial.
 */
export default function CobroJudicialPage() {
  // $$$ CONECTOR MYSQL: Se filtran los créditos. Esto será una consulta a la base de datos (SELECT * FROM creditos WHERE estado = 'En cobro judicial').
  const judicialCredits = credits.filter(
    (c) => c.status === 'En cobro judicial'
  );

  return (
    <ProtectedPage module="cobro_judicial">
      <Tabs defaultValue="casos">
        <TabsList className="mb-4">
            <TabsTrigger value="casos">Casos</TabsTrigger>
            <TabsTrigger value="notificaciones-judiciales">Notificaciones Judiciales</TabsTrigger>
            <TabsTrigger value="notificaciones-indefinidas">
                Notificaciones Indefinidas
                <Badge variant="destructive" className="ml-2">{undefinedNotifications.length}</Badge>
            </TabsTrigger>
        </TabsList>
        <TabsContent value="casos">
            <Card>
                <CardHeader>
                    <CardTitle>Casos en Cobro Judicial</CardTitle>
                    <CardDescription>
                    Módulo para la gestión de casos que han sido escalados a proceso judicial.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Operación</TableHead>
                        <TableHead>Expediente Judicial</TableHead>
                        <TableHead>Deudor</TableHead>
                        <TableHead className="text-right">Saldo Actual</TableHead>
                        <TableHead>
                            <span className="sr-only">Acciones</span>
                        </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {judicialCredits.map((credit) => (
                          <JudicialCreditTableRow key={credit.operationNumber} credit={credit} />
                        ))}
                    </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="notificaciones-judiciales">
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
        <TabsContent value="notificaciones-indefinidas">
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
    </ProtectedPage>
  );
}
