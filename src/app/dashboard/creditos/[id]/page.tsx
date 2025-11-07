// 'use client' indica que es un Componente de Cliente, permitiendo el uso de estado y efectos.
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
// $$$ CONECTOR MYSQL: Se importan datos de ejemplo. En una aplicación real, todos estos datos vendrían de la base de datos.
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

// $$$ CONECTOR MYSQL/ERP: Los archivos del crédito se obtendrán de un sistema de gestión de documentos o de la base de datos.
const files = [
  { name: 'Pagare_Firmado.pdf', type: 'pdf', size: '1.2 MB' },
  { name: 'Autorizacion_Deduccion.pdf', type: 'pdf', size: '800 KB' },
  { name: 'Cedula_Identidad.jpg', type: 'image', size: '1.5 MB' },
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
 * Componente que muestra las tareas asociadas a un crédito específico.
 * @param {{ creditId: string }} props - Propiedades, incluyendo el ID del crédito.
 */
function CreditTasks({ creditId }: { creditId: string }) {
  // $$$ CONECTOR MYSQL: Filtra las tareas. Esto será una consulta a la tabla de tareas (SELECT * FROM tareas WHERE id_credito = ...).
  const creditTasks = tasks.filter((task) => task.caseId === creditId);

  // Obtiene la URL del avatar del usuario asignado.
  const getAvatarUrl = (name: string) => {
    // $$$ CONECTOR MYSQL: Esto buscará en la tabla de usuarios/personal.
    const user = staff.find((s) => s.name === name);
    return user ? user.avatarUrl : undefined;
  };

  // Si no hay tareas, muestra un mensaje.
  if (creditTasks.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No hay tareas para este crédito.
      </div>
    );
  }

  // Muestra la lista de tareas.
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

/**
 * Página principal de detalle de un crédito.
 * @param {{ params: { id: string } }} props - Propiedades pasadas por Next.js, incluyendo el ID del crédito desde la URL.
 */
export default function CreditDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // Estado para controlar la visibilidad del panel lateral.
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  // $$$ CONECTOR MYSQL: Busca el crédito. Esto será una consulta a la base de datos (SELECT * FROM creditos WHERE id_operacion = ...).
  const credit = credits.find((c) => c.operationNumber === params.id);

  // Si no se encuentra el crédito, muestra un mensaje de error.
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
      {/* Encabezado de la página con botón de volver y título. */}
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
        {/* Botón para mostrar/ocultar el panel lateral. */}
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

      {/* Grid principal que organiza el contenido en columnas. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Columna principal que se expande si el panel lateral está oculto. */}
        <div
          className={
            isPanelVisible ? 'space-y-6 lg:col-span-3' : 'space-y-6 lg:col-span-5'
          }
        >
          {/* Tarjeta de información principal del crédito. */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>
                    {/* El nombre del deudor es un enlace a su perfil en la página de clientes. */}
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
                  {/* $$$ CONECTOR MYSQL: Al cambiar el valor de este selector, se debe ejecutar una actualización (UPDATE) en la base de datos. */}
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
              {/* $$$ CONECTOR ERP: Este botón podría iniciar un proceso de pago o liquidación en el ERP. */}
              <Button>
                Pago Anticipado
              </Button>
            </CardFooter>
          </Card>

          {/* Tarjeta para el generador de documentos. */}
          <Card>
            <CardHeader>
              <CardTitle>Generador de Documentos</CardTitle>
              <CardDescription>
                Crea los documentos y reportes necesarios para el crédito.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {/* $$$ CONECTOR ERP: La generación de estos documentos puede requerir datos del ERP o registrar la acción en él. */}
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

          {/* Tarjeta para los archivos del crédito. */}
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

        {/* Panel lateral que se muestra si isPanelVisible es true. */}
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
                  {/* El componente de chat cargará datos de la base de datos. */}
                  <CaseChat conversationId={credit.operationNumber} />
                </TabsContent>
                <TabsContent value="tareas" className="flex-1 overflow-y-auto">
                  {/* El componente de tareas cargará datos de la base de datos. */}
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
