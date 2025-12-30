'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Paperclip,
  FileText,
  ImageIcon,
  Download,
  Check,
  Plus,
  MessageSquare,
  Calendar as CalendarIcon
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  projects,
  type Project,
  type Milestone,
  type ProjectTask,
  type Comment,
  type Attachment,
  staff,
} from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

const getFileIcon = (type: Attachment['type']) => {
  switch (type) {
    case 'image':
      return <ImageIcon className="h-5 w-5 text-primary" />;
    case 'pdf':
      return <FileText className="h-5 w-5 text-destructive" />;
    default:
      return <Paperclip className="h-5 w-5 text-muted-foreground" />;
  }
};

function TaskDetailClient({
    project,
    milestone,
    initialTask,
}: {
    project: Project;
    milestone: Milestone;
    initialTask: ProjectTask;
}) {
  const [task, setTask] = useState<ProjectTask>(initialTask);
  const [newComment, setNewComment] = useState('');

  const handleAddComment = () => {
      if (!newComment.trim()) return;
      const comment: Comment = {
        id: `C${Date.now()}`,
        author: 'Usuario Admin',
        avatarUrl: 'https://picsum.photos/seed/admin-avatar/40/40',
        text: newComment,
        timestamp: new Date().toLocaleString('es-CR'),
      };
      setTask(currentTask => ({
          ...currentTask,
          comments: [...(currentTask.comments || []), comment],
      }))
      setNewComment('');
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href={`/dashboard/tareas/${project.id}/${milestone.id}`}>
                <ArrowLeft className="h-4 w-4" />
                </Link>
            </Button>
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Detalle de la Tarea</h1>
                <CardDescription>Editando la tarea dentro del hito "{milestone.title}"</CardDescription>
            </div>
            </div>
            <Button>Guardar Cambios</Button>
        </div>
    
        <Card>
            <CardContent className="space-y-6 p-6">
                <div className="grid grid-cols-3 gap-6">
                    <div className="col-span-2 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="task-name">Nombre de tarea</Label>
                            <Input id="task-name" defaultValue={task.title} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="task-description">Descripción</Label>
                            <Textarea id="task-description" defaultValue={task.details} placeholder="Añade una descripción más detallada para esta tarea." rows={5}/>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="task-milestone">Hito</Label>
                            <Select defaultValue={task.milestoneId}>
                                <SelectTrigger id="task-milestone">
                                    <SelectValue placeholder="Seleccionar hito" />
                                </SelectTrigger>
                                <SelectContent>
                                    {project.milestones.map(m => (
                                        <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="task-priority">Prioridad</Label>
                            <Select defaultValue={task.priority}>
                                <SelectTrigger id="task-priority">
                                    <SelectValue placeholder="Establecer prioridad" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Alta">Alta</SelectItem>
                                    <SelectItem value="Media">Media</SelectItem>
                                    <SelectItem value="Baja">Baja</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>Fecha de inicio</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {format(new Date(task.startDate), 'dd/MM/yyyy')}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={new Date(task.startDate)} />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="space-y-2">
                        <Label>Fecha final</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {format(new Date(task.dueDate), 'dd/MM/yyyy')}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={new Date(task.dueDate)} />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <div>
                    <Label>Miembros de tareas</Label>
                    <p className="text-sm text-muted-foreground">Selecciona el responsable de esta tarea.</p>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                        {staff.map(member => (
                            <div key={member.id} className="flex items-center justify-between rounded-lg border p-3">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={member.avatarUrl} />
                                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium">{member.name}</p>
                                        <p className="text-sm text-muted-foreground">{member.email}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon">
                                    {task.assignedTo === member.name ? (
                                        <Check className="h-5 w-5 text-primary" />
                                    ) : (
                                        <Plus className="h-5 w-5 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                <Separator />

                <div>
                <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Archivos Adjuntos
                </h4>
                <div className="space-y-2">
                    {task.attachments && task.attachments.length > 0 ? (
                    task.attachments.map((file) => (
                        <div
                        key={file.id}
                        className="flex items-center justify-between rounded-md border p-2"
                        >
                        <div className="flex items-center gap-3">
                            {getFileIcon(file.type)}
                            <div>
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                                {file.size}
                            </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon">
                            <Download className="h-4 w-4" />
                            <span className="sr-only">Descargar</span>
                        </Button>
                        </div>
                    ))
                    ) : (
                    <p className="text-sm text-muted-foreground">
                        No hay archivos adjuntos.
                    </p>
                    )}
                </div>
                <Button variant="outline" className="mt-4 w-full">
                    <Plus className="mr-2 h-4 w-4" /> Subir Archivo
                </Button>
                </div>

                <Separator />

                <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Comentarios
                </h4>
                <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                    {task.comments?.length > 0 ? (
                    task.comments.map((comment) => (
                        <div key={comment.id} className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 border">
                            <AvatarImage src={comment.avatarUrl} />
                            <AvatarFallback>
                            {comment.author.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 rounded-md bg-muted/50 p-2">
                            <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold">
                                {comment.author}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {comment.timestamp}
                            </p>
                            </div>
                            <p className="text-sm mt-1">{comment.text}</p>
                        </div>
                        </div>
                    ))
                    ) : (
                    <p className="text-sm text-muted-foreground">
                        No hay comentarios aún.
                    </p>
                    )}
                </div>
                <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 border">
                        <AvatarImage src="https://picsum.photos/seed/admin-avatar/40/40" />
                        <AvatarFallback>A</AvatarFallback>
                    </Avatar>
                    <Textarea
                        id="new-comment"
                        placeholder="Escribe un comentario..."
                        rows={2}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1"
                    />
                    <Button onClick={handleAddComment}>Comentar</Button>
                </div>
                </div>
            </CardContent>
        </Card>
    </div>
  )
}

export default function TaskDetailPage({ params }: { params: { id: string, milestoneId: string, taskId: string } }) {
    const project = projects.find((p) => p.id === params.id);
    const milestone = project?.milestones.find(m => m.id === params.milestoneId);
    const task = milestone?.tasks.find(t => t.id === params.taskId);
  
    if (!project || !milestone || !task) {
      return (
        <div className="text-center">
          <p className="text-lg">Tarea no encontrada</p>
          <Button asChild className="mt-4">
            <Link href={`/dashboard/tareas/${params.id}`}>Volver al Proyecto</Link>
          </Button>
        </div>
      );
    }
  
    return <TaskDetailClient project={project} milestone={milestone} initialTask={task} />;
}
