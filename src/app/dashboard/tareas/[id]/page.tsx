'use client';
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  PlusCircle,
  ListTodo,
  ClipboardCheck,
  CheckCircle,
  Circle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { projects, type Project, type Milestone, type ProjectTask } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


/**
 * Componente que representa un único hito (Milestone) en el plan del proyecto.
 */
const MilestoneCard = React.memo(function MilestoneCard({
  milestone,
  onTaskToggle,
  onTaskSelect,
}: {
  milestone: Milestone;
  onTaskToggle: (milestoneId: string, taskId: string) => void;
  onTaskSelect: (task: ProjectTask) => void;
}) {
  const completedTasks = useMemo(
    () => milestone.tasks.filter((task) => task.completed).length,
    [milestone.tasks]
  );
  const totalTasks = milestone.tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const isCompleted = progress === 100;

  return (
    <Card className={cn('transition-all', isCompleted && 'bg-muted/60')}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle
            className={cn(
              'flex items-center gap-2',
              isCompleted && 'text-muted-foreground'
            )}
          >
            {isCompleted ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <Circle className="h-6 w-6 text-primary" />
            )}
            {milestone.title}
          </CardTitle>
          <Badge variant={isCompleted ? 'secondary' : 'default'}>
            {milestone.days}
          </Badge>
        </div>
        <CardDescription>{milestone.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Progreso</span>
            <span>
              {completedTasks} de {totalTasks} tareas
            </span>
          </div>
          <Progress
            value={progress}
            aria-label={`Progreso del hito: ${progress.toFixed(0)}%`}
          />
        </div>
        <div className="space-y-3">
          {milestone.tasks.map((task) => (
            <DialogTrigger key={task.id} asChild>
              <div
                onClick={() => onTaskSelect(task)}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all hover:bg-muted/50"
              >
                <Checkbox
                  id={`task-${task.id}`}
                  checked={task.completed}
                  onCheckedChange={() => {
                    event?.stopPropagation();
                    onTaskToggle(milestone.id, task.id);
                  }}
                  className="mt-1"
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor={`task-${task.id}`}
                    className={cn(
                      'cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                      task.completed && 'text-muted-foreground line-through'
                    )}
                  >
                    {task.title}
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Entrega: {task.dueDate}
                  </p>
                </div>
              </div>
            </DialogTrigger>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
MilestoneCard.displayName = 'MilestoneCard';

/**
 * Componente principal para la página de detalle de un proyecto.
 */
export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | undefined>(
    projects.find((p) => p.id === params.id)
  );
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);

  if (!project) {
    return (
      <div className="text-center">
        <p className="text-lg">Proyecto no encontrado</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/tareas">Volver a Proyectos</Link>
        </Button>
      </div>
    );
  }

  const handleTaskToggle = (milestoneId: string, taskId: string) => {
    setProject((currentProject) => {
      if (!currentProject) return undefined;
      const updatedMilestones = currentProject.milestones.map((milestone) => {
        if (milestone.id === milestoneId) {
          return {
            ...milestone,
            tasks: milestone.tasks.map((task) => {
              if (task.id === taskId) {
                return { ...task, completed: !task.completed };
              }
              return task;
            }),
          };
        }
        return milestone;
      });
      return { ...currentProject, milestones: updatedMilestones };
    });
  };

    const handleSelectTask = (task: ProjectTask) => {
        setSelectedTask(task);
    }

    const handleDialogClose = () => {
        setSelectedTask(null);
    }
    
  const overallProgress = useMemo(() => {
    const totalTasks = project.milestones.reduce((acc, m) => acc + m.tasks.length, 0);
    if (totalTasks === 0) return 0;
    const completedTasks = project.milestones.reduce((acc, m) => acc + m.tasks.filter(t => t.completed).length, 0);
    return (completedTasks / totalTasks) * 100;
  }, [project]);


  return (
     <Dialog onOpenChange={(isOpen) => !isOpen && handleDialogClose()}>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/dashboard/tareas">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Avatar className="h-6 w-6">
                    <AvatarImage src={project.leaderAvatar} />
                    <AvatarFallback>{project.leader.charAt(0)}</AvatarFallback>
                </Avatar>
                <span>Liderado por {project.leader}</span>
              </div>
            </div>
          </div>
           <div className="flex items-center gap-2">
            <Button variant="outline">
              <PlusCircle className="mr-2 h-4 w-4" />
              Crear Hito
            </Button>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Agregar Tarea
            </Button>
          </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Resumen del Proyecto</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <h3 className="font-medium text-muted-foreground">Progreso Total</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <Progress value={overallProgress} className="h-2 w-full" />
                        <span className="text-sm font-semibold">{overallProgress.toFixed(0)}%</span>
                    </div>
                </div>
                 <div>
                    <h3 className="font-medium text-muted-foreground">Presupuesto</h3>
                    <p className="font-semibold text-lg">${project.budget.toLocaleString('en-US')}</p>
                </div>
                <div>
                    <h3 className="font-medium text-muted-foreground">Fechas Clave</h3>
                    <p className="text-sm">Inicio: {project.startDate} | Fin: {project.endDate}</p>
                </div>
            </CardContent>
        </Card>

        <Tabs defaultValue="hitos">
          <TabsList>
            <TabsTrigger value="hitos" className="gap-1">
                <ListTodo className="h-4 w-4"/>
                Hitos
            </TabsTrigger>
            <TabsTrigger value="tareas" className="gap-1">
                <ClipboardCheck className="h-4 w-4"/>
                Todas las Tareas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="hitos">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {project.milestones.map((milestone) => (
                <MilestoneCard
                  key={milestone.id}
                  milestone={milestone}
                  onTaskToggle={handleTaskToggle}
                  onTaskSelect={handleSelectTask}
                />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="tareas">
            <Card>
                <CardHeader>
                    <CardTitle>Todas las Tareas del Proyecto</CardTitle>
                    <CardDescription>Lista completa de tareas de todos los hitos.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                    {project.milestones.flatMap(m => m.tasks).map((task) => (
                         <DialogTrigger key={task.id} asChild>
                            <div
                                onClick={() => handleSelectTask(task)}
                                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all hover:bg-muted/50"
                            >
                                <Checkbox
                                    id={`all-task-${task.id}`}
                                    checked={task.completed}
                                    onCheckedChange={(checked) => {
                                        const milestone = project.milestones.find(m => m.tasks.some(t => t.id === task.id));
                                        if (milestone) {
                                            event?.stopPropagation();
                                            handleTaskToggle(milestone.id, task.id);
                                        }
                                    }}
                                    className="mt-1"
                                />
                                <div className="grid flex-1 gap-1.5 leading-none">
                                    <label
                                    htmlFor={`all-task-${task.id}`}
                                    className={cn('cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', task.completed && 'text-muted-foreground line-through')}
                                    >
                                    {task.title}
                                    </label>
                                    <p className="text-sm text-muted-foreground">
                                    Entrega: {task.dueDate}
                                    </p>
                                </div>
                            </div>
                        </DialogTrigger>
                    ))}
                    </div>
                </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
       {selectedTask && (
            <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>{selectedTask.title}</DialogTitle>
                <DialogDescription>
                    Entrega: {selectedTask.dueDate}
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedTask.details}</p>
            </div>
        </DialogContent>
    )}
    </Dialog>
  );
}
