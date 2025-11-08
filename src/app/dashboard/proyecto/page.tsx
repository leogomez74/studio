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
import { projectPlan, Milestone } from '@/lib/data';
import { CheckCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Componente que representa un único hito (Milestone) en el plan del proyecto.
 * @param {{ milestone: Milestone, onTaskToggle: (milestoneId: string, taskId: string) => void }} props
 */
const MilestoneCard = React.memo(function MilestoneCard({
  milestone,
  onTaskToggle,
}: {
  milestone: Milestone;
  onTaskToggle: (milestoneId: string, taskId: string) => void;
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
    <Card className={cn("transition-all", isCompleted && "bg-muted/60")}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className={cn("flex items-center gap-2", isCompleted && "text-muted-foreground")}>
             {isCompleted ? <CheckCircle className="h-6 w-6 text-green-500" /> : <Circle className="h-6 w-6 text-primary" />}
            {milestone.title}
          </CardTitle>
          <Badge variant={isCompleted ? "secondary" : "default"}>
            {milestone.days}
          </Badge>
        </div>
        <CardDescription>{milestone.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mostramos la barra de progreso. */}
        <div>
           <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progreso</span>
                <span>{completedTasks} de {totalTasks} tareas</span>
           </div>
           <Progress value={progress} aria-label={`Progreso del hito: ${progress.toFixed(0)}%`} />
        </div>
        {/* Lista de tareas para el hito. */}
        <div className="space-y-3">
          {milestone.tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <Checkbox
                id={`task-${task.id}`}
                checked={task.completed}
                onCheckedChange={() => onTaskToggle(milestone.id, task.id)}
                className="mt-1"
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor={`task-${task.id}`}
                  className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", task.completed && "text-muted-foreground line-through")}
                >
                  {task.title}
                </label>
                <p className="text-sm text-muted-foreground">
                  Entrega: {task.dueDate}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});


/**
 * Página principal del módulo de Proyecto.
 * Muestra los hitos del proyecto y permite marcar tareas como completadas.
 */
export default function ProyectoPage() {
  const [plan, setPlan] = useState(projectPlan);

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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Plan de Proyecto Backend</h1>
        <p className="text-muted-foreground">
          Seguimiento de hitos y tareas para el desarrollo del backend en Laravel.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {plan.map((milestone) => (
          <MilestoneCard
            key={milestone.id}
            milestone={milestone}
            onTaskToggle={handleTaskToggle}
          />
        ))}
      </div>
    </div>
  );
}
