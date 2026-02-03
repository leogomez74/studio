"use client";

import React, { useState, useEffect, useMemo, useCallback, FormEvent } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  PlusCircle,
  Loader2,
  Calendar as CalendarIcon,
  Filter,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import api from "@/lib/axios";

// --- Types ---

type TaskStatus = "pendiente" | "en_progreso" | "completada" | "archivada" | "deleted";
type TaskPriority = "alta" | "media" | "baja";

interface TaskItem {
  id: number;
  project_code: string | null;
  project_name: string | null;
  title: string;
  details: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: number | null;
  assignee: {
    id: number;
    name: string;
    email: string;
  } | null;
  start_date: string | null;
  due_date: string | null;
  archived_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface TaskTableFilters {
  search: string;
  status: "todos" | TaskStatus;
  priority: "todas" | TaskPriority;
  assignee: string;
  dueFrom: string;
  dueTo: string;
}

interface Opportunity {
  id: number;
  reference: string;
  lead?: {
    nombre_completo: string;
  };
  status: string;
}

interface Agent {
  id: number;
  name: string;
  email: string;
}

type SortableColumn = "reference" | "title" | "status" | "priority" | "assignee" | "due_date" | "created_at";

// --- Constants & Helpers ---

const STATUS_LABELS: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
  archivada: "Archivada",
  deleted: "Eliminada"
};

const STATUS_BADGE_VARIANT: Record<TaskStatus, "outline" | "default" | "secondary" | "destructive"> = {
  pendiente: "outline",
  en_progreso: "default",
  completada: "secondary",
  archivada: "destructive",
  deleted: "destructive"
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja"
};

const PRIORITY_BADGE_VARIANT: Record<TaskPriority, "destructive" | "default" | "secondary"> = {
  alta: "destructive",
  media: "default",
  baja: "secondary"
};

const formatTaskReference = (id: number): string => {
  return `TA-${String(id).padStart(4, "0")}`;
};

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
};

