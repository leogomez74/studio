"use client";

import React, { useState, useEffect, useMemo, useCallback, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  PlusCircle,
  Loader2,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
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

import { ViewToggle } from "@/components/tareas/ViewToggle";
import { TaskFilters } from "@/components/tareas/TaskFilters";
import { KanbanBoard } from "@/components/tareas/KanbanBoard";
import { CalendarView } from "@/components/tareas/CalendarView";
import { LabelBadge } from "@/components/tareas/LabelBadge";
import type { TaskView, TaskItem, TaskWorkflow, TaskLabel, BoardData } from "@/types/tasks";

// --- Constants & Helpers ---

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
  archivada: "Archivada",
  deleted: "Eliminada"
};

const STATUS_BADGE_VARIANT: Record<string, "outline" | "default" | "secondary" | "destructive"> = {
  pendiente: "outline",
  en_progreso: "default",
  completada: "secondary",
  archivada: "destructive",
  deleted: "destructive"
};

const PRIORITY_LABELS: Record<string, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja"
};

const PRIORITY_BADGE_VARIANT: Record<string, "destructive" | "default" | "secondary"> = {
  alta: "destructive",
  media: "default",
  baja: "secondary"
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
  if (!task.due_date || task.status === "completada" || task.completed_at) return false;
  const dueDate = new Date(task.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
};

const parseProjectCode = (projectCode: string | null): { module: string; id: string; url: string } | null => {
  if (!projectCode) return null;
  const match = projectCode.match(/^(LEAD|OPP|ANA|CRED|CLIENT)-(.+)$/);
  if (!match) return null;
  const [, module, id] = match;
  const urlMap: Record<string, string> = {
    LEAD: `/dashboard/leads/${id}`,
    OPP: `/dashboard/oportunidades/${id}`,
    ANA: `/dashboard/analisis/${id}`,
    CRED: `/dashboard/creditos/${id}`,
    CLIENT: `/dashboard/clientes/${id}`,
  };
  return { module, id, url: urlMap[module] || "" };
};

const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type SortableColumn = "reference" | "title" | "status" | "priority" | "assignee" | "due_date" | "created_at";

// --- Main Component ---

export default function TasksPage() {
  const { toast } = useToast();
  const router = useRouter();

  // Data State
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [agents, setAgents] = useState<{ id: number; name: string }[]>([]);
  const [workflows, setWorkflows] = useState<TaskWorkflow[]>([]);
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // View State
  const [viewMode, setViewMode] = useState<TaskView>("list");
  const [boardWorkflowId, setBoardWorkflowId] = useState<string>("");
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [isBoardLoading, setIsBoardLoading] = useState(false);

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
    status: "pendiente",
    priority: "media",
    assigned_to: "",
    workflow_id: "",
    start_date: getTodayDateString(),
    due_date: getTodayDateString(),
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterWorkflow, setFilterWorkflow] = useState("");
  const [filterLabel, setFilterLabel] = useState("");

  // Sort
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
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar las tareas.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchMeta = useCallback(async () => {
    const [agentsRes, workflowsRes, labelsRes] = await Promise.allSettled([
      api.get('/api/agents'),
      api.get('/api/task-workflows'),
      api.get('/api/task-labels'),
    ]);
    if (agentsRes.status === "fulfilled") setAgents(Array.isArray(agentsRes.value.data) ? agentsRes.value.data : []);
    if (workflowsRes.status === "fulfilled") {
      const wfs = workflowsRes.value.data || [];
      setWorkflows(wfs);
      const defaultWf = wfs.find((w: TaskWorkflow) => w.is_default);
      if (defaultWf) setBoardWorkflowId(String(defaultWf.id));
    }
    if (labelsRes.status === "fulfilled") setLabels(labelsRes.value.data || []);
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchMeta();
  }, [fetchTasks, fetchMeta]);

  // Board data
  const fetchBoardData = useCallback(async (workflowId: string) => {
    if (!workflowId) return;
    setIsBoardLoading(true);
    try {
      const response = await api.get(`/api/tareas/board/${workflowId}`);
      setBoardData(response.data);
    } catch {
      toast({ title: "Error", description: "No se pudo cargar el tablero.", variant: "destructive" });
    } finally {
      setIsBoardLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (viewMode === "board" && boardWorkflowId) {
      fetchBoardData(boardWorkflowId);
    }
  }, [viewMode, boardWorkflowId, fetchBoardData]);

  // --- Board Transition ---

  const handleBoardTransition = useCallback(async (taskId: number, toStatusId: number) => {
    try {
      const res = await api.post(`/api/tareas/${taskId}/transition`, {
        to_status_id: toStatusId,
      });
      const reward = res.data.reward;
      if (reward && (reward.points > 0 || reward.xp > 0)) {
        toast({ title: `+${reward.points} pts / +${reward.xp} XP`, description: reward.transition_name || "Transición completada" });
      } else {
        toast({ title: "Estado actualizado" });
      }
      if (boardWorkflowId) fetchBoardData(boardWorkflowId);
      fetchTasks();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({ title: "Error", description: err.response?.data?.message || "No se pudo realizar la transición.", variant: "destructive" });
    }
  }, [boardWorkflowId, fetchBoardData, fetchTasks, toast]);

  // --- Form Logic ---

  const resetForm = useCallback(() => {
    const defaultWf = workflows.find(w => w.is_default);
    setFormValues({
      project_code: "",
      project_name: "sin_hito",
      title: "",
      details: "",
      status: "pendiente",
      priority: "media",
      assigned_to: "",
      workflow_id: defaultWf ? String(defaultWf.id) : "",
      start_date: getTodayDateString(),
      due_date: getTodayDateString(),
    });
  }, [workflows]);

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
      workflow_id: task.workflow_id ? String(task.workflow_id) : "",
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
        workflow_id: formValues.workflow_id ? Number(formValues.workflow_id) : null,
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
      if (viewMode === "board" && boardWorkflowId) fetchBoardData(boardWorkflowId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        title: "Error",
        description: err.response?.data?.message || "No se pudo guardar la tarea.",
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
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar la tarea.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }, [taskToDelete, closeDeleteDialog, fetchTasks, toast]);

  // --- Filter & Sort Logic ---

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setFilterStatus("");
    setFilterPriority("");
    setFilterAssignee("");
    setFilterWorkflow("");
    setFilterLabel("");
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
      case "status": return task.workflow_status?.name || task.status;
      case "priority": return task.priority;
      case "assignee": return task.assignee?.name.toLowerCase() || "";
      case "due_date": return task.due_date ? new Date(task.due_date).getTime() : 0;
      case "created_at": return task.created_at ? new Date(task.created_at).getTime() : 0;
      default: return "";
    }
  }, []);

  const visibleTasks = useMemo(() => {
    let filtered = [...tasks];

    if (debouncedSearch.trim()) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        task.project_code?.toLowerCase().includes(searchLower) ||
        task.reference?.toLowerCase().includes(searchLower)
      );
    }

    if (filterStatus && filterStatus !== "all") {
      filtered = filtered.filter(task => task.status === filterStatus);
    }

    if (filterPriority && filterPriority !== "all") {
      filtered = filtered.filter(task => task.priority === filterPriority);
    }

    if (filterAssignee && filterAssignee !== "all") {
      filtered = filtered.filter(task => String(task.assigned_to) === filterAssignee);
    }

    if (filterWorkflow && filterWorkflow !== "all") {
      filtered = filtered.filter(task => String(task.workflow_id) === filterWorkflow);
    }

    if (filterLabel && filterLabel !== "all") {
      filtered = filtered.filter(task =>
        task.labels?.some(l => String(l.id) === filterLabel)
      );
    }

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
  }, [tasks, debouncedSearch, filterStatus, filterPriority, filterAssignee, filterWorkflow, filterLabel, sortConfig, getSortableValue]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterStatus, filterPriority, filterAssignee, filterWorkflow, filterLabel, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(visibleTasks.length / itemsPerPage));

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return visibleTasks.slice(start, start + itemsPerPage);
  }, [visibleTasks, currentPage, itemsPerPage]);

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

    const headers = ["Referencia", "Título", "Estado", "Flujo", "Prioridad", "Responsable", "Fecha inicio", "Fecha vencimiento", "Etiquetas"];
    const rows = visibleTasks.map(task => [
      task.reference,
      task.title,
      task.workflow_status?.name || STATUS_LABELS[task.status] || task.status,
      task.workflow?.name || "-",
      PRIORITY_LABELS[task.priority] || task.priority,
      task.assignee?.name || "-",
      task.start_date || "",
      task.due_date || "",
      task.labels?.map(l => l.name).join(", ") || "-",
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
        task.reference,
        task.title,
        task.workflow_status?.name || STATUS_LABELS[task.status] || task.status,
        PRIORITY_LABELS[task.priority] || task.priority,
        task.assignee?.name || "-",
        formatDate(task.start_date),
        formatDate(task.due_date),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 53, 69] },
    });

    doc.save(`tareas_${Date.now()}.pdf`);
  }, [toast, visibleTasks]);

  // --- Navigate to task detail ---

  const goToTask = useCallback((taskId: number) => {
    router.push(`/dashboard/tareas/${taskId}`);
  }, [router]);

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
              {tasks.length !== visibleTasks.length && ` (${tasks.length} total)`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ViewToggle view={viewMode} onChange={setViewMode} />
            {viewMode === "list" && (
              <>
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
                  <Download className="h-4 w-4" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
                  <Download className="h-4 w-4" /> PDF
                </Button>
              </>
            )}
            {viewMode === "board" && workflows.length > 0 && (
              <Select value={boardWorkflowId} onValueChange={setBoardWorkflowId}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Flujo de trabajo" />
                </SelectTrigger>
                <SelectContent>
                  {workflows.filter(w => w.is_active).map(w => (
                    <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={openCreateDialog} className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Agregar tarea
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Unified Filters */}
        {viewMode !== "board" && (
          <TaskFilters
            search={searchTerm}
            onSearchChange={setSearchTerm}
            status={filterStatus}
            onStatusChange={setFilterStatus}
            priority={filterPriority}
            onPriorityChange={setFilterPriority}
            assignedTo={filterAssignee}
            onAssignedToChange={setFilterAssignee}
            workflowId={filterWorkflow}
            onWorkflowChange={setFilterWorkflow}
            labelId={filterLabel}
            onLabelChange={setFilterLabel}
            users={agents}
            workflows={workflows}
            labels={labels}
            onClear={clearFilters}
          />
        )}

        {/* ====== LIST VIEW ====== */}
        {viewMode === "list" && (
          <>
            {/* Desktop Table */}
            <div className="relative w-full overflow-auto hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead aria-sort={getAriaSort("reference")}>
                      <button className="flex w-full items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => handleSort("reference")}>
                        Ref {renderSortIcon("reference")}
                      </button>
                    </TableHead>
                    <TableHead aria-sort={getAriaSort("title")}>
                      <button className="flex w-full items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => handleSort("title")}>
                        Título {renderSortIcon("title")}
                      </button>
                    </TableHead>
                    <TableHead aria-sort={getAriaSort("status")}>
                      <button className="flex w-full items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => handleSort("status")}>
                        Estado {renderSortIcon("status")}
                      </button>
                    </TableHead>
                    <TableHead aria-sort={getAriaSort("priority")}>
                      <button className="flex w-full items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => handleSort("priority")}>
                        Prioridad {renderSortIcon("priority")}
                      </button>
                    </TableHead>
                    <TableHead className="hidden lg:table-cell" aria-sort={getAriaSort("assignee")}>
                      <button className="flex w-full items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => handleSort("assignee")}>
                        Responsable {renderSortIcon("assignee")}
                      </button>
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">Etiquetas</TableHead>
                    <TableHead className="hidden lg:table-cell" aria-sort={getAriaSort("due_date")}>
                      <button className="flex w-full items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => handleSort("due_date")}>
                        Vencimiento {renderSortIcon("due_date")}
                      </button>
                    </TableHead>
                    <TableHead><span className="sr-only">Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : visibleTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        No hay tareas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTasks.map(task => {
                      const overdue = isTaskOverdue(task);
                      const parsed = parseProjectCode(task.project_code);

                      return (
                        <TableRow
                          key={task.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => goToTask(task.id)}
                        >
                          <TableCell className="font-mono text-sm">
                            <div className="flex flex-col">
                              <span className="font-semibold">{task.reference}</span>
                              {parsed ? (
                                <Link
                                  href={parsed.url}
                                  className="text-xs text-blue-600 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {task.project_code}
                                </Link>
                              ) : task.project_code ? (
                                <span className="text-xs text-muted-foreground">{task.project_code}</span>
                              ) : null}
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
                            {task.workflow_status ? (
                              <Badge
                                variant="outline"
                                className="text-xs"
                                style={{
                                  borderColor: task.workflow_status.color,
                                  color: task.workflow_status.color,
                                  backgroundColor: `${task.workflow_status.color}15`,
                                }}
                              >
                                {task.workflow_status.name}
                              </Badge>
                            ) : (
                              <Badge variant={STATUS_BADGE_VARIANT[task.status] || "outline"}>
                                {STATUS_LABELS[task.status] || task.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={PRIORITY_BADGE_VARIANT[task.priority] || "default"}>
                              {PRIORITY_LABELS[task.priority] || task.priority}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-sm">{task.assignee?.name || "-"}</span>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {task.labels && task.labels.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {task.labels.slice(0, 2).map(l => (
                                  <LabelBadge key={l.id} label={l} size="sm" />
                                ))}
                                {task.labels.length > 2 && (
                                  <span className="text-[10px] text-muted-foreground">+{task.labels.length - 2}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex flex-col">
                              <span className="text-sm">{formatDate(task.due_date)}</span>
                              {overdue && (
                                <Badge variant="destructive" className="w-fit mt-1 text-xs">ATRASADA</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button size="icon" variant="ghost" onClick={() => openEditDialog(task)} className="h-8 w-8">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => openDeleteDialog(task)} className="h-8 w-8 text-destructive hover:text-destructive">
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

              {/* Pagination */}
              {visibleTasks.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {Math.min((currentPage - 1) * itemsPerPage + 1, visibleTasks.length)}–{Math.min(currentPage * itemsPerPage, visibleTasks.length)} de {visibleTasks.length}
                    </span>
                    <span className="hidden sm:inline">·</span>
                    <span className="hidden sm:flex items-center gap-1">
                      Por página:
                      <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                        <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="h-8 w-8 p-0 hidden sm:flex">
                      <ChevronLeft className="h-3 w-3" /><ChevronLeft className="h-3 w-3 -ml-2" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 px-3 gap-1">
                      <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Anterior</span>
                    </Button>
                    <span className="text-sm px-3 tabular-nums">{currentPage} / {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 px-3 gap-1">
                      <span className="hidden sm:inline">Siguiente</span><ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="h-8 w-8 p-0 hidden sm:flex">
                      <ChevronRight className="h-3 w-3" /><ChevronRight className="h-3 w-3 -ml-2" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : paginatedTasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No hay tareas.</p>
              ) : (
                paginatedTasks.map(task => {
                  const overdue = isTaskOverdue(task);
                  return (
                    <Card key={task.id} className="cursor-pointer" onClick={() => goToTask(task.id)}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{task.title}</CardTitle>
                            <CardDescription className="text-xs mt-1">{task.reference}</CardDescription>
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button size="icon" variant="ghost" onClick={() => openEditDialog(task)} className="h-8 w-8">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => openDeleteDialog(task)} className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {task.workflow_status ? (
                            <Badge variant="outline" style={{ borderColor: task.workflow_status.color, color: task.workflow_status.color }}>
                              {task.workflow_status.name}
                            </Badge>
                          ) : (
                            <Badge variant={STATUS_BADGE_VARIANT[task.status] || "outline"}>
                              {STATUS_LABELS[task.status] || task.status}
                            </Badge>
                          )}
                          <Badge variant={PRIORITY_BADGE_VARIANT[task.priority] || "default"}>
                            {PRIORITY_LABELS[task.priority] || task.priority}
                          </Badge>
                          {overdue && <Badge variant="destructive">ATRASADA</Badge>}
                        </div>
                        {task.labels && task.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {task.labels.map(l => <LabelBadge key={l.id} label={l} size="sm" />)}
                          </div>
                        )}
                        <div className="text-sm space-y-1">
                          <div><span className="font-medium">Responsable:</span> {task.assignee?.name || "-"}</div>
                          <div><span className="font-medium">Vence:</span> {formatDate(task.due_date)}</div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ====== BOARD VIEW ====== */}
        {viewMode === "board" && (
          <>
            {isBoardLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : boardData && boardData.columns.length > 0 ? (
              <KanbanBoard
                columns={boardData.columns}
                onTransition={handleBoardTransition}
                onTaskClick={goToTask}
              />
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                {!boardWorkflowId ? "Selecciona un flujo de trabajo para ver el tablero." : "No hay columnas en este flujo."}
              </div>
            )}
          </>
        )}

        {/* ====== CALENDAR VIEW ====== */}
        {viewMode === "calendar" && (
          <CalendarView tasks={visibleTasks} onTaskClick={goToTask} />
        )}
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
                <Select value={formValues.status} onValueChange={(value) => handleFormChange("status", value)}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
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
                <Select value={formValues.priority} onValueChange={(value) => handleFormChange("priority", value)}>
                  <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Responsable</Label>
                <Select value={formValues.assigned_to} onValueChange={(value) => handleFormChange("assigned_to", value)}>
                  <SelectTrigger id="assigned_to"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={String(agent.id)}>{agent.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {workflows.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="workflow_id">Flujo de trabajo</Label>
                  <Select value={formValues.workflow_id} onValueChange={(value) => handleFormChange("workflow_id", value)}>
                    <SelectTrigger id="workflow_id"><SelectValue placeholder="Por defecto" /></SelectTrigger>
                    <SelectContent>
                      {workflows.filter(w => w.is_active).map(w => (
                        <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
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
