"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback, FormEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User as UserIcon, Save, Loader2, PanelRightClose, PanelRightOpen, Pencil, Sparkles, Archive, Plus, Paperclip, RefreshCw, ChevronsUpDown, Check, PlusCircle, Eye, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CaseChat } from "@/components/case-chat";
import { CreateOpportunityDialog } from "@/components/opportunities/create-opportunity-dialog";
import { DocumentManager } from "@/components/document-manager";
import { PermissionButton } from "@/components/PermissionButton";
import { usePermissions } from "@/contexts/PermissionsContext";

import api from "@/lib/axios";
import { Lead } from "@/lib/data";
import { COSTA_RICA_PROVINCES, getProvinceOptions, getCantonOptions, getDistrictOptions } from '@/lib/costa-rica-regions';
import { getMilestoneLabel, normalizeMilestoneValue, MILESTONE_OPTIONS, type MilestoneValue } from "@/lib/milestones";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// --- Types for Tareas ---

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
  milestone: MilestoneValue;
}

interface Agent {
  id: number;
  name: string;
  email: string;
}

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

const formatDateShort = (dateString?: string | null): string => {
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

const PROFESIONES_LIST = [
    "Abogado(a)",
    "Accountant",
    "Actor/Actriz",
    "Administrador(a) de Empresas",
    "Administrador(a) de Fincas",
    "Administrador(a) Público",
    "Agrónomo(a)",
    "Analista de Datos",
    "Analista de Sistemas",
    "Antropólogo(a)",
    "Archivista",
    "Arquitecto(a)",
    "Asistente Administrativo(a)",
    "Asistente Dental",
    "Asistente Legal",
    "Auditor(a)",
    "Bibliotecólogo(a)",
    "Biólogo(a)",
    "Bombero(a)",
    "Cajero(a)",
    "Chef / Cocinero(a)",
    "Chofer / Conductor(a)",
    "Comunicador(a) Social",
    "Conserje",
    "Contador(a)",
    "Criminólogo(a)",
    "Dentista / Odontólogo(a)",
    "Desarrollador(a) de Software",
    "Diseñador(a) Gráfico",
    "Diseñador(a) Industrial",
    "Economista",
    "Educador(a)",
    "Electricista",
    "Enfermero(a)",
    "Escritor(a)",
    "Estadístico(a)",
    "Farmacéutico(a)",
    "Filólogo(a)",
    "Filósofo(a)",
    "Físico(a)",
    "Fisioterapeuta",
    "Fotógrafo(a)",
    "Funcionario(a) Público",
    "Geógrafo(a)",
    "Geólogo(a)",
    "Gestor(a) Ambiental",
    "Guarda de Seguridad",
    "Historiador(a)",
    "Ingeniero(a) Agrícola",
    "Ingeniero(a) Ambiental",
    "Ingeniero(a) Civil",
    "Ingeniero(a) Eléctrico",
    "Ingeniero(a) Electrónico",
    "Ingeniero(a) en Computación",
    "Ingeniero(a) en Sistemas",
    "Ingeniero(a) Industrial",
    "Ingeniero(a) Mecánico",
    "Ingeniero(a) Químico",
    "Investigador(a)",
    "Laboratorista",
    "Locutor(a)",
    "Matemático(a)",
    "Mecánico(a)",
    "Médico(a)",
    "Mercadólogo(a)",
    "Meteorólogo(a)",
    "Microbiólogo(a)",
    "Misceláneo(a)",
    "Músico(a)",
    "Notario(a)",
    "Nutricionista",
    "Obrero(a)",
    "Oficial de Seguridad",
    "Operador(a) de Maquinaria",
    "Optometrista",
    "Orientador(a)",
    "Paramédico(a)",
    "Pediatra",
    "Periodista",
    "Piloto",
    "Planificador(a)",
    "Policía",
    "Politólogo(a)",
    "Profesor(a) Universitario",
    "Programador(a)",
    "Promotor(a) Social",
    "Psicólogo(a)",
    "Psiquiatra",
    "Publicista",
    "Químico(a)",
    "Radiólogo(a)",
    "Recepcionista",
    "Relacionista Público",
    "Secretario(a)",
    "Sociólogo(a)",
    "Soldador(a)",
    "Técnico(a) en Electrónica",
    "Técnico(a) en Enfermería",
    "Técnico(a) en Informática",
    "Técnico(a) en Mantenimiento",
    "Técnico(a) en Refrigeración",
    "Tecnólogo(a) Médico",
    "Teólogo(a)",
    "Terapeuta Ocupacional",
    "Topógrafo(a)",
    "Trabajador(a) Social",
    "Traductor(a)",
    "Vendedor(a)",
    "Veterinario(a)",
    "Otro",
].sort();

// --- TareasTab Component ---

interface TareasTabProps {
  opportunityReference: string;
  opportunityId: number;
}

function TareasTab({ opportunityReference, opportunityId }: TareasTabProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formValues, setFormValues] = useState({
    project_code: opportunityReference,
    project_name: "sin_hito" as MilestoneValue,
    title: "",
    details: "",
    status: "pendiente" as TaskStatus,
    priority: "media" as TaskPriority,
    assigned_to: "",
    start_date: "",
    due_date: "",
  });

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/tareas', {
        params: { project_code: opportunityReference }
      });
      const data = response.data.data || response.data;
      setTasks(Array.isArray(data) ? data.map((item: any) => ({
        ...item,
        milestone: normalizeMilestoneValue(item.project_name)
      })) : []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast({ title: "Error", description: "No se pudieron cargar las tareas.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [opportunityReference, toast]);

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
    fetchAgents();
  }, [fetchTasks, fetchAgents]);

  const resetForm = useCallback(() => {
    setFormValues({
      project_code: opportunityReference,
      project_name: "sin_hito",
      title: "",
      details: "",
      status: "pendiente",
      priority: "media",
      assigned_to: "",
      start_date: "",
      due_date: "",
    });
  }, [opportunityReference]);

  const openCreateDialog = useCallback(() => {
    resetForm();
    setIsCreateDialogOpen(true);
  }, [resetForm]);

  const closeDialog = useCallback(() => {
    setIsCreateDialogOpen(false);
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

      await api.post('/api/tareas', body);
      toast({ title: "Creado", description: "Tarea creada correctamente." });
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

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Tareas del Lead</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {tasks.length > 0 ? `${tasks.length} ${tasks.length === 1 ? "tarea" : "tareas"}` : "No hay tareas"}
            </p>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Crear Tarea
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No hay tareas para este lead.</p>
              <Button onClick={openCreateDialog} variant="outline" className="mt-4 gap-2">
                <PlusCircle className="h-4 w-4" />
                Crear primera tarea
              </Button>
            </div>
          ) : (
            <div className="relative w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead className="hidden md:table-cell">Hito</TableHead>
                    <TableHead className="hidden md:table-cell">Responsable</TableHead>
                    <TableHead className="hidden lg:table-cell">Vencimiento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map(task => {
                    const isOverdue = isTaskOverdue(task);
                    return (
                      <TableRow
                        key={task.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/dashboard/tareas/${task.id}`)}
                      >
                        <TableCell className="font-mono text-sm">
                          <span className="font-semibold">{formatTaskReference(task.id)}</span>
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
                          <span className="text-sm">{getMilestoneLabel(task.milestone)}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm">{task.assignee?.name || "-"}</span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-col">
                            <span className="text-sm">{formatDateShort(task.due_date)}</span>
                            {isOverdue && (
                              <Badge variant="destructive" className="w-fit mt-1 text-xs">ATRASADA</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Task Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Tarea</DialogTitle>
            <DialogDescription>Crea una nueva tarea para este lead.</DialogDescription>
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
                <Label htmlFor="project_code">Código de proyecto</Label>
                <Input
                  id="project_code"
                  value={formValues.project_code}
                  readOnly
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="milestone">Hito</Label>
                <Select
                  value={formValues.project_name}
                  onValueChange={(value) => handleFormChange("project_name", value)}
                >
                  <SelectTrigger id="milestone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MILESTONE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
    </>
  );
}

export default function LeadDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { hasPermission, permissions, loading: permsLoading } = usePermissions();

    // Force re-eval
    const id = params.id as string;
    const mode = searchParams.get("mode") || "view"; // view | edit
    // Solo permitir modo edición si tiene permiso
    const canEdit = hasPermission('crm', 'edit');
    const canArchive = hasPermission('crm', 'archive');
    const isEditMode = mode === "edit" && canEdit;

    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<Partial<Lead>>({});
    const [isPanelVisible, setIsPanelVisible] = useState(false);
    const [isOpportunityDialogOpen, setIsOpportunityDialogOpen] = useState(false);
    const [agents, setAgents] = useState<{id: number, name: string}[]>([]);
    const [deductoras, setDeductoras] = useState<{id: number, nombre: string}[]>([]);
    const [instituciones, setInstituciones] = useState<{id: number, nombre: string}[]>([]);
    const [institucionSearch, setInstitucionSearch] = useState("");
    const [institucionOpen, setInstitucionOpen] = useState(false);
    const [profesionSearch, setProfesionSearch] = useState("");
    const [profesionOpen, setProfesionOpen] = useState(false);
    const [opportunities, setOpportunities] = useState<{id: string, opportunity_type: string, status: string}[]>([]);
    const [syncing, setSyncing] = useState(false);

    // Protección: redirigir si intenta editar sin permiso
    useEffect(() => {
        if (mode === "edit" && !canEdit && !permsLoading) {
            toast({
                title: "Acceso denegado",
                description: "No tienes permiso para editar leads.",
                variant: "destructive"
            });
            router.replace(`/dashboard/leads/${id}?mode=view`);
        }
    }, [mode, canEdit, permsLoading, id, router, toast]);

    useEffect(() => {
        const fetchLead = async () => {
            try {
                const response = await api.get(`/api/leads/${id}`);
                setLead(response.data);
                setFormData(response.data);
            } catch (error) {
                console.error("Error fetching lead:", error);
                toast({ title: "Error", description: "No se pudo cargar el lead.", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };

        const fetchAgents = async () => {
            try {
                const response = await api.get('/api/agents');
                setAgents(response.data);
            } catch (error) {
                console.error("Error fetching agents:", error);
            }
        };

        const fetchDeductoras = async () => {
            try {
                const response = await api.get('/api/deductoras');
                setDeductoras(response.data);
            } catch (error) {
                console.error("Error fetching deductoras:", error);
            }
        };

        const fetchInstituciones = async () => {
            try {
                const response = await api.get('/api/instituciones');
                setInstituciones(response.data.data || response.data);
            } catch (error) {
                console.error("Error fetching instituciones:", error);
            }
        };

        if (id) {
            fetchLead();
            fetchAgents();
            fetchDeductoras();
            fetchInstituciones();
        }
    }, [id, toast]);

    // Fetch opportunities when lead is loaded
    useEffect(() => {
        const fetchOpportunities = async () => {
            if (!lead?.cedula) return;
            try {
                const response = await api.get(`/api/opportunities?lead_cedula=${lead.cedula}`);
                setOpportunities(response.data.data || []);
            } catch (error) {
                console.error("Error fetching opportunities:", error);
            }
        };
        fetchOpportunities();
    }, [lead?.cedula]);

    // Sync files to all opportunities
    const handleSyncToOpportunities = async () => {
        if (!lead?.cedula || opportunities.length === 0) {
            toast({ title: "Sin oportunidades", description: "Este lead no tiene oportunidades asociadas.", variant: "destructive" });
            return;
        }

        setSyncing(true);
        let totalSynced = 0;

        try {
            for (const opp of opportunities) {
                const response = await api.post('/api/person-documents/sync-to-opportunity', {
                    cedula: lead.cedula,
                    opportunity_id: opp.id,
                });
                totalSynced += response.data.files_synced || 0;
            }

            toast({
                title: "Sincronización completada",
                description: `${totalSynced} archivo(s) sincronizado(s) a ${opportunities.length} oportunidad(es).`,
                className: "bg-green-600 text-white"
            });
        } catch (error) {
            console.error("Error syncing files:", error);
            toast({ title: "Error", description: "No se pudieron sincronizar los archivos.", variant: "destructive" });
        } finally {
            setSyncing(false);
        }
    };

    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    const autoSave = useCallback(async (updatedData: Partial<Lead>) => {
        try {
            setSaving(true);
            await api.put(`/api/leads/${id}`, updatedData);
            setLead(prev => ({ ...prev, ...updatedData } as Lead));
        } catch (error) {
            console.error("Error auto-saving lead:", error);
            toast({ title: "Error", description: "No se pudo guardar los cambios.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    }, [id, toast]);

    const handleInputChange = (field: keyof Lead, value: any) => {
        const newData = { ...formData, [field]: value };
        setFormData(newData);

        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }
        autoSaveTimerRef.current = setTimeout(() => {
            autoSave(newData);
        }, 800);
    };

    // --- Provincias / Cantones / Distritos (dirección principal)
    const provinceOptions = useMemo(() => getProvinceOptions(), []);

    const cantonOptions = useMemo(() => {
        const options = getCantonOptions(formData.province ?? "");
        if (formData.canton && !options.some(o => o.value === formData.canton)) {
            return [{ value: formData.canton, label: formData.canton }, ...options];
        }
        return options;
    }, [formData.province, formData.canton]);

    const districtOptions = useMemo(() => {
        const options = getDistrictOptions(formData.province ?? "", formData.canton ?? "");
        if (formData.distrito && !options.some(o => o.value === formData.distrito)) {
            return [{ value: formData.distrito, label: formData.distrito }, ...options];
        }
        return options;
    }, [formData.province, formData.canton, formData.distrito]);

    // --- Provincias / Cantones / Distritos (dirección trabajo)
    const workProvinceOptions = useMemo(() => getProvinceOptions(), []);

    const workCantonOptions = useMemo(() => {
        const options = getCantonOptions((formData as any).trabajo_provincia ?? "");
        const current = (formData as any).trabajo_canton;
        if (current && !options.some(o => o.value === current)) {
            return [{ value: current, label: current }, ...options];
        }
        return options;
    }, [(formData as any).trabajo_provincia, (formData as any).trabajo_canton]);

    const workDistrictOptions = useMemo(() => {
        const options = getDistrictOptions((formData as any).trabajo_provincia ?? "", (formData as any).trabajo_canton ?? "");
        const current = (formData as any).trabajo_distrito;
        if (current && !options.some(o => o.value === current)) {
            return [{ value: current, label: current }, ...options];
        }
        return options;
    }, [(formData as any).trabajo_provincia, (formData as any).trabajo_canton, (formData as any).trabajo_distrito]);

    const handleProvinceChange = (value: string) => {
        const newData = { ...formData, province: value, canton: "", distrito: "" };
        setFormData(newData);
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => autoSave(newData), 800);
    };

    const handleCantonChange = (value: string) => {
        const newData = { ...formData, canton: value, distrito: "" };
        setFormData(newData);
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => autoSave(newData), 800);
    };

    const handleDistrictChange = (value: string) => {
        const newData = { ...formData, distrito: value };
        setFormData(newData);
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => autoSave(newData), 800);
    };

    // Work Address Logic
    const handleWorkProvinceChange = (value: string) => {
        const newData = { ...formData, trabajo_provincia: value, trabajo_canton: "", trabajo_distrito: "" };
        setFormData(newData);
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => autoSave(newData), 800);
    };

    const handleWorkCantonChange = (value: string) => {
        const newData = { ...formData, trabajo_canton: value, trabajo_distrito: "" };
        setFormData(newData);
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => autoSave(newData), 800);
    };

    const handleWorkDistrictChange = (value: string) => {
        const newData = { ...formData, trabajo_distrito: value };
        setFormData(newData);
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => autoSave(newData), 800);
    };


    const handleArchive = async () => {
        if (!lead) return;
        if (!confirm(`¿Archivar a ${lead.name}?`)) return;
        try {
            await api.patch(`/api/leads/${id}/toggle-active`);
            toast({ title: "Archivado", description: "Lead archivado correctamente." });
            router.push('/dashboard/clientes');
        } catch (error) {
            console.error("Error archiving lead:", error);
            toast({ title: "Error", description: "No se pudo archivar el lead.", variant: "destructive" });
        }
    };

    if (loading) {
        return <div className="flex h-full items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    if (!lead) {
        return <div className="p-8 text-center">Lead no encontrado.</div>;
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.push('/dashboard/clientes')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span>volver al CRM</span>
                </div>
                <div className="flex items-center gap-2">
                    {isEditMode && saving && (
                        <span className="flex items-center text-sm text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando...
                        </span>
                    )}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setIsPanelVisible(!isPanelVisible)}
                                >
                                    {isPanelVisible ? (
                                        <PanelRightClose className="h-4 w-4" />
                                    ) : (
                                        <PanelRightOpen className="h-4 w-4" />
                                    )}
                                    <span className="sr-only">Toggle Panel</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isPanelVisible ? 'Ocultar Panel' : 'Mostrar Panel'}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <div className={isPanelVisible ? 'space-y-6 lg:col-span-3' : 'space-y-6 lg:col-span-5'}>
                    <Tabs defaultValue="datos" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-4">
                            <TabsTrigger value="datos">Datos</TabsTrigger>
                            <TabsTrigger value="tareas">Tareas</TabsTrigger>
                            <TabsTrigger value="archivos">Archivos</TabsTrigger>
                        </TabsList>

                        <TabsContent value="datos">
                            <Card>
                                <div className="p-6 pb-0">
                            <h1 className="text-2xl font-bold tracking-tight uppercase">{lead.name} {lead.apellido1}</h1>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <span>ID #{lead.id}</span>
                                <span> · </span>
                                <span>{lead.cedula}</span>
                                <span> · </span>
                                <span>Registrado {lead.created_at ? new Date(lead.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A'}</span>
                            </div>
                            
                            <div className="flex items-center gap-3 mt-4">
                                <Badge variant="secondary" className="rounded-full px-3 font-normal bg-slate-100 text-slate-800 hover:bg-slate-200">
                                    {lead.lead_status ? (typeof lead.lead_status === 'string' ? lead.lead_status : lead.lead_status.name) : 'abierto'}
                                </Badge>
                                <Badge variant="outline" className="rounded-full px-3 font-normal text-slate-600">
                                    Solo lectura
                                </Badge>

                                {!isEditMode && (
                                    <div className="flex items-center gap-2 ml-1">
                                        {!permsLoading && canEdit && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            className="h-9 w-9 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border-0"
                                                            onClick={() => router.push(`/dashboard/leads/${id}?mode=edit`)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Editar Lead</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}

                                        {!permsLoading && hasPermission('oportunidades', 'create') && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            className="h-9 w-9 rounded-md bg-blue-900 text-white hover:bg-blue-800 border-0"
                                                            onClick={() => setIsOpportunityDialogOpen(true)}
                                                        >
                                                            <Sparkles className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Crear Oportunidad</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}

                                        {!permsLoading && canArchive && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            className="h-9 w-9 rounded-md bg-red-600 text-white hover:bg-red-700 border-0"
                                                            onClick={handleArchive}
                                                        >
                                                            <Archive className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Archivar</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <CardContent className="space-y-8">

                            {/* Personal Information */}
                            <div>
                                <h3 className="text-lg font-medium mb-4">Datos Personales</h3>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Nombre</Label>
                                        <Input
                                            value={formData.name || ""}
                                            onChange={(e) => handleInputChange("name", e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Primer Apellido</Label>
                                        <Input
                                            value={formData.apellido1 || ""}
                                            onChange={(e) => handleInputChange("apellido1", e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Segundo Apellido</Label>
                                        <Input
                                            value={formData.apellido2 || ""}
                                            onChange={(e) => handleInputChange("apellido2", e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Cédula</Label>
                                        <Input
                                            value={formData.cedula || ""}
                                            onChange={(e) => handleInputChange("cedula", e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Vencimiento Cédula</Label>
                                        <Input
                                            type="date"
                                            value={(formData as any).cedula_vencimiento || ""}
                                            onChange={(e) => handleInputChange("cedula_vencimiento" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fecha de Nacimiento</Label>
                                        <Input
                                            type="date"
                                            value={formData.fecha_nacimiento ? String(formData.fecha_nacimiento).split('T')[0] : ""}
                                            onChange={(e) => handleInputChange("fecha_nacimiento", e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Género</Label>
                                        {isEditMode ? (
                                            <Select 
                                                value={(formData as any).genero || ""} 
                                                onValueChange={(value) => handleInputChange("genero" as keyof Lead, value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar género" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Masculino">Masculino</SelectItem>
                                                    <SelectItem value="Femenino">Femenino</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input value={(formData as any).genero || ""} disabled />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Estado Civil</Label>
                                        {isEditMode ? (
                                            <Select 
                                                value={(formData as any).estado_civil || ""} 
                                                onValueChange={(value) => handleInputChange("estado_civil" as keyof Lead, value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar estado civil" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Soltero(a)">Soltero(a)</SelectItem>
                                                    <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                                                    <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                                                    <SelectItem value="Viudo(a)">Viudo(a)</SelectItem>
                                                    <SelectItem value="Unión Libre">Unión Libre</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input value={(formData as any).estado_civil || ""} disabled />
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Contact Information */}
                            <div>
                                <h3 className="text-lg font-medium mb-4">Información de Contacto</h3>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Email</Label>
                                        <Input
                                            value={formData.email || ""}
                                            onChange={(e) => handleInputChange("email", e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Teléfono Móvil</Label>
                                        <Input
                                            value={formData.phone || ""}
                                            onChange={(e) => handleInputChange("phone", e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Teléfono 2</Label>
                                        <Input
                                            value={(formData as any).telefono2 || ""}
                                            onChange={(e) => handleInputChange("telefono2" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Teléfono 3</Label>
                                        <Input
                                            value={(formData as any).telefono3 || ""}
                                            onChange={(e) => handleInputChange("telefono3" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>WhatsApp</Label>
                                        <Input
                                            value={formData.whatsapp || ""}
                                            onChange={(e) => handleInputChange("whatsapp", e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Teléfono Casa</Label>
                                        <Input
                                            value={(formData as any).tel_casa || ""}
                                            onChange={(e) => handleInputChange("tel_casa" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Address Information */}
                            <div>
                                <h3 className="text-lg font-medium mb-4">Dirección</h3>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Provincia</Label>
                                        {isEditMode ? (
                                            <Select 
                                                value={(formData as any).province || ""} 
                                                onValueChange={handleProvinceChange}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar provincia" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {provinceOptions.map((p) => (
                                                        <SelectItem key={p.value} value={p.value}>
                                                            {p.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input value={(formData as any).province || ""} disabled />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Cantón</Label>
                                        {isEditMode ? (
                                            <Select 
                                                value={(formData as any).canton || ""} 
                                                onValueChange={handleCantonChange}
                                                disabled={!formData?.province}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar cantón" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {cantonOptions.map((c) => (
                                                        <SelectItem key={c.value} value={c.value}>
                                                            {c.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                         ) : (
                                             <Input value={(formData as any).canton || ""} disabled />
                                         )}
                                     </div>
                                     <div className="space-y-2">
                                         <Label>Distrito</Label>
                                         {isEditMode ? (
                                            <Select
                                                value={(formData as any).distrito || ""} 
                                                onValueChange={handleDistrictChange}
                                                disabled={!formData?.canton}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar distrito" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {districtOptions.map((d) => (
                                                        <SelectItem key={d.value} value={d.value}>
                                                            {d.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                         ) : (
                                             <Input value={(formData as any).distrito || ""} disabled />
                                         )}
                                     </div>

                                    <div className="col-span-3 md:col-span-2 space-y-2">
                                        <Label>Dirección Exacta</Label>
                                        <Textarea
                                            value={formData.direccion1 || ""}
                                            onChange={(e) => handleInputChange("direccion1", e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="col-span-3 md:col-span-1 space-y-2">
                                        <Label>Dirección 2 (Opcional)</Label>
                                        <Textarea
                                            value={(formData as any).direccion2 || ""}
                                            onChange={(e) => handleInputChange("direccion2" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Employment Information */}
                            <div>
                                <h3 className="text-lg font-medium mb-4">Información Laboral</h3>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Nivel Académico</Label>
                                        {isEditMode ? (
                                            <Select
                                                value={(formData as any).nivel_academico || ""}
                                                onValueChange={(value) => handleInputChange("nivel_academico" as keyof Lead, value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar nivel académico" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="primaria">Primaria</SelectItem>
                                                    <SelectItem value="secundaria">Secundaria</SelectItem>
                                                    <SelectItem value="tecnico">Técnico / Vocacional</SelectItem>
                                                    <SelectItem value="universitario">Universitario</SelectItem>
                                                    <SelectItem value="posgrado">Posgrado</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input
                                                value={(formData as any).nivel_academico || ""}
                                                disabled
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Profesión</Label>
                                        {isEditMode ? (
                                            <Popover open={profesionOpen} onOpenChange={setProfesionOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={profesionOpen}
                                                        className="w-full justify-between font-normal"
                                                    >
                                                        {(formData as any).profesion || "Seleccionar profesión"}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[300px] p-0" align="start">
                                                    <div className="p-2 border-b">
                                                        <Input
                                                            placeholder="Buscar profesión..."
                                                            value={profesionSearch}
                                                            onChange={(e) => setProfesionSearch(e.target.value)}
                                                            className="h-8"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div className="max-h-[200px] overflow-y-auto">
                                                        {PROFESIONES_LIST
                                                            .filter(p => p.toLowerCase().includes(profesionSearch.toLowerCase()))
                                                            .map((prof) => (
                                                                <div
                                                                    key={prof}
                                                                    className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent"
                                                                    onClick={() => {
                                                                        handleInputChange("profesion" as keyof Lead, prof);
                                                                        setProfesionOpen(false);
                                                                        setProfesionSearch("");
                                                                    }}
                                                                >
                                                                    <Check className={`h-4 w-4 ${(formData as any).profesion === prof ? "opacity-100" : "opacity-0"}`} />
                                                                    {prof}
                                                                </div>
                                                            ))
                                                        }
                                                        {PROFESIONES_LIST.filter(p => p.toLowerCase().includes(profesionSearch.toLowerCase())).length === 0 && (
                                                            <div className="px-3 py-2 text-sm text-muted-foreground">No se encontraron resultados</div>
                                                        )}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        ) : (
                                            <Input
                                                value={(formData as any).profesion || ""}
                                                disabled
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Sector</Label>
                                        <Input 
                                            value={(formData as any).sector || ""} 
                                            onChange={(e) => handleInputChange("sector" as keyof Lead, e.target.value)} 
                                            disabled={!isEditMode} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Puesto</Label>
                                        <Input 
                                            value={(formData as any).puesto || ""} 
                                            onChange={(e) => handleInputChange("puesto" as keyof Lead, e.target.value)} 
                                            disabled={!isEditMode} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Nombramiento</Label>
                                        <Select
                                            value={(formData as any).estado_puesto || ""}
                                            onValueChange={(value) => handleInputChange("estado_puesto" as keyof Lead, value)}
                                            disabled={!isEditMode}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar nombramiento" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Propiedad">Propiedad</SelectItem>
                                                <SelectItem value="Interino">Interino</SelectItem>
                                                <SelectItem value="De paso">De paso</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Institución</Label>
                                        {isEditMode ? (
                                            <Popover open={institucionOpen} onOpenChange={setInstitucionOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={institucionOpen}
                                                        className="w-full justify-between font-normal"
                                                    >
                                                        {(formData as any).institucion_labora || "Seleccionar institución"}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[300px] p-0" align="start">
                                                    <div className="p-2 border-b">
                                                        <Input
                                                            placeholder="Buscar institución..."
                                                            value={institucionSearch}
                                                            onChange={(e) => setInstitucionSearch(e.target.value)}
                                                            className="h-8"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div className="max-h-[200px] overflow-y-auto">
                                                        {instituciones
                                                            .filter(inst => inst.nombre.toLowerCase().includes(institucionSearch.toLowerCase()))
                                                            .sort((a, b) => a.nombre.localeCompare(b.nombre))
                                                            .map((inst) => (
                                                                <div
                                                                    key={inst.id}
                                                                    className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent"
                                                                    onClick={() => {
                                                                        handleInputChange("institucion_labora" as keyof Lead, inst.nombre);
                                                                        setInstitucionOpen(false);
                                                                        setInstitucionSearch("");
                                                                    }}
                                                                >
                                                                    <Check className={`h-4 w-4 ${(formData as any).institucion_labora === inst.nombre ? "opacity-100" : "opacity-0"}`} />
                                                                    {inst.nombre}
                                                                </div>
                                                            ))
                                                        }
                                                        {instituciones.filter(inst => inst.nombre.toLowerCase().includes(institucionSearch.toLowerCase())).length === 0 && (
                                                            <div className="px-3 py-2 text-sm text-muted-foreground">No se encontraron resultados</div>
                                                        )}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        ) : (
                                            <Input
                                                value={(formData as any).institucion_labora || ""}
                                                disabled
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Deductora</Label>
                                        <div className="flex items-center gap-6">
                                            {deductoras.map((deductora) => (
                                                <Button
                                                    key={deductora.id}
                                                    type="button"
                                                    variant={(formData as any).deductora_id === deductora.id ? "default" : "outline"}
                                                    size="default"
                                                    onClick={() => isEditMode && handleInputChange("deductora_id" as keyof Lead, deductora.id)}
                                                    disabled={!isEditMode}
                                                    className={`flex-1 ${(formData as any).deductora_id === deductora.id ? "bg-primary text-primary-foreground" : ""}`}
                                                >
                                                    {deductora.nombre}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Work Address */}
                                    <div className="col-span-3">
                                        <h4 className="text-sm font-medium mb-2 mt-2">Dirección del Trabajo</h4>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Provincia</Label>
                                        {isEditMode ? (
                                            <Select 
                                                value={(formData as any).trabajo_provincia || ""} 
                                                onValueChange={handleWorkProvinceChange}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar provincia" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {workProvinceOptions.map((p) => (
                                                        <SelectItem key={p.value} value={p.value}>
                                                            {p.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input value={(formData as any).trabajo_provincia || ""} disabled />
                                        )}
                                    </div>
                                     <div className="space-y-2">
                                         <Label>Cantón</Label>
                                         {isEditMode ? (
                                            <Select
                                                value={(formData as any).trabajo_canton || ""} 
                                                onValueChange={handleWorkCantonChange}
                                                disabled={!((formData as any).trabajo_provincia)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar cantón" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {workCantonOptions.map((c) => (
                                                        <SelectItem key={c.value} value={c.value}>
                                                            {c.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                         ) : (
                                             <Input value={(formData as any).trabajo_canton || ""} disabled />
                                         )}
                                     </div>
                                     <div className="space-y-2">
                                         <Label>Distrito</Label>
                                         {isEditMode ? (
                                            <Select
                                                value={(formData as any).trabajo_distrito || ""} 
                                                onValueChange={handleWorkDistrictChange}
                                                disabled={!((formData as any).trabajo_canton)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar distrito" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {workDistrictOptions.map((d) => (
                                                        <SelectItem key={d.value} value={d.value}>
                                                            {d.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                         ) : (
                                             <Input value={(formData as any).trabajo_distrito || ""} disabled />
                                         )}
                                     </div>
                                    <div className="col-span-3 space-y-2">
                                         <Label>Dirección Exacta (Trabajo)</Label>
                                         <Textarea
                                             value={(formData as any).trabajo_direccion || ""}
                                             onChange={(e) => handleInputChange("trabajo_direccion" as keyof Lead, e.target.value)}
                                             disabled={!isEditMode}
                                         />
                                     </div>

                                    {/* Economic Activity */}
                                    <div className="col-span-3">
                                        <h4 className="text-sm font-medium mb-2 mt-2">Actividad Económica</h4>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Actividad Económica</Label>
                                        <Input 
                                            value={(formData as any).actividad_economica || ""} 
                                            onChange={(e) => handleInputChange("actividad_economica" as keyof Lead, e.target.value)} 
                                            disabled={!isEditMode} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Tipo Sociedad</Label>
                                        {isEditMode ? (
                                            <Select 
                                                value={(formData as any).tipo_sociedad || ""} 
                                                onValueChange={(value) => handleInputChange("tipo_sociedad" as keyof Lead, value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar tipo" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="S.R.L" textValue="Sociedad de Responsabilidad Limitada">S.R.L</SelectItem>
                                                    <SelectItem value="ECMAN" textValue="Empresa en Comandita">ECMAN</SelectItem>
                                                    <SelectItem value="LTDA" textValue="Limitada">LTDA</SelectItem>
                                                    <SelectItem value="OC" textValue="Optima Consultores">OC</SelectItem>
                                                    <SelectItem value="RL" textValue="Responsabilidad Limitada">RL</SelectItem>
                                                    <SelectItem value="SA" textValue="Sociedad Anónima">SA</SelectItem>
                                                    <SelectItem value="SACV" textValue="Sociedad Anónima de Capital Variable">SACV</SelectItem>
                                                    <SelectItem value="No indica" textValue="No indica">No indica</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input value={(formData as any).tipo_sociedad || ""} disabled />
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* System & Other Information */}
                            <div>
                                <h3 className="text-lg font-medium mb-4">Otros Detalles</h3>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Responsable</Label>
                                        {isEditMode ? (
                                            <Select 
                                                value={String((formData as any).assigned_to_id || "")} 
                                                onValueChange={(value) => handleInputChange("assigned_to_id" as keyof Lead, value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar responsable" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {agents.map((agent) => (
                                                        <SelectItem key={agent.id} value={String(agent.id)}>
                                                            {agent.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input 
                                                value={agents.find(a => a.id === (formData as any).assigned_to_id)?.name || (formData as any).assigned_to_id || ""} 
                                                disabled 
                                            />
                                        )}
                                    </div>
                                    {/*<div className="space-y-2">*/}
                                    {/*    <Label>Estado</Label>*/}
                                    {/*    <Input*/}
                                    {/*        value={(formData as any).status || ""}*/}
                                    {/*        onChange={(e) => handleInputChange("status" as keyof Lead, e.target.value)}*/}
                                    {/*        disabled={!isEditMode}*/}
                                    {/*    />*/}
                                    {/*</div>*/}
                                    <div className="space-y-2">
                                        <Label>Fuente (Source)</Label>
                                        <Input
                                            value={(formData as any).source || ""}
                                            onChange={(e) => handleInputChange("source" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="col-span-3 space-y-2">
                                        <Label>Notas</Label>
                                        <Textarea
                                            value={(formData as any).notes || ""}
                                            onChange={(e) => handleInputChange("notes" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                        </TabsContent>

                        <TabsContent value="tareas">
                            <TareasTab opportunityReference={lead.cedula} opportunityId={lead.id} />
                        </TabsContent>

                        <TabsContent value="archivos">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2">
                                            <Paperclip className="h-5 w-5" />
                                            Archivos del Lead
                                        </CardTitle>
                                        {opportunities.length > 0 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleSyncToOpportunities}
                                                disabled={syncing}
                                            >
                                                {syncing ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="mr-2 h-4 w-4" />
                                                )}
                                                Sincronizar a Oportunidades ({opportunities.length})
                                            </Button>
                                        )}
                                    </div>
                                    {opportunities.length > 0 && (
                                        <CardDescription className="mt-2">
                                            Los archivos subidos aquí se copian automáticamente a las oportunidades.
                                            Use el botón para sincronizar archivos existentes.
                                        </CardDescription>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <DocumentManager
                                        personId={Number(lead.id)}
                                        initialDocuments={(lead as any).documents || []}
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Side Panel */}
                {isPanelVisible && (
                    <div className="space-y-1 lg:col-span-2 ">
                        <CaseChat conversationId={id} />
                    </div>
                )}
            </div>

            <CreateOpportunityDialog
                open={isOpportunityDialogOpen}
                onOpenChange={setIsOpportunityDialogOpen}
                leads={lead ? [lead] : []}
                defaultLeadId={lead ? String(lead.id) : undefined}
                onSuccess={() => window.location.reload()}
            />
        </div>
    );
}
