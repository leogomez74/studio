'use client';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { projects, type Project } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MilestoneSummaryCard } from '@/components/milestone-summary-card';

function ProjectDetailClient({ project }: { project: Project }) {
  const overallProgress = useMemo(() => {
    const totalTasks = project.milestones.reduce(
      (acc, m) => acc + m.tasks.length,
      0
    );
    if (totalTasks === 0) return 0;
    const completedTasks = project.milestones.reduce(
      (acc, m) => acc + m.tasks.filter((t) => t.completed).length,
      0
    );
    return (completedTasks / totalTasks) * 100;
  }, [project]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/tareas">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {project.name}
            </h1>
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
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Hito
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumen del Proyecto</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <h3 className="font-medium text-muted-foreground">Progreso Total</h3>
            <div className="mt-1 flex items-center gap-2">
              <Progress value={overallProgress} className="h-2 w-full" />
              <span className="text-sm font-semibold">
                {overallProgress.toFixed(0)}%
              </span>
            </div>
          </div>
          <div>
            <h3 className="font-medium text-muted-foreground">Presupuesto</h3>
            <p className="text-lg font-semibold">
              ${project.budget.toLocaleString('en-US')}
            </p>
          </div>
          <div>
            <h3 className="font-medium text-muted-foreground">Fechas Clave</h3>
            <p className="text-sm">
              Inicio: {project.startDate} | Fin: {project.endDate}
            </p>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Hitos del Proyecto</h2>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {project.milestones.map((milestone) => (
            <MilestoneSummaryCard
              key={milestone.id}
              project={project}
              milestone={milestone}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const project = projects.find((p) => p.id === params.id);

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

  return <ProjectDetailClient project={project} />;
}
