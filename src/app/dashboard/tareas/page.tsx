'use client';
import React from 'react';
import Link from 'next/link';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { projects, type Project } from '@/lib/data';

/**
 * Función para obtener la variante de color de la insignia según el estado del proyecto.
 */
const getStatusVariant = (status: Project['status']) => {
  switch (status) {
    case 'Completado':
      return 'secondary';
    case 'En Progreso':
      return 'default';
    case 'Planificado':
      return 'outline';
    case 'En Riesgo':
        return 'destructive'
    default:
      return 'outline';
  }
};

/**
 * Función para calcular el progreso general de un proyecto.
 */
const getProjectProgress = (project: Project) => {
    const totalTasks = project.milestones.reduce((acc, m) => acc + m.tasks.length, 0);
    if (totalTasks === 0) return 0;
    const completedTasks = project.milestones.reduce((acc, m) => acc + m.tasks.filter(t => t.completed).length, 0);
    return (completedTasks / totalTasks) * 100;
}

/**
 * Componente principal de la página de Proyectos.
 * Muestra una tabla con todos los proyectos, su estado, progreso y responsable.
 */
export default function ProjectsPage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestión de Proyectos</CardTitle>
            <CardDescription>
              Organiza, planifica y da seguimiento a los proyectos internos.
            </CardDescription>
          </div>
          <Button size="sm" className="gap-1">
            <PlusCircle className="h-4 w-4" />
            Agregar Proyecto
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ProjectsTable projects={projects} />
      </CardContent>
    </Card>
  );
}

/**
 * Componente reutilizable para mostrar la tabla de proyectos.
 */
function ProjectsTable({ projects }: { projects: Project[] }) {
  return (
    <div className="relative w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proyecto</TableHead>
            <TableHead>Líder del Proyecto</TableHead>
            <TableHead className="hidden md:table-cell">Presupuesto</TableHead>
            <TableHead className="hidden lg:table-cell">Fechas</TableHead>
            <TableHead>Progreso</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <ProjectTableRow key={project.id} project={project} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Componente que renderiza una única fila de la tabla de proyectos.
 */
const ProjectTableRow = React.memo(function ProjectTableRow({
  project,
}: {
  project: Project;
}) {
  const progress = getProjectProgress(project);
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium">
        <Link href={`/dashboard/tareas/${project.id}`} className="hover:underline">
          {project.name}
        </Link>
        <div className="text-sm text-muted-foreground">{project.id}</div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={project.leaderAvatar} />
            <AvatarFallback>{project.leader.charAt(0)}</AvatarFallback>
          </Avatar>
          <span>{project.leader}</span>
        </div>
      </TableCell>
      <TableCell className="hidden font-mono md:table-cell">
        ${project.budget.toLocaleString('en-US')}
      </TableCell>
      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
        {project.startDate} - {project.endDate}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Progress value={progress} className="h-2 w-24" />
          <span className="text-xs text-muted-foreground">{progress.toFixed(0)}%</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={getStatusVariant(project.status)}>{project.status}</Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-haspopup="true" size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Alternar menú</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/tareas/${project.id}`}>Ver Detalles</Link>
            </DropdownMenuItem>
            <DropdownMenuItem>Editar Proyecto</DropdownMenuItem>
            <DropdownMenuItem>Archivar</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});
