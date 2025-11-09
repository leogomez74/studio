'use client';
import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { type Milestone, type ProjectTask } from '@/lib/data';
import { CheckCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * Componente que representa un único hito (Milestone) en el plan del proyecto.
 * @param {{ milestone: Milestone, onTaskToggle: (milestoneId: string, taskId: string) => void }} props
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
  // Calculamos el progreso del hito basándonos en las tareas completadas.
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
          <CardTitle className={cn('flex items-center gap-2', isCompleted && 'text-muted-foreground')}>
             {isCompleted ? <CheckCircle className="h-6 w-6 text-green-500" /> : <Circle className="h-6 w-6 text-primary" />}
            {milestone.title}
          </CardTitle>
          <Badge variant={isCompleted ? 'secondary' : 'default'}>
            {milestone.days}
          </Badge>
        </div>
        <CardDescription>{milestone.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mostramos la barra de progreso. */}
        <div>
           <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Progreso</span>
                <span>{completedTasks} de {totalTasks} tareas</span>
           </div>
           <Progress value={progress} aria-label={`Progreso del hito: ${progress.toFixed(0)}%`} />
        </div>
        {/* Lista de tareas para el hito. */}
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
                        onCheckedChange={(checked) => {
                            // Evitamos que el click en el checkbox abra el modal
                            event?.stopPropagation();
                            onTaskToggle(milestone.id, task.id);
                        }}
                        className="mt-1"
                    />
                    <div className="grid gap-1.5 leading-none">
                        <label
                        htmlFor={`task-${task.id}`}
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
  );
});
MilestoneCard.displayName = 'MilestoneCard';


export function ProjectPlanClient({ initialPlan }: { initialPlan: Milestone[] }) {
    const [plan, setPlan] = useState(initialPlan);
    const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);

    /**
     * Maneja el cambio de estado de una tarea (completada/no completada).
     * @param {string} milestoneId - El ID del hito al que pertenece la tarea.
     * @param {string} taskId - El ID de la tarea que se está cambiando.
     */
    const handleTaskToggle = (milestoneId: string, taskId: string) => {
      setPlan((currentPlan) =>
        currentPlan.map((milestone) => {
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
        })
      );
    };

    const handleSelectTask = (task: ProjectTask) => {
        setSelectedTask(task);
    }

    const handleDialogClose = () => {
        setSelectedTask(null);
    }

    return (
        <Dialog onOpenChange={(isOpen) => !isOpen && handleDialogClose()}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {plan.map((milestone) => (
                <MilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    onTaskToggle={handleTaskToggle}
                    onTaskSelect={handleSelectTask}
                />
                ))}
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
    )
}
