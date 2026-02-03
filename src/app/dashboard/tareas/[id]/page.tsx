"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/axios";
import { CaseChat } from "@/components/case-chat";

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

// --- Helper Functions ---

const formatTaskReference = (id: number): string => {
  return `TA-${String(id).padStart(4, "0")}`;
};

const isTaskOverdue = (task: TaskItem): boolean => {
  if (!task.due_date || task.status === "completada") return false;

  const dueDate = new Date(task.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dueDate < today;
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const extractOpportunityId = (projectCode: string): number | null => {
  // Pattern: "25-12345-0007-CO" -> extract 12345
  const match = projectCode.match(/-(\d+)-/);
  return match ? Number(match[1]) : null;
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
  archivada: "Archivada",
  deleted: "Eliminada",
};

const STATUS_VARIANTS: Record<TaskStatus, "outline" | "default" | "secondary" | "destructive"> = {
  pendiente: "outline",
  en_progreso: "default",
  completada: "secondary",
  archivada: "destructive",
  deleted: "destructive",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

const PRIORITY_VARIANTS: Record<TaskPriority, "destructive" | "default" | "secondary"> = {
  alta: "destructive",
  media: "default",
  baja: "secondary",
};

// --- Main Component ---

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const taskId = params.id as string;

  const [task, setTask] = useState<TaskItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [editedDetails, setEditedDetails] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Fetch task data
  const fetchTask = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/tareas/${taskId}`);
      const data = res.data as TaskItem;
      setTask(data);
      setEditedDetails(data.details || "");
    } catch (err) {
      console.error("Error fetching task:", err);
      setError("No se pudo cargar la tarea.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (taskId) {
      fetchTask();
    }
  }, [taskId, fetchTask]);

  // Save task details
  const handleSaveDetails = async () => {
    if (!task) return;

    try {
      setSavingDetails(true);
      await api.put(`/api/tareas/${task.id}`, {
        details: editedDetails,
      });

      setTask((prev) => prev ? { ...prev, details: editedDetails } : null);

      toast({
        title: "Guardado",
        description: "Los detalles de la tarea se guardaron correctamente.",
      });
    } catch (err) {
      console.error("Error saving details:", err);
      toast({
        title: "Error",
        description: "No se pudieron guardar los detalles.",
        variant: "destructive",
      });
    } finally {
      setSavingDetails(false);
    }
  };

  // Quick status update
  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!task) return;

    const previousStatus = task.status;

    try {
      setUpdatingStatus(true);
      setTask((prev) => prev ? { ...prev, status: newStatus } : null);

      await api.put(`/api/tareas/${task.id}`, {
        status: newStatus,
      });

      toast({
        title: "Estado actualizado",
        description: `La tarea ahora está ${STATUS_LABELS[newStatus].toLowerCase()}.`,
      });
    } catch (err) {
      console.error("Error updating status:", err);
      setTask((prev) => prev ? { ...prev, status: previousStatus } : null);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado.",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  // Error state
  if (error || !task) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-500">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <p>{error || "Tarea no encontrada"}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/dashboard/tareas")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver al listado
          </Button>
        </div>
      </div>
    );
  }

  const isOverdue = isTaskOverdue(task);
  const opportunityId = task.project_code ? extractOpportunityId(task.project_code) : null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/tareas")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-800">
                {formatTaskReference(task.id)}
              </h1>
              <Badge variant={STATUS_VARIANTS[task.status]}>
                {STATUS_LABELS[task.status]}
              </Badge>
              <Badge variant={PRIORITY_VARIANTS[task.priority]}>
                {PRIORITY_LABELS[task.priority]}
              </Badge>
              {isOverdue && (
                <Badge variant="destructive" className="bg-red-600">
                  ATRASADA
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">{task.title}</p>
          </div>
        </div>
      </div>

      {/* Main Layout: Content Area + Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area (2/3 width on large screens) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Status Update */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actualización rápida de estado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(["pendiente", "en_progreso", "completada", "archivada"] as TaskStatus[]).map((status) => (
                  <Button
                    key={status}
                    variant={task.status === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusChange(status)}
                    disabled={updatingStatus}
                    className="text-xs"
                  >
                    {STATUS_LABELS[status]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tabs: Resumen / Seguimiento */}
          <Tabs defaultValue="resumen" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="seguimiento">Seguimiento</TabsTrigger>
            </TabsList>

            {/* Resumen Tab */}
            <TabsContent value="resumen" className="space-y-4 mt-4">
              {/* Task Details (editable) */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Detalles de la tarea</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Descripción</Label>
                    <Textarea
                      value={editedDetails}
                      onChange={(e) => setEditedDetails(e.target.value)}
                      placeholder="Describe los detalles de la tarea..."
                      rows={5}
                      className="mt-1"
                    />
                    <div className="flex justify-end mt-2">
                      <Button
                        size="sm"
                        onClick={handleSaveDetails}
                        disabled={savingDetails || editedDetails === (task.details || "")}
                      >
                        {savingDetails && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                        <Save className="h-3 w-3 mr-2" />
                        Guardar
                      </Button>
                    </div>
                  </div>

                  {/* Assigned to (display only) */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Asignado a</Label>
                    <Input
                      value={task.assignee?.name || "Sin asignar"}
                      readOnly
                      disabled
                      className="mt-1 bg-muted"
                    />
                  </div>

                  {/* Dates (display only) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Fecha de inicio</Label>
                      <Input
                        value={formatDate(task.start_date)}
                        readOnly
                        disabled
                        className="mt-1 bg-muted"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Fecha de vencimiento</Label>
                      <Input
                        value={formatDate(task.due_date)}
                        readOnly
                        disabled
                        className="mt-1 bg-muted"
                      />
                    </div>
                  </div>

                  {/* Created date */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Fecha de creación</Label>
                    <Input
                      value={formatDate(task.created_at)}
                      readOnly
                      disabled
                      className="mt-1 bg-muted"
                    />
                  </div>

                  {/* Link to opportunity (if exists) */}
                  {task.project_code && opportunityId && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Oportunidad vinculada</Label>
                      <div className="mt-1">
                        <Link
                          href={`/dashboard/oportunidades/${opportunityId}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {task.project_code}
                        </Link>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Seguimiento Tab */}
            <TabsContent value="seguimiento" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Timeline de eventos</CardTitle>
                  <CardDescription className="text-xs">
                    Historial de cambios y actualizaciones
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <p>Timeline de eventos próximamente disponible</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Side Panel (1/3 width on large screens) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Comunicaciones */}
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-base">Comunicaciones</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <CaseChat conversationId={`TASK-${taskId}`} />
            </CardContent>
          </Card>

          {/* Archivos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Archivos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-sm text-muted-foreground">
                <p>Gestión de archivos próximamente disponible</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
