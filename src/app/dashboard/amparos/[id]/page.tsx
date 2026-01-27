// Importamos los componentes e íconos necesarios para construir la página de detalle.
// 'use client' indica que este es un Componente de Cliente, lo que nos permite usar 'useState' para manejar el estado.
"use client";
import React, { useState } from "react";
import {
  ArrowLeft,
  Paperclip,
  FileText,
  ImageIcon,
  FileArchive,
  FileJson,
  BookUser,
  Shield,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  ClipboardCheck,
} from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cases, tasks, staff, Task } from "@/lib/data"; // Importamos los datos de ejemplo.
import { CaseChat } from "@/components/case-chat";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


// Datos de ejemplo para los archivos. En una aplicación real, esto vendría de una base de datos.
const files = [
  { name: "Prueba_Contrato.pdf", type: "pdf", size: "2.3 MB" },
  { name: "Evidencia_Foto.jpg", type: "image", size: "1.1 MB" },
  { name: "Documentos_Adicionales.zip", type: "zip", size: "5.8 MB" },
];

/**
 * Función para obtener el ícono correspondiente según el tipo de archivo.
 * @param {string} type - El tipo de archivo (ej: 'pdf', 'image').
 * @returns {React.ReactNode} El componente de ícono correspondiente.
 */
const getFileIcon = (type: string) => {
  switch (type) {
    case "pdf":
      return <FileText className="h-6 w-6 text-destructive" />;
    case "image":
      return <ImageIcon className="h-6 w-6 text-primary" />;
    default:
      return <FileArchive className="h-6 w-6 text-muted-foreground" />;
  }
};

/**
 * Función para obtener el estilo de la insignia (Badge) según la prioridad de la tarea.
 * @param {Task['priority']} priority - La prioridad de la tarea ('Alta', 'Media', 'Baja').
 * @returns {'destructive' | 'default' | 'secondary' | 'outline'} La variante de color para el Badge.
 */
const getPriorityVariant = (priority: Task['priority']) => {
    switch (priority) {
        case 'Alta': return 'destructive';
        case 'Media': return 'default';
        case 'Baja': return 'secondary';
        default: return 'outline';
    }
}

/**
 * Componente que muestra la lista de tareas asociadas a un caso específico.
 * @param {{ caseId: string }} props - Propiedades del componente, incluyendo el ID del caso.
 */
