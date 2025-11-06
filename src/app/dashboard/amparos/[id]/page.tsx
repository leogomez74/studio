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
    { name: "Prueba_Contrato.pdf", type: "pdf", size: "2.3 MB" },
    { name: "Evidencia_Foto.jpg", type: "image", size: "1.1 MB" },
    { name: "Documentos_Adicionales.zip", type: "zip", size: "5.8 MB" },
  ];
  
  const messages = [
    {
      sender: "Cliente",
      avatar: "https://picsum.photos/seed/avatar1/40/40",
      text: "Buenos días, adjunto los documentos que me solicitaron. ¿Necesitan algo más?",
      time: "Ayer a las 10:30 AM",
    },
    {
      sender: "Abogado",
      avatar: "https://picsum.photos/seed/admin-avatar/40/40",
      text: "Recibido, gracias. Lo revisaremos y le informaremos cualquier novedad. Saludos.",
      time: "Ayer a las 11:15 AM",
    },
    {
        sender: "Cliente",
        avatar: "https://picsum.photos/seed/avatar1/40/40",
        text: "Perfecto, quedo a la espera. Muchas gracias.",
        time: "Ayer a las 11:20 AM",
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
  
  // Esta es la página de detalle de un caso específico.
  export default function CaseDetailPage({ params }: { params: { id: string } }) {
    // Buscamos el caso específico en nuestros datos usando el 'id' de la URL.
    const caseItem = cases.find((c) => c.id === params.id.toUpperCase());
  
    // Si no se encuentra el caso, mostramos un mensaje.
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
  
    return (
      <div className="space-y-6">
        {/* Encabezado con botón para volver a la lista de casos */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/amparos">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver a Amparos</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Detalles del Amparo: {caseItem.id}</h1>
        </div>
  
        {/* Grid para organizar las tarjetas de información. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          
          {/* Columna principal con detalles, generador y pruebas (60%) */}
          <div className="space-y-6 lg:col-span-3">
             <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle>{caseItem.title}</CardTitle>
                        <CardDescription>Cliente: {caseItem.clientName}</CardDescription>
                    </div>
                    <Badge variant={caseItem.status === 'Cerrado' ? 'destructive' : 'default'}>
                        {caseItem.status}
                    </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium">Especialidad</h3>
                  <p className="text-muted-foreground">{caseItem.specialty}</p>
                </div>
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
                    <CardDescription>Crea los documentos legales necesarios para el caso.</CardDescription>
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
                <CardDescription>Archivos adjuntos relevantes para el caso.</CardDescription>
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