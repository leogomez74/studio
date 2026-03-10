"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Upload,
  Trash2,
  Download,
  FileText,
  Clock,
  Edit2,
  Plus,
  CheckSquare,
  Square,
  Check,
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
import { API_BASE_URL } from "@/lib/env";
import { useAuth } from "@/components/auth-guard";
import { CaseChat } from "@/components/case-chat";

// --- Types ---

type TaskStatus = "pendiente" | "en_progreso" | "completada" | "archivada" | "deleted";
type TaskPriority = "alta" | "media" | "baja";

interface Agent {
  id: number;
  name: string;
  email: string;
}

interface TaskItem {
  id: number;
  project_code: string | null;
  project_name: string | null;
  title: string;
  details: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: number | null;
  assignee: Agent | null;
  start_date: string | null;
  due_date: string | null;
  archived_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface TimelineEntry {
  id: number;
  user_name: string;
  action: string;
  changes: { field: string; old_value: string | null; new_value: string | null }[] | null;
  created_at: string;
}

interface TaskDoc {
  id: number;
  task_id: number;
  uploaded_by: number | null;
  name: string;
  path: string;
  url: string | null;
  mime_type: string | null;
  size: number | null;
  notes: string | null;
  created_at: string;
  uploader: { id: number; name: string } | null;
}

interface ChecklistItem {
  id: number;
  task_id: number;
  title: string;
  is_completed: boolean;
  sort_order: number;
  completed_at: string | null;
}

// --- Helper Functions ---

const formatTaskReference = (id: number): string => `TA-${String(id).padStart(4, "0")}`;

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

const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const toDateInput = (dateString: string | null): string => {
  if (!dateString) return "";
  return dateString.substring(0, 10);
};

const MODULE_LABELS: Record<string, string> = {
  LEAD: "Lead vinculado",
  OPP: "Oportunidad vinculada",
  ANA: "Análisis vinculado",
  CRED: "Crédito vinculado",
  CLIENT: "Cliente vinculado",
};

const parseProjectCode = (projectCode: string | null): { module: string; id: string; url: string; label: string } | null => {
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
  return { module, id, url: urlMap[module] || "", label: MODULE_LABELS[module] || "Entidad vinculada" };
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

const ACTION_LABELS: Record<string, string> = {
  create: "Creación",
  update: "Actualización",
  delete: "Eliminación",
  upload: "Archivo subido",
  archive: "Archivado",
};

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  details: "Descripción",
  status: "Estado",
  priority: "Prioridad",
  assigned_to: "Asignado a",
  start_date: "Fecha inicio",
  due_date: "Fecha vencimiento",
  documento: "Documento",
  project_code: "Código proyecto",
  project_name: "Nombre proyecto",
};

// --- Main Component ---

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { token } = useAuth();
  const taskId = params.id as string;