function CaseTasks({ caseId }: { caseId: string }) {
    // Filtramos las tareas para obtener solo las que pertenecen a este caso.
    const caseTasks = tasks.filter(task => task.caseId === caseId);

    // Función para obtener la URL del avatar de un miembro del personal por su nombre.
    const getAvatarUrl = (name: string) => {
        const user = staff.find(s => s.name === name);
        return user ? user.avatarUrl : undefined;
    };

    // Si no hay tareas, mostramos un mensaje.
    if (caseTasks.length === 0) {
        return <div className="text-center text-sm text-muted-foreground p-4">No hay tareas para este caso.</div>
    }

    // Si hay tareas, las mostramos en una lista.
    return (
        <div className="space-y-3 p-2">
            {caseTasks.map(task => (
                <div key={task.id} className="border p-3 rounded-lg bg-muted/50">
                    <div className="flex justify-between items-start">
                        <p className="font-medium text-sm">{task.title}</p>
                        <Badge variant={getPriorityVariant(task.priority)}>{task.priority}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
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
    )
}

function CaseDetailClient({ caseItem }: { caseItem: (typeof cases)[0] | undefined }) {
  // Estado para controlar la visibilidad del panel lateral de chat y tareas.
  const [isChatVisible, setIsChatVisible] = useState(false);

  // Si no se encuentra el caso, mostramos un mensaje y un botón para volver.
  if (!caseItem) {
    return (
      <div className="text-center">
        <p className="text-lg">Amparo no encontrado</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/amparos">Volver a Amparos</Link>
        </Button>
      </div>
    );
  }

  // Renderizamos la página de detalle del caso.
  return (
    <div className="space-y-6">
      {/* Encabezado con botón para volver, título y botón para mostrar/ocultar el panel lateral. */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/amparos">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Volver a Amparos</span>
            </Link>
            </Button>
            <h1 className="text-2xl font-semibold">
            Detalles del Amparo: {caseItem.id}
            </h1>
        </div>
        {/* El TooltipProvider es necesario para que los tooltips (mensajes emergentes) funcionen. */}
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    {/* Este botón cambia el estado 'isChatVisible' para mostrar u ocultar el panel. */}
                    <Button variant="outline" size="icon" onClick={() => setIsChatVisible(!isChatVisible)}>
                        {isChatVisible ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                        <span className="sr-only">Toggle Chat</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{isChatVisible ? 'Ocultar Panel' : 'Mostrar Panel'}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </div>

      {/* Grid principal que organiza el contenido en columnas. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Columna principal con detalles, generador y pruebas. Su ancho cambia si el chat está visible. */}
        <div className={isChatVisible ? "lg:col-span-3 space-y-6" : "lg:col-span-5 space-y-6"}>
          {/* Tarjeta con la información principal del caso. */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{caseItem.title}</CardTitle>
                  <CardDescription>
                    Cliente: {caseItem.clientName}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                   <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard/comunicaciones">
                            <MessageSquare className="mr-2 h-4 w-4"/>
                            Abrir en Comunicaciones
                        </Link>
                    </Button>
                  {/* Selector para cambiar el estado del caso. */}
                  <Select defaultValue={caseItem.status}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Cambiar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Presentado">Presentado</SelectItem>
                      <SelectItem value="Con curso">Con curso</SelectItem>
                      <SelectItem value="Rechazo de plano">Rechazo de plano</SelectItem>
                      <SelectItem value="Con lugar con costas">Con lugar con costas</SelectItem>
                      <SelectItem value="Con lugar sin costas">Con lugar sin costas</SelectItem>
                      <SelectItem value="Sentencia">Sentencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="grid gap-1">
                <h3 className="font-medium">Especialidad</h3>
                <p className="text-muted-foreground">{caseItem.specialty}</p>
              </div>
              <div className="grid gap-1">
                <h3 className="font-medium">Abogado Asignado</h3>
                <p className="text-muted-foreground">{caseItem.assignedTo}</p>
              </div>
              <div className="grid gap-1">
                <h3 className="font-medium">Última Actualización</h3>
                <p className="text-muted-foreground">{caseItem.lastUpdate}</p>
              </div>
            </CardContent>
          </Card>

          {/* Tarjeta para el generador de documentos. */}
          <Card>
            <CardHeader>
              <CardTitle>Generador de Documentos</CardTitle>
              <CardDescription>
                Crea los documentos legales necesarios para el caso.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Button variant="outline">
                <FileJson className="mr-2 h-4 w-4" />
                Generar Contrato
              </Button>
              <Button variant="outline">
                <BookUser className="mr-2 h-4 w-4" />
                Generar Poder
              </Button>
              <Button variant="outline">
                <Shield className="mr-2 h-4 w-4" />
                Generar Amparo
              </Button>
            </CardContent>
          </Card>

          {/* Tarjeta para mostrar los archivos adjuntos (pruebas). */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Pruebas (Archivos)
              </CardTitle>
              <CardDescription>
                Archivos adjuntos relevantes para el caso.
              </CardDescription>
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

        {/* Columna derecha para el chat y tareas. Solo se muestra si 'isChatVisible' es true. */}
        {isChatVisible && (
            <div className="lg:col-span-2 space-y-6">
                <Card className="h-[calc(100vh-12rem)]">
                    <Tabs defaultValue="comunicaciones" className="flex flex-col h-full">
                         <TabsList className="m-2">
                            <TabsTrigger value="comunicaciones" className="gap-1">
                                <MessageSquare className="h-4 w-4"/>
                                Comunicaciones
                            </TabsTrigger>
                            <TabsTrigger value="tareas" className="gap-1">
                                <ClipboardCheck className="h-4 w-4"/>
                                Tareas
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="comunicaciones" className="flex-1 overflow-y-auto">
                             {/* El componente CaseChat maneja la lógica del chat. */}
                             <CaseChat conversationId="CONV01" />
                        </TabsContent>
                        <TabsContent value="tareas" className="flex-1 overflow-y-auto">
                            {/* El componente CaseTasks muestra las tareas del caso. */}
                            <CaseTasks caseId={caseItem.id} />
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
 * Esta es la página de detalle de un caso de amparo específico.
 * Se encarga de mostrar toda la información relevante de un amparo.
 * @param {{ params: { id: string } }} props - Las propiedades que Next.js pasa a la página, incluyendo el 'id' del amparo desde la URL.
 */
export default function CaseDetailPage({ params }: { params: { id: string } }) {
  // Buscamos el caso específico en nuestros datos usando el 'id' de la URL.
  // Convertimos el id a mayúsculas para asegurar la coincidencia.
  const caseItem = cases.find((c) => c.id === params.id.toUpperCase());
  return <CaseDetailClient caseItem={caseItem} />
}
