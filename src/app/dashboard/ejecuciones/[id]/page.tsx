// Importamos los componentes e íconos necesarios
import {
    ArrowLeft,
    Paperclip,
    Send,
    FileText,
    Image as ImageIcon,
    FileArchive,
    FileJson,
    BookUser,
    Shield,
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
  import { Textarea } from "@/components/ui/textarea";
  import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
  import { cases } from "@/lib/data";
  
  // Datos de ejemplo para los archivos y mensajes.
  const files = [
    { name: "Sentencia_Firme.pdf", type: "pdf", size: "1.5 MB" },
    { name: "Calculo_Intereses.xlsx", type: "zip", size: "350 KB" },
  ];
  
  const messages = [
    {
      sender: "Cliente",
      avatar: "https://picsum.photos/seed/avatar1/40/40",
      text: "Buenos días, ¿hay alguna novedad sobre el pago?",
      time: "Hoy a las 09:15 AM",
    },
    {
      sender: "Abogado",
      avatar: "https://picsum.photos/seed/admin-avatar/40/40",
      text: "Hola, estamos a la espera de la confirmación del tribunal. Le mantendremos informado.",
      time: "Hoy a las 09:30 AM",
    },
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
  
  // Esta es la página de detalle de una ejecución específica.
  export default function EjecucionDetailPage({ params }: { params: { id: string } }) {
    // Buscamos la ejecución específica en nuestros datos usando el 'id' de la URL.
    const caseItem = cases.find((c) => c.id.toLowerCase() === params.id.toLowerCase());
  
    // Si no se encuentra, mostramos un mensaje.
    if (!caseItem) {
      return (
        <div className="text-center">
          <p className="text-lg">Ejecución no encontrada</p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/ejecuciones">Volver a Ejecuciones</Link>
          </Button>
        </div>
      );
    }
  
    return (
      <div className="space-y-6">
        {/* Encabezado con botón para volver a la lista de ejecuciones */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/ejecuciones">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver a Ejecuciones</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Detalles de la Ejecución: {caseItem.id}</h1>
        </div>
  
        {/* Grid para organizar las tarjetas de información. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Columna principal con detalles de la ejecución y pruebas (60%) */}
          <div className="space-y-6 lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        {/* Se muestra el ID del caso ya que no hay título */}
                        <CardTitle>Ejecución de Sentencia {caseItem.id}</CardTitle>
                        <CardDescription>Cliente: {caseItem.clientName}</CardDescription>
                    </div>
                    <Badge variant={caseItem.status === 'Cerrado' ? 'destructive' : 'default'}>
                        {caseItem.status}
                    </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mostramos el ID del amparo original */}
                {caseItem.amparoId && (
                  <div>
                    <h3 className="font-medium">Amparo Original</h3>
                    <p className="text-muted-foreground">{caseItem.amparoId}</p>
                  </div>
                )}
                <div>
                  <h3 className="font-medium">Abogado Asignado</h3>
                  <p className="text-muted-foreground">{caseItem.assignedTo}</p>
                </div>
                <div>
                  <h3 className="font-medium">Última Actualización</h3>
                  <p className="text-muted-foreground">{caseItem.lastUpdate}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Generador de Documentos</CardTitle>
                    <CardDescription>Crea los documentos legales necesarios para la ejecución.</CardDescription>
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
                        Generar Ejecución
                    </Button>
                </CardContent>
            </Card>
  
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-5 w-5" />
                  Pruebas (Archivos)
                </CardTitle>
                <CardDescription>Archivos relevantes para el proceso de cobro.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {files.map((file) => (
                    <li key={file.name} className="flex items-center justify-between rounded-md border p-3">
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.type)}
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">{file.size}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Descargar</Button>
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
  
          {/* Columna lateral para el módulo de Helpdesk (chat) (40%) */}
          <div className="lg:col-span-2">
            <Card className="flex flex-col h-full">
              <CardHeader>
                <CardTitle>Helpdesk</CardTitle>
                <CardDescription>Comunicación con el cliente.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4 overflow-y-auto">
                {messages.map((msg, index) => (
                  <div key={index} className={`flex items-start gap-3 ${msg.sender === 'Abogado' ? 'justify-end' : ''}`}>
                     {msg.sender === 'Cliente' && (
                        <Avatar className="h-9 w-9 border">
                            <AvatarImage src={msg.avatar} />
                            <AvatarFallback>{msg.sender.charAt(0)}</AvatarFallback>
                        </Avatar>
                     )}
                    <div className={`flex flex-col ${msg.sender === 'Abogado' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-xs rounded-lg px-3 py-2 ${msg.sender === 'Abogado' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <p className="text-sm">{msg.text}</p>
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">{msg.time}</span>
                    </div>
                    {msg.sender === 'Abogado' && (
                        <Avatar className="h-9 w-9 border">
                            <AvatarImage src={msg.avatar} />
                            <AvatarFallback>{msg.sender.charAt(0)}</AvatarFallback>
                        </Avatar>
                    )}
                  </div>
                ))}
              </CardContent>
              <CardFooter className="border-t pt-4">
                <div className="relative w-full">
                  <Textarea placeholder="Escribe tu mensaje..." className="pr-16" />
                  <Button size="icon" className="absolute right-2 top-1/2 -translate-y-1/2">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    );
  }