  const [task, setTask] = useState<TaskItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDetails, setEditedDetails] = useState("");
  const [editedPriority, setEditedPriority] = useState<TaskPriority>("media");
  const [editedAssignedTo, setEditedAssignedTo] = useState("");
  const [editedStartDate, setEditedStartDate] = useState("");
  const [editedDueDate, setEditedDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Users
  const [users, setUsers] = useState<Agent[]>([]);

  // Timeline
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Documents
  const [documents, setDocuments] = useState<TaskDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");

  // Fetch task data
  const fetchTask = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/tareas/${taskId}`);
      const data = res.data as TaskItem;
      setTask(data);
      setEditedTitle(data.title);
      setEditedDetails(data.details || "");
      setEditedPriority(data.priority);
      setEditedAssignedTo(data.assigned_to ? String(data.assigned_to) : "");
      setEditedStartDate(toDateInput(data.start_date));
      setEditedDueDate(toDateInput(data.due_date));
    } catch (err) {
      console.error("Error fetching task:", err);
      setError("No se pudo cargar la tarea.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) setUsers(await res.json());
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }, [token]);

  const fetchTimeline = useCallback(async () => {
    try {
      setTimelineLoading(true);
      const res = await api.get(`/api/tareas/${taskId}/timeline`);
      setTimeline(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching timeline:", err);
    } finally {
      setTimelineLoading(false);
    }
  }, [taskId]);

  const fetchDocuments = useCallback(async () => {
    try {
      setDocsLoading(true);
      const res = await api.get(`/api/tareas/${taskId}/documents`);
      setDocuments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching documents:", err);
    } finally {
      setDocsLoading(false);
    }
  }, [taskId]);

  const fetchChecklist = useCallback(async () => {
    try {
      setChecklistLoading(true);
      const res = await api.get(`/api/tareas/${taskId}/checklist`);
      setChecklist(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching checklist:", err);
    } finally {
      setChecklistLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (taskId && token) {
      fetchTask();
      fetchUsers();
      fetchTimeline();
      fetchDocuments();
      fetchChecklist();
    }
  }, [taskId, token, fetchTask, fetchUsers, fetchTimeline, fetchDocuments, fetchChecklist]);

  // Save all editable fields
  const handleSave = async () => {
    if (!task) return;
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        title: editedTitle,
        details: editedDetails,
        priority: editedPriority,
        assigned_to: editedAssignedTo ? Number(editedAssignedTo) : null,
        start_date: editedStartDate || null,
        due_date: editedDueDate || null,
      };
      const res = await api.put(`/api/tareas/${task.id}`, payload);
      setTask(res.data as TaskItem);
      toast({ title: "Guardado", description: "La tarea se actualizó correctamente." });
      fetchTimeline();
    } catch (err) {
      console.error("Error saving task:", err);
      toast({ title: "Error", description: "No se pudo guardar la tarea.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Quick status update
  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!task) return;
    const previousStatus = task.status;
    try {
      setUpdatingStatus(true);
      setTask((prev) => (prev ? { ...prev, status: newStatus } : null));
      await api.put(`/api/tareas/${task.id}`, { status: newStatus });
      toast({ title: "Estado actualizado", description: `La tarea ahora está ${STATUS_LABELS[newStatus].toLowerCase()}.` });
      fetchTimeline();
    } catch (err) {
      console.error("Error updating status:", err);
      setTask((prev) => (prev ? { ...prev, status: previousStatus } : null));
      toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Upload document
  const handleUploadDocument = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file || !uploadName.trim()) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", uploadName.trim());
      if (uploadNotes.trim()) formData.append("notes", uploadNotes.trim());

      const res = await api.post(`/api/tareas/${taskId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDocuments((prev) => [res.data as TaskDoc, ...prev]);
      setUploadName("");
      setUploadNotes("");
      setShowUploadForm(false);
      fileInput.value = "";
      toast({ title: "Archivo subido", description: "El documento se subió correctamente." });
      fetchTimeline();
    } catch (err) {
      console.error("Error uploading document:", err);
      toast({ title: "Error", description: "No se pudo subir el archivo.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // Delete document
  const handleDeleteDocument = async (docId: number) => {
    try {
      await api.delete(`/api/tareas/${taskId}/documents/${docId}`);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast({ title: "Eliminado", description: "El documento se eliminó correctamente." });
      fetchTimeline();
    } catch (err) {
      console.error("Error deleting document:", err);
      toast({ title: "Error", description: "No se pudo eliminar el documento.", variant: "destructive" });
    }
  };

  // Checklist operations
  const handleToggleChecklistItem = async (itemId: number) => {
    try {
      const res = await api.patch(`/api/tareas/${taskId}/checklist/${itemId}/toggle`);
      setChecklist((prev) => prev.map((item) => (item.id === itemId ? (res.data as ChecklistItem) : item)));
    } catch (err) {
      console.error("Error toggling checklist item:", err);
      toast({ title: "Error", description: "No se pudo actualizar el ítem.", variant: "destructive" });
    }
  };

  const handleAddChecklistItem = async () => {
    if (!newItemTitle.trim()) return;
    try {
      const res = await api.post(`/api/tareas/${taskId}/checklist`, { title: newItemTitle.trim() });
      setChecklist((prev) => [...prev, res.data as ChecklistItem]);
      setNewItemTitle("");
    } catch (err) {
      console.error("Error adding checklist item:", err);
      toast({ title: "Error", description: "No se pudo agregar el ítem.", variant: "destructive" });
    }
  };

  const handleDeleteChecklistItem = async (itemId: number) => {
    try {
      await api.delete(`/api/tareas/${taskId}/checklist/${itemId}`);
      setChecklist((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      console.error("Error deleting checklist item:", err);
      toast({ title: "Error", description: "No se pudo eliminar el ítem.", variant: "destructive" });
    }
  };

  const completedCount = checklist.filter((i) => i.is_completed).length;
  const totalCount = checklist.length;

  // Check if form has changes
  const hasChanges = task
    ? editedTitle !== task.title ||
      editedDetails !== (task.details || "") ||
      editedPriority !== task.priority ||
      editedAssignedTo !== (task.assigned_to ? String(task.assigned_to) : "") ||
      editedStartDate !== toDateInput(task.start_date) ||
      editedDueDate !== toDateInput(task.due_date)
    : false;

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
          <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard/tareas")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver al listado
          </Button>
        </div>
      </div>
    );
  }

  const isOverdue = isTaskOverdue(task);
  const parsed = parseProjectCode(task.project_code);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/tareas")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-800">{formatTaskReference(task.id)}</h1>
              <Badge variant={STATUS_VARIANTS[task.status]}>{STATUS_LABELS[task.status]}</Badge>
              <Badge variant={PRIORITY_VARIANTS[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
              {isOverdue && (
                <Badge variant="destructive" className="bg-red-600">ATRASADA</Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">{task.title}</p>
          </div>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cambios
          </Button>
        )}
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
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

          {/* Tabs */}
          <Tabs defaultValue="resumen" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="seguimiento">Seguimiento</TabsTrigger>
              <TabsTrigger value="archivos">Archivos</TabsTrigger>
            </TabsList>

            {/* Resumen Tab */}
            <TabsContent value="resumen" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Edit2 className="h-4 w-4" /> Detalles de la tarea
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Title */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Título</Label>
                    <Input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Descripción</Label>
                    <Textarea
                      value={editedDetails}
                      onChange={(e) => setEditedDetails(e.target.value)}
                      placeholder="Describe los detalles de la tarea..."
                      rows={5}
                      className="mt-1"
                    />
                  </div>

                  {/* Priority & Assigned */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Prioridad</Label>
                      <Select value={editedPriority} onValueChange={(v) => setEditedPriority(v as TaskPriority)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="media">Media</SelectItem>
                          <SelectItem value="baja">Baja</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Asignado a</Label>
                      <Select value={editedAssignedTo || "none"} onValueChange={(v) => setEditedAssignedTo(v === "none" ? "" : v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Fecha de inicio</Label>
                      <Input
                        type="date"
                        value={editedStartDate}
                        onChange={(e) => setEditedStartDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Fecha de vencimiento</Label>
                      <Input
                        type="date"
                        value={editedDueDate}
                        onChange={(e) => setEditedDueDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Created date (read-only) */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Fecha de creación</Label>
                    <Input value={formatDate(task.created_at)} readOnly disabled className="mt-1 bg-muted" />
                  </div>

                  {/* Link to related entity */}
                  {parsed && (
                    <div>
                      <Label className="text-xs text-muted-foreground">{parsed.label}</Label>
                      <div className="mt-1">
                        <Link href={parsed.url} className="text-sm text-blue-600 hover:underline">
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
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Timeline de eventos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Historial de cambios y actualizaciones
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {timelineLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : timeline.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p>No hay eventos registrados aún</p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Vertical line */}
                      <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

                      <div className="space-y-6">
                        {timeline.map((entry) => (
                          <div key={entry.id} className="relative pl-8">
                            {/* Dot */}
                            <div className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-background ${
                              entry.action === "create" ? "bg-green-500" :
                              entry.action === "delete" ? "bg-red-500" :
                              entry.action === "upload" ? "bg-blue-500" :
                              "bg-yellow-500"
                            }`} />

                            <div className="bg-muted/50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium">
                                  {ACTION_LABELS[entry.action] || entry.action}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDateTime(entry.created_at)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-1">
                                por {entry.user_name || "Sistema"}
                              </p>

                              {/* Changes detail */}
                              {entry.changes && entry.changes.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {entry.changes.map((change, idx) => (
                                    <div key={idx} className="text-xs bg-background rounded px-2 py-1">
                                      <span className="font-medium">{FIELD_LABELS[change.field] || change.field}:</span>{" "}
                                      {change.old_value ? (
                                        <>
                                          <span className="text-red-500 line-through">{change.old_value}</span>
                                          {" → "}
                                          <span className="text-green-600">{change.new_value || "—"}</span>
                                        </>
                                      ) : (
                                        <span className="text-green-600">{change.new_value || "—"}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Archivos Tab */}
            <TabsContent value="archivos" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Documentos adjuntos
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {documents.length} documento{documents.length !== 1 ? "s" : ""}
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowUploadForm(!showUploadForm)}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Subir
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Upload form */}
                  {showUploadForm && (
                    <form onSubmit={handleUploadDocument} className="border rounded-lg p-4 mb-4 space-y-3 bg-muted/30">
                      <div>
                        <Label className="text-xs">Nombre del documento</Label>
                        <Input
                          value={uploadName}
                          onChange={(e) => setUploadName(e.target.value)}
                          placeholder="Ej: Contrato firmado"
                          className="mt-1"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Archivo</Label>
                        <Input type="file" className="mt-1" required />
                      </div>
                      <div>
                        <Label className="text-xs">Notas (opcional)</Label>
                        <Input
                          value={uploadNotes}
                          onChange={(e) => setUploadNotes(e.target.value)}
                          placeholder="Observaciones sobre el documento"
                          className="mt-1"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowUploadForm(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" size="sm" disabled={uploading}>
                          {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                          Subir archivo
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Documents list */}
                  {docsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p>No hay documentos adjuntos</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/30">
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {doc.uploader?.name || "—"} · {formatDate(doc.created_at)}
                                {doc.size ? ` · ${formatFileSize(doc.size)}` : ""}
                              </p>
                              {doc.notes && (
                                <p className="text-xs text-muted-foreground italic mt-0.5">{doc.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            {doc.url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                              >
                                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Side Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Checklist */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" /> Checklist
                </CardTitle>
                {totalCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {completedCount}/{totalCount}
                  </span>
                )}
              </div>
              {totalCount > 0 && (
                <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${(completedCount / totalCount) * 100}%` }}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent>
              {checklistLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="space-y-1">
                  {checklist.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 group py-1">
                      <button
                        onClick={() => handleToggleChecklistItem(item.id)}
                        className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        {item.is_completed ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                      <span className={`text-sm flex-1 ${item.is_completed ? "line-through text-muted-foreground" : ""}`}>
                        {item.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteChecklistItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  {/* Add new item */}
                  <div className="flex items-center gap-2 pt-2">
                    <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      value={newItemTitle}
                      onChange={(e) => setNewItemTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddChecklistItem(); }}
                      placeholder="Agregar ítem..."
                      className="h-7 text-sm"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comunicaciones */}
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-base">Comunicaciones</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <CaseChat conversationId={`TASK-${taskId}`} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
