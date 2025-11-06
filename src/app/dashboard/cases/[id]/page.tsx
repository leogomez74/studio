// Importamos los componentes e íconos necesarios
"use client";
import React, { useState } from "react";
import {
  ArrowLeft,
  Paperclip,
  FileText,
  Image as ImageIcon,
  FileArchive,
  FileJson,
  BookUser,
  Shield,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
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
import { cases } from "@/lib/data";
import { CaseChat } from "@/components/case-chat";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


// Datos de ejemplo para los archivos y mensajes.
const files = [
  { name: "Prueba_Contrato.pdf", type: "pdf", size: "2.3 MB" },
  { name: "Evidencia_Foto.jpg", type: "image", size: "1.1 MB" },
  { name: "Documentos_Adicionales.zip", type: "zip", size: "5.8 MB" },
];

// Función para obtener el ícono correspondiente según el tipo de archivo.
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

// Esta es la página de detalle de un caso específico.
export default function CaseDetailPage({ params }: { params: { id: string } }) {
  const [isChatVisible, setIsChatVisible] = useState(true);
  // Buscamos el caso específico en nuestros datos usando el 'id' de la URL.
  const caseItem = cases.find((c) => c.id === params.id.toUpperCase());

  // Si no se encuentra el caso, mostramos un mensaje.
  if (!caseItem) {
    return (
      <div className="text-center">
        <p className="text-lg">Caso no encontrado</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/cases">Volver a Casos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado con botón para volver a la lista de casos */}
       <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/cases">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Volver a Casos</span>
            </Link>
            </Button>
            <h1 className="text-2xl font-semibold">
            Detalles del Caso: {caseItem.id}
            </h1>
        </div>
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => setIsChatVisible(!isChatVisible)}>
                        {isChatVisible ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                        <span className="sr-only">Toggle Chat</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{isChatVisible ? 'Ocultar Chat' : 'Mostrar Chat'}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </div>


      {/* Grid para organizar las tarjetas de información. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Columna principal con detalles del caso y pruebas */}
        <div className={isChatVisible ? "lg:col-span-3 space-y-6" : "lg:col-span-5 space-y-6"}>
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
                  <Badge
                    variant={
                      caseItem.status === "Cerrado" ? "destructive" : "default"
                    }
                  >
                    {caseItem.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
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

        {isChatVisible && (
            <div className="lg:col-span-2 space-y-6">
                <Card className="h-[calc(100vh-12rem)]">
                    <CardHeader>
                        <CardTitle>Chat del Caso: {caseItem.id}</CardTitle>
                    </CardHeader>
                    <CaseChat conversationId="CONV03" />
                </Card>
            </div>
        )}
      </div>
    </div>
  );
}
