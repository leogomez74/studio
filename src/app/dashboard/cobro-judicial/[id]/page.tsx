// 'use client' indica que es un Componente de Cliente, permitiendo el uso de estado y efectos.
'use client';
import React, { useState } from 'react';
import {
  ArrowLeft,
  Paperclip,
  FileText,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  ClipboardCheck,
  FileJson,
  Shield,
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
// $$$ CONECTOR MYSQL: Se importan datos de ejemplo. En una aplicación real, todos estos datos vendrían de la base de datos.
import { credits, tasks, staff, Task, type Credit } from '@/lib/data'; 
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

// $$$ CONECTOR MYSQL/ERP: Los archivos del caso se obtendrán de un sistema de gestión de documentos o de la base de datos.
const files = [
  { name: 'Demanda_Presentada.pdf', type: 'pdf', size: '2.1 MB' },
  { name: 'Prueba_Documental_01.pdf', type: 'pdf', size: '5.8 MB' },
];

/**
 * Función para obtener el ícono de archivo según su tipo.
 * @param {string} type - Tipo de archivo ('pdf', 'image', etc.).
 * @returns {React.ReactNode} El componente de ícono.
 */
const getFileIcon = (type: string) => {
  switch (type) {
    case 'pdf':
      return <FileText className="h-6 w-6 text-destructive" />;
    default:
      return <FileText className="h-6 w-6 text-muted-foreground" />;
  }
};

/**
 * Función para obtener la variante de color de la insignia según la prioridad de la tarea.
 * @param {Task['priority']} priority - Prioridad de la tarea.
 * @returns {'destructive' | 'default' | 'secondary' | 'outline'} La variante de color.
 */
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

/**
 * Componente que muestra las tareas asociadas a un caso de cobro judicial.
 * @param {{ caseId: string }} props - Propiedades, incluyendo el ID del caso (número de operación).
 */
function JudicialCaseTasks({ caseId }: { caseId: string }) {
  // $$$ CONECTOR MYSQL: Filtra las tareas. Esto será una consulta a la tabla de tareas (SELECT * FROM tareas WHERE id_caso = ...).
  const caseTasks = tasks.filter((task) => task.caseId === caseId);

  const getAvatarUrl = (name: string) => {
    const user = staff.find((s) => s.name === name);
    return user ? user.avatarUrl : undefined;
  };

  if (caseTasks.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No hay tareas para este caso.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-2">
      {caseTasks.map((task) => (
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

function JudicialCaseDetailClient({ judicialCase }: { judicialCase: Credit | undefined }) {
  const [isPanelVisible, setIsPanelVisible] = useState(false);

  if (!judicialCase) {
    return (
      <div className="text-center">
        <p className="text-lg">Caso de Cobro Judicial no encontrado</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/cobro-judicial">Volver a Cobro Judicial</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/cobro-judicial">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver a Cobro Judicial</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">
            Detalle del Juicio: {judicialCase.expediente}
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
                    Deudor: {judicialCase.debtorName}
                  </CardTitle>
                  <CardDescription>
                    Expediente Judicial: {judicialCase.expediente} | Operación: {judicialCase.operationNumber}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select defaultValue="En trámite">
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Cambiar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Presentado">Presentado</SelectItem>
                      <SelectItem value="En trámite">En trámite</SelectItem>
                      <SelectItem value="Con sentencia">Con sentencia</SelectItem>
                      <SelectItem value="Abandonado">Abandonado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="grid gap-1">
                <h3 className="font-medium">Saldo en Mora</h3>
                <p className="font-semibold text-primary">
                  ₡{(judicialCase.balance ?? 0).toLocaleString('de-DE')}
                </p>
              </div>
               <div className="grid gap-1">
                <h3 className="font-medium">Días de Atraso</h3>
                <p className="font-semibold text-destructive">
                  {judicialCase.daysInArrears}
                </p>
              </div>
              <div className="grid gap-1">
                <h3 className="font-medium">Institución</h3>
                <p className="text-muted-foreground">{judicialCase.employer}</p>
              </div>
            </CardContent>
             <CardFooter>
              <Button asChild variant="outline">
                <Link href={`/dashboard/creditos/${judicialCase.operationNumber}`}>Ver Crédito Original</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generador de Documentos</CardTitle>
              <CardDescription>
                Crea los documentos legales necesarios para el juicio.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Button variant="outline">
                <FileJson className="mr-2 h-4 w-4" />
                Escrito de Demanda
              </Button>
              <Button variant="outline">
                <FileJson className="mr-2 h-4 w-4" />
                Notificación
              </Button>
              <Button variant="outline">
                <Shield className="mr-2 h-4 w-4" />
                Solicitud de Embargo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Archivos del Caso
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
                  <CaseChat conversationId={judicialCase.operationNumber ?? ''} />
                </TabsContent>
                <TabsContent value="tareas" className="flex-1 overflow-y-auto">
                  <JudicialCaseTasks caseId={judicialCase.operationNumber ?? ''} />
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Página de detalle de un caso de Cobro Judicial.
 * @param {{ params: { id: string } }} props - Propiedades pasadas por Next.js, incluyendo el ID del caso desde la URL.
 */
export default function JudicialCaseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // $$$ CONECTOR MYSQL: Busca el caso. Esto será una consulta a la base de datos.
  const judicialCase = credits.find((c) => c.operationNumber === params.id && c.status === 'En cobro judicial');
  return <JudicialCaseDetailClient judicialCase={judicialCase} />;
}
