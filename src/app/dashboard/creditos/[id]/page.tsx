'use client';
import React, { useState } from 'react';
import {
  ArrowLeft,
  Paperclip,
  FileText,
  FileJson,
  BookUser,
  Shield,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  ClipboardCheck,
  Receipt,
  FileBadge,
} from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { credits, tasks, staff, Task } from '@/lib/data';
import { CaseChat } from '@/components/case-chat';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const files = [
  { name: 'Pagare_Firmado.pdf', type: 'pdf', size: '1.2 MB' },
  { name: 'Autorizacion_Deduccion.pdf', type: 'pdf', size: '800 KB' },
  { name: 'Cedula_Identidad.jpg', type: 'image', size: '1.5 MB' },
];

const getFileIcon = (type: string) => {
  switch (type) {
    case 'pdf':
      return <FileText className="h-6 w-6 text-destructive" />;
    default:
      return <FileText className="h-6 w-6 text-muted-foreground" />;
  }
};

const getPriorityVariant = (priority: Task['priority']) => {
  switch (priority) {
    case 'Alta':
      return 'destructive';
    case 'Media':
      return 'default';
    case 'Baja':
      return 'secondary';
    default:
      return 'outline';
  }
};

function CreditTasks({ creditId }: { creditId: string }) {
  const creditTasks = tasks.filter((task) => task.caseId === creditId);

  const getAvatarUrl = (name: string) => {
    const user = staff.find((s) => s.name === name);
    return user ? user.avatarUrl : undefined;
  };

  if (creditTasks.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No hay tareas para este crédito.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-2">
      {creditTasks.map((task) => (
        <div key={task.id} className="rounded-lg border bg-muted/50 p-3">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium">{task.title}</p>
            <Badge variant={getPriorityVariant(task.priority)}>
              {task.priority}
            </Badge>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Avatar className="h-5 w-5">
              <AvatarImage src={getAvatarUrl(task.assignedTo)} />
              <AvatarFallback>{task.assignedTo.charAt(0)}</AvatarFallback>
            </Avatar>
            <span>{task.assignedTo}</span>
            <span>-</span>
            <span>Vence: {task.dueDate}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CreditDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const credit = credits.find((c) => c.operationNumber === params.id);

  if (!credit) {
    return (
      <div className="text-center">
        <p className="text-lg">Crédito no encontrado</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/creditos">Volver a Créditos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/creditos">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver a Créditos</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">
            Detalle del Crédito: {credit.operationNumber}
          </h1>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsPanelVisible(!isPanelVisible)}
              >
                {isPanelVisible ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle Panel</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isPanelVisible ? 'Ocultar Panel' : 'Mostrar Panel'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div
          className={
            isPanelVisible ? 'space-y-6 lg:col-span-3' : 'space-y-6 lg:col-span-5'
          }
        >
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>
                    <Link
                      href={`/dashboard/clientes?cedula=${credit.debtorId}`}
                      className="hover:underline"
                    >
                      {credit.debtorName}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    Institución: {credit.employer}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select defaultValue={credit.status}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Cambiar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Al día">Al día</SelectItem>
                      <SelectItem value="En mora">En mora</SelectItem>
                      <SelectItem value="Cancelado">Cancelado</SelectItem>
                      <SelectItem value="En cobro judicial">
                        En cobro judicial
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="grid gap-1">
                <h3 className="font-medium">Monto Otorgado</h3>
                <p className="text-muted-foreground">
                  ₡{credit.amount.toLocaleString('de-DE')}
                </p>
              </div>
              <div className="grid gap-1">
                <h3 className="font-medium">Saldo Actual</h3>
                <p className="font-semibold text-primary">
                  ₡{credit.balance.toLocaleString('de-DE')}
                </p>
              </div>
              <div className="grid gap-1">
                <h3 className="font-medium">Cuota Mensual</h3>
                <p className="text-muted-foreground">
                  ₡{credit.fee.toLocaleString('de-DE')}
                </p>
              </div>
              <div className="grid gap-1">
                <h3 className="font-medium">Tasa / Plazo</h3>
                <p className="text-muted-foreground">
                  {credit.rate}% / {credit.term} meses
                </p>
              </div>
              <div className="grid gap-1">
                <h3 className="font-medium">Cuotas Atrasadas</h3>
                <p className="font-semibold text-destructive">
                  {credit.overdueFees}
                </p>
              </div>
              <div className="grid gap-1">
                <h3 className="font-medium">Entidad Deductora</h3>
                <p className="text-muted-foreground">{credit.deductingEntity}</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button>
                Pago Anticipado
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generador de Documentos</CardTitle>
              <CardDescription>
                Crea los documentos y reportes necesarios para el crédito.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              <Button variant="outline">
                <FileJson className="mr-2 h-4 w-4" />
                Pagaré
              </Button>
              <Button variant="outline">
                <BookUser className="mr-2 h-4 w-4" />
                Autorización Deducción
              </Button>
              <Button variant="outline">
                <Receipt className="mr-2 h-4 w-4" />
                Estado de Cuenta
              </Button>
              <Button variant="outline">
                <FileBadge className="mr-2 h-4 w-4" />
                Certificación de Deuda
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Archivos del Crédito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {files.map((file) => (
                  <li
                    key={file.name}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.type)}
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {file.size}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Descargar
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full">
                <Paperclip className="mr-2 h-4 w-4" />
                Subir Nuevo Archivo
              </Button>
            </CardFooter>
          </Card>
        </div>

        {isPanelVisible && (
          <div className="space-y-6 lg:col-span-2">
            <Card className="h-[calc(100vh-12rem)]">
              <Tabs defaultValue="comunicaciones" className="flex h-full flex-col">
                <TabsList className="m-2">
                  <TabsTrigger value="comunicaciones" className="gap-1">
                    <MessageSquare className="h-4 w-4" />
                    Comunicaciones
                  </TabsTrigger>
                  <TabsTrigger value="tareas" className="gap-1">
                    <ClipboardCheck className="h-4 w-4" />
                    Tareas
                  </TabsTrigger>
                </TabsList>
                <TabsContent
                  value="comunicaciones"
                  className="flex-1 overflow-y-auto"
                >
                  <CaseChat conversationId={credit.operationNumber} />
                </TabsContent>
                <TabsContent value="tareas" className="flex-1 overflow-y-auto">
                  <CreditTasks creditId={credit.operationNumber} />
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