const isTaskOverdue = (task: TaskItem): boolean => {
  if (!task.due_date || task.status === "completada") return false;

  const dueDate = new Date(task.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dueDate < today;
};

const extractOpportunityId = (projectCode: string | null): number | null => {
  if (!projectCode) return null;
  const match = projectCode.match(/-(\d+)-[A-Z]+$/);
  return match ? Number(match[1]) : null;
};

// --- Main Component ---

export default function TasksPage() {
  const { toast } = useToast();

  // Data State
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // View State
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");

  // Dialog States
  const [dialogState, setDialogState] = useState<"create" | "edit" | null>(null);
  const [dialogTask, setDialogTask] = useState<TaskItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formValues, setFormValues] = useState({
    project_code: "",
    project_name: "sin_hito",
    title: "",
    details: "",
    status: "pendiente" as TaskStatus,
    priority: "media" as TaskPriority,
    assigned_to: "",
    start_date: "",
    due_date: "",
  });

  // Filters & Sort
  const [filters, setFilters] = useState<TaskTableFilters>({
    search: "",
    status: "todos",
    priority: "todas",
    assignee: "todos",
    dueFrom: "",
    dueTo: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const [sortConfig, setSortConfig] = useState<{ column: SortableColumn; direction: "asc" | "desc" }>({
    column: "created_at",
    direction: "desc"
  });

  // --- Fetching ---

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/tareas');
      const data = response.data.data || response.data;
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast({ title: "Error", description: "No se pudieron cargar las tareas.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchOpportunities = useCallback(async () => {
    try {
      const response = await api.get('/api/opportunities?all=true');
      const data = response.data.data || response.data;
      setOpportunities(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await api.get('/api/agents');
      setAgents(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching agents:", error);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchOpportunities();
    fetchAgents();
  }, [fetchTasks, fetchOpportunities, fetchAgents]);

  useEffect(() => {
    setFilters(prev => ({ ...prev, search: debouncedSearch }));
  }, [debouncedSearch]);

  // --- Form Logic ---

  const resetForm = useCallback(() => {
    setFormValues({
      project_code: "",
      project_name: "sin_hito",
      title: "",
      details: "",
      status: "pendiente",
      priority: "media",
      assigned_to: "",
      start_date: "",
      due_date: "",
    });
  }, []);

  const openCreateDialog = useCallback(() => {
    resetForm();
    setDialogState("create");
  }, [resetForm]);

  const openEditDialog = useCallback((task: TaskItem) => {
    setDialogTask(task);
    setFormValues({
      project_code: task.project_code || "",
      project_name: "sin_hito",
      title: task.title,
      details: task.details || "",
      status: task.status,
      priority: task.priority,
      assigned_to: task.assigned_to ? String(task.assigned_to) : "",
      start_date: task.start_date || "",
      due_date: task.due_date || "",
    });
    setDialogState("edit");
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState(null);
    setDialogTask(null);
    resetForm();
  }, [resetForm]);

  const handleFormChange = useCallback((field: keyof typeof formValues, value: string) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formValues.title.trim()) {
      toast({ title: "Error", description: "El título es requerido.", variant: "destructive" });
      return;
    }

    if (formValues.due_date && formValues.start_date && formValues.due_date < formValues.start_date) {
      toast({ title: "Error", description: "La fecha de vencimiento no puede ser anterior a la fecha de inicio.", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    try {
      const body = {
        project_code: formValues.project_code || null,
        project_name: formValues.project_name,
        title: formValues.title.trim(),
        details: formValues.details.trim() || null,
        status: formValues.status,
        priority: formValues.priority,
        assigned_to: formValues.assigned_to ? Number(formValues.assigned_to) : null,
        start_date: formValues.start_date || null,
        due_date: formValues.due_date || null,
      };

      if (dialogState === "edit" && dialogTask) {
        await api.put(`/api/tareas/${dialogTask.id}`, body);
        toast({ title: "Actualizado", description: "Tarea actualizada correctamente." });
      } else {
        await api.post('/api/tareas', body);
        toast({ title: "Creado", description: "Tarea creada correctamente." });
      }

      closeDialog();
      fetchTasks();
    } catch (error: any) {
      console.error("Error saving task:", error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "No se pudo guardar la tarea.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Delete Logic ---

  const openDeleteDialog = useCallback((task: TaskItem) => {
    setTaskToDelete(task);
    setIsDeleteOpen(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setIsDeleteOpen(false);
    setTaskToDelete(null);
  }, []);

  const handleDeleteTask = useCallback(async () => {
    if (!taskToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/tareas/${taskToDelete.id}`);
      toast({ title: "Eliminado", description: "Tarea eliminada (soft delete)." });
      closeDeleteDialog();
      fetchTasks();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la tarea.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }, [taskToDelete, closeDeleteDialog, fetchTasks, toast]);

  // --- Filter & Sort Logic ---

  const handleFilterChange = useCallback(
    <K extends keyof TaskTableFilters>(field: K, value: TaskTableFilters[K]) => {
      setFilters(prev => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: "",
      status: "todos",
      priority: "todas",
      assignee: "todos",
      dueFrom: "",
      dueTo: "",
    });
    setSearchTerm("");
  }, []);

  const handleSort = useCallback((column: SortableColumn) => {
    setSortConfig(prev => {
      if (prev.column === column) {
        return { column, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { column, direction: "asc" };
    });
  }, []);

  const getSortableValue = useCallback((task: TaskItem, column: SortableColumn): number | string => {
    switch (column) {
      case "reference": return task.id;
      case "title": return task.title.toLowerCase();
      case "status": return task.status;
      case "priority": return task.priority;
      case "assignee": return task.assignee?.name.toLowerCase() || "";
      case "due_date": return task.due_date ? new Date(task.due_date).getTime() : 0;
      case "created_at": return task.created_at ? new Date(task.created_at).getTime() : 0;
      default: return "";
    }
  }, []);

  const visibleTasks = useMemo(() => {
    let filtered = [...tasks];

    // Apply filters
    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        task.project_code?.toLowerCase().includes(searchLower) ||
        formatTaskReference(task.id).toLowerCase().includes(searchLower)
      );
    }

    if (filters.status !== "todos") {
      filtered = filtered.filter(task => task.status === filters.status);
    }

    if (filters.priority !== "todas") {
      filtered = filtered.filter(task => task.priority === filters.priority);
    }

    if (filters.assignee !== "todos") {
      filtered = filtered.filter(task => String(task.assigned_to) === filters.assignee);
    }

    if (filters.dueFrom) {
      filtered = filtered.filter(task => task.due_date && task.due_date >= filters.dueFrom);
    }

    if (filters.dueTo) {
      filtered = filtered.filter(task => task.due_date && task.due_date <= filters.dueTo);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = getSortableValue(a, sortConfig.column);
      const bValue = getSortableValue(b, sortConfig.column);
      const multiplier = sortConfig.direction === "asc" ? 1 : -1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * multiplier;
      }
      return String(aValue).localeCompare(String(bValue)) * multiplier;
    });

    return filtered;
  }, [tasks, filters, sortConfig, getSortableValue]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search.trim().length > 0 ||
      filters.status !== "todos" ||
      filters.priority !== "todas" ||
      filters.assignee !== "todos" ||
      filters.dueFrom.length > 0 ||
      filters.dueTo.length > 0
    );
  }, [filters]);

  const getAriaSort = useCallback(
    (column: SortableColumn): "ascending" | "descending" | "none" => {
      if (sortConfig.column !== column) return "none";
      return sortConfig.direction === "asc" ? "ascending" : "descending";
    },
    [sortConfig]
  );

  const renderSortIcon = useCallback(
    (column: SortableColumn) => {
      if (sortConfig.column !== column) {
        return <ArrowUpDown className="ml-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />;
      }
      return sortConfig.direction === "asc" ? (
        <ArrowUp className="ml-1 h-4 w-4 text-primary" aria-hidden="true" />
      ) : (
        <ArrowDown className="ml-1 h-4 w-4 text-primary" aria-hidden="true" />
      );
    },
    [sortConfig]
  );

  // --- Export ---

  const handleExportCSV = useCallback(() => {
    if (visibleTasks.length === 0) {
      toast({ title: "Sin datos", description: "No hay tareas para exportar.", variant: "destructive" });
      return;
    }

    const headers = ["Referencia", "Título", "Estado", "Prioridad", "Responsable", "Fecha inicio", "Fecha vencimiento"];
    const rows = visibleTasks.map(task => [
      formatTaskReference(task.id),
      task.title,
      STATUS_LABELS[task.status],
      PRIORITY_LABELS[task.priority],
      task.assignee?.name || "-",
      task.start_date || "",
      task.due_date || "",
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tareas_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [toast, visibleTasks]);

  const handleExportPDF = useCallback(() => {
    if (visibleTasks.length === 0) {
      toast({ title: "Sin datos", description: "No hay tareas para exportar.", variant: "destructive" });
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(12);
    doc.text("Reporte de Tareas", 14, 16);

    autoTable(doc, {
      startY: 22,
      head: [["Ref", "Título", "Estado", "Prioridad", "Responsable", "Inicio", "Vencimiento"]],
      body: visibleTasks.map(task => [
        formatTaskReference(task.id),
        task.title,
        STATUS_LABELS[task.status],
        PRIORITY_LABELS[task.priority],
        task.assignee?.name || "-",
        formatDate(task.start_date),
        formatDate(task.due_date),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 53, 69] },
    });

    doc.save(`tareas_${Date.now()}.pdf`);
  }, [toast, visibleTasks]);

  // --- Render ---

  const dialogTitle = dialogState === "edit" ? "Editar tarea" : "Agregar tarea";
  const dialogDescription = dialogState === "edit" ? "Actualiza la información de la tarea." : "Crea una nueva tarea.";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Gestión de Tareas</CardTitle>
            <CardDescription>Organiza y da seguimiento a las tareas del equipo.</CardDescription>
            <p className="text-sm text-muted-foreground mt-1">
              {visibleTasks.length > 0 ? `${visibleTasks.length} ${visibleTasks.length === 1 ? "tarea" : "tareas"}` : "No hay tareas"}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Button variant="outline" onClick={() => setViewMode(viewMode === "table" ? "calendar" : "table")} className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {viewMode === "table" ? "Vista Calendario" : "Vista Tabla"}
            </Button>
            <Button variant="outline" onClick={handleExportCSV} className="gap-2">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            <Button variant="outline" onClick={handleExportPDF} className="gap-2">
              <Download className="h-4 w-4" />
              Exportar PDF
            </Button>
            <Button onClick={openCreateDialog} className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Agregar tarea
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Buscar</Label>
            <Input
              placeholder="Título, referencia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-56"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</Label>
            <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value as any)}>
              <SelectTrigger className="w-auto min-w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_progreso">En progreso</SelectItem>
                <SelectItem value="completada">Completada</SelectItem>
                <SelectItem value="archivada">Archivada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prioridad</Label>
            <Select value={filters.priority} onValueChange={(value) => handleFilterChange("priority", value as any)}>
              <SelectTrigger className="w-auto min-w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responsable</Label>
            <Select value={filters.assignee} onValueChange={(value) => handleFilterChange("assignee", value)}>
              <SelectTrigger className="w-auto min-w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={String(agent.id)}>{agent.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vence desde</Label>
            <Input
              type="date"
              value={filters.dueFrom}
              onChange={(e) => handleFilterChange("dueFrom", e.target.value)}
              className="h-10 w-36"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vence hasta</Label>
            <Input
              type="date"
              value={filters.dueTo}
              onChange={(e) => handleFilterChange("dueTo", e.target.value)}
              className="h-10 w-36"
            />
          </div>
          <Button variant="outline" onClick={handleClearFilters} disabled={!hasActiveFilters}>
            Limpiar filtros
          </Button>
        </div>

        {/* Table View */}
        {viewMode === "table" && (
          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead aria-sort={getAriaSort("reference")}>
                    <button
                      className="flex w-full items-center justify-between gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      onClick={() => handleSort("reference")}
                    >
                      Referencia {renderSortIcon("reference")}
                    </button>
                  </TableHead>
                  <TableHead aria-sort={getAriaSort("title")}>
                    <button
                      className="flex w-full items-center justify-between gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      onClick={() => handleSort("title")}
                    >
                      Título {renderSortIcon("title")}
                    </button>
                  </TableHead>
                  <TableHead aria-sort={getAriaSort("status")}>
                    <button
                      className="flex w-full items-center justify-between gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      onClick={() => handleSort("status")}
                    >
                      Estado {renderSortIcon("status")}
                    </button>
                  </TableHead>
                  <TableHead aria-sort={getAriaSort("priority")}>
                    <button
                      className="flex w-full items-center justify-between gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      onClick={() => handleSort("priority")}
                    >
                      Prioridad {renderSortIcon("priority")}
                    </button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell" aria-sort={getAriaSort("assignee")}>
                    <button
                      className="flex w-full items-center justify-between gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      onClick={() => handleSort("assignee")}
                    >
                      Responsable {renderSortIcon("assignee")}
                    </button>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell" aria-sort={getAriaSort("due_date")}>
                    <button
                      className="flex w-full items-center justify-between gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      onClick={() => handleSort("due_date")}
                    >
                      Vencimiento {renderSortIcon("due_date")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : visibleTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No hay tareas.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleTasks.map(task => {
                    const isOverdue = isTaskOverdue(task);
                    const opportunityId = extractOpportunityId(task.project_code);

                    return (
                      <TableRow key={task.id}>
                        <TableCell className="font-mono text-sm">
                          <div className="flex flex-col">
                            <span className="font-semibold">{formatTaskReference(task.id)}</span>
                            {task.project_code && (
                              <span className="text-xs text-muted-foreground">{task.project_code}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{task.title}</span>
                            {task.details && (
                              <span className="text-xs text-muted-foreground line-clamp-1">{task.details}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE_VARIANT[task.status]}>
                            {STATUS_LABELS[task.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>
                            {PRIORITY_LABELS[task.priority]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm">{task.assignee?.name || "-"}</span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-col">
                            <span className="text-sm">{formatDate(task.due_date)}</span>
                            {isOverdue && (
                              <Badge variant="destructive" className="w-fit mt-1 text-xs">ATRASADA</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditDialog(task)}
                              className="h-8 w-8"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openDeleteDialog(task)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Calendar View (Placeholder) */}
        {viewMode === "calendar" && (
          <div className="flex items-center justify-center h-64 border rounded-lg bg-muted/20">
            <div className="text-center">
              <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Vista de calendario próximamente</p>
            </div>
          </div>
        )}

        {/* Mobile Cards View (shown below md breakpoint) */}
        <div className="md:hidden space-y-4">
          {visibleTasks.map(task => {
            const isOverdue = isTaskOverdue(task);
            return (
              <Card key={task.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{task.title}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {formatTaskReference(task.id)}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(task)}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openDeleteDialog(task)}
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={STATUS_BADGE_VARIANT[task.status]}>
                      {STATUS_LABELS[task.status]}
                    </Badge>
                    <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>
                      {PRIORITY_LABELS[task.priority]}
                    </Badge>
                    {isOverdue && <Badge variant="destructive">ATRASADA</Badge>}
                  </div>
                  {task.details && (
                    <p className="text-sm text-muted-foreground">{task.details}</p>
                  )}
                  <div className="text-sm space-y-1">
                    <div><span className="font-medium">Responsable:</span> {task.assignee?.name || "-"}</div>
                    <div><span className="font-medium">Vence:</span> {formatDate(task.due_date)}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogState !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={formValues.title}
                  onChange={(e) => handleFormChange("title", e.target.value)}
                  placeholder="Título de la tarea"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="details">Descripción</Label>
                <Textarea
                  id="details"
                  value={formValues.details}
                  onChange={(e) => handleFormChange("details", e.target.value)}
                  placeholder="Detalles adicionales..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={formValues.status}
                  onValueChange={(value) => handleFormChange("status", value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="en_progreso">En progreso</SelectItem>
                    <SelectItem value="completada">Completada</SelectItem>
                    <SelectItem value="archivada">Archivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridad</Label>
                <Select
                  value={formValues.priority}
                  onValueChange={(value) => handleFormChange("priority", value)}
                >
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Responsable</Label>
                <Select
                  value={formValues.assigned_to}
                  onValueChange={(value) => handleFormChange("assigned_to", value)}
                >
                  <SelectTrigger id="assigned_to">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={String(agent.id)}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_date">Fecha de inicio</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formValues.start_date}
                  onChange={(e) => handleFormChange("start_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Fecha de vencimiento</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formValues.due_date}
                  onChange={(e) => handleFormChange("due_date", e.target.value)}
                  min={formValues.start_date || undefined}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará la tarea como eliminada. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteDialog}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
