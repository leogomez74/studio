"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback, FormEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User as UserIcon, Save, Loader2, PanelRightClose, PanelRightOpen, Pencil, Sparkles, Archive, Plus, Paperclip, RefreshCw, ChevronsUpDown, Check, PlusCircle, Eye, X, AlertCircle } from "lucide-react";
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

const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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
    project_name: "sin_hito",
    title: "",
    details: "",
    status: "pendiente" as TaskStatus,
    priority: "media" as TaskPriority,
    assigned_to: "",
    start_date: getTodayDateString(),
    due_date: getTodayDateString(),
  });

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/tareas', {
        params: { project_code: opportunityReference }
      });
      const data = response.data.data || response.data;
      setTasks(Array.isArray(data) ? data : []);
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
      start_date: getTodayDateString(),
      due_date: getTodayDateString(),
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

    // Validar si el registro está completo
    const REQUIRED_FIELDS = [
        'cedula', 'name', 'apellido1', 'email', 'phone', 'whatsapp', 'fecha_nacimiento', 'estado_civil',
        'profesion', 'nivel_academico', 'puesto', 'institucion_labora', 'deductora_id', 'sector',
        'province', 'canton', 'distrito', 'direccion1',
        'trabajo_provincia', 'trabajo_canton', 'trabajo_distrito', 'trabajo_direccion'
    ];

    const checkIsComplete = useCallback(() => {
        if (!formData) return false;
        return REQUIRED_FIELDS.every(field => {
            const value = (formData as any)[field];
            if (field === 'deductora_id') return value && value !== 0;
            return value !== null && value !== undefined && value !== '';
        });
    }, [formData]);

    const isFieldMissing = useCallback((field: string) => {
        if (!formData || !REQUIRED_FIELDS.includes(field)) return false;
        const value = (formData as any)[field];
        if (field === 'deductora_id') return !value || value === 0;
        return value === null || value === undefined || value === '';
    }, [formData]);

    const getMissingDocuments = useCallback(() => {
        const documents = (lead as any)?.documents || [];
        if (documents.length === 0) return ['Cédula', 'Recibo de Servicio'];

        // Si ningún documento tiene categoría asignada (archivos viejos), no mostrar alerta
        const hasAnyCategory = documents.some((doc: any) => doc.category && doc.category !== 'otro');
        if (!hasAnyCategory) return [];

        const missing = [];
        const hasCedula = documents.some((doc: any) => doc.category === 'cedula');
        const hasRecibo = documents.some((doc: any) => doc.category === 'recibo_servicio');

        if (!hasCedula) missing.push('Cédula');
        if (!hasRecibo) missing.push('Recibo de Servicio');

        return missing;
    }, [lead]);

    const getMissingFieldsCount = useCallback(() => {
        if (!formData) return 0;
        return REQUIRED_FIELDS.filter(field => {
            const value = (formData as any)[field];
            if (field === 'deductora_id') return !value || value === 0;
            return value === null || value === undefined || value === '';
        }).length;
    }, [formData]);

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

    const fetchLead = useCallback(async () => {
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
    }, [id, toast]);

    useEffect(() => {

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

    const autoSave = useCallback(async () => {
        if (!isEditMode) return;
        const EDITABLE_FIELDS = [
            'name', 'apellido1', 'apellido2', 'cedula', 'email', 'phone', 'status', 'lead_status_id',
            'assigned_to_id', 'notes', 'source', 'whatsapp', 'tel_casa', 'tel_amigo',
            'province', 'canton', 'distrito', 'direccion1', 'direccion2',
            'ocupacion', 'estado_civil', 'relacionado_a', 'tipo_relacion', 'fecha_nacimiento',
            'is_active', 'cedula_vencimiento', 'genero', 'nacionalidad', 'telefono2', 'telefono3',
            'institucion_labora', 'departamento_cargo', 'deductora_id', 'nivel_academico',
            'profesion', 'sector', 'puesto', 'estado_puesto',
            'trabajo_provincia', 'trabajo_canton', 'trabajo_distrito', 'trabajo_direccion',
            'institucion_direccion', 'actividad_economica', 'tipo_sociedad', 'nombramientos',
        ];
        const payload = Object.fromEntries(
            Object.entries(formData).filter(([key]) => EDITABLE_FIELDS.includes(key))
        );
        try {
            setSaving(true);
            await api.put(`/api/leads/${id}`, payload);
            setLead(prev => ({ ...prev, ...formData } as Lead));
        } catch (error) {
            console.error("Error auto-saving lead:", error);
            toast({ title: "Error", description: "No se pudo guardar los cambios.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    }, [id, formData, isEditMode, toast]);

    const handleInputChange = (field: keyof Lead, value: any) => {
        setFormData({ ...formData, [field]: value });
    };

    const handleBlur = () => {
        if (isEditMode) {
            autoSave();
        }
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
        setFormData({ ...formData, province: value, canton: "", distrito: "" });
        // Guarda inmediatamente para selects
        if (isEditMode) setTimeout(autoSave, 100);
    };

    const handleCantonChange = (value: string) => {
        setFormData({ ...formData, canton: value, distrito: "" });
        if (isEditMode) setTimeout(autoSave, 100);
    };

    const handleDistrictChange = (value: string) => {
        setFormData({ ...formData, distrito: value });
        if (isEditMode) setTimeout(autoSave, 100);
    };

    // Work Address Logic
    const handleWorkProvinceChange = (value: string) => {
        setFormData({ ...formData, trabajo_provincia: value, trabajo_canton: "", trabajo_distrito: "" });
        if (isEditMode) setTimeout(autoSave, 100);
    };

    const handleWorkCantonChange = (value: string) => {
        setFormData({ ...formData, trabajo_canton: value, trabajo_distrito: "" });
        if (isEditMode) setTimeout(autoSave, 100);
    };

    const handleWorkDistrictChange = (value: string) => {
        setFormData({ ...formData, trabajo_distrito: value });
        if (isEditMode) setTimeout(autoSave, 100);
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
                            <TabsTrigger value="datos" className="relative">
                                Datos
                                {getMissingFieldsCount() > 0 && (
                                    <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                        {getMissingFieldsCount()}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="tareas">Tareas</TabsTrigger>
                            <TabsTrigger value="archivos" className="relative">
                                Archivos
                                {getMissingDocuments().length > 0 && (
                                    <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                        {getMissingDocuments().length}
                                    </span>
                                )}
                            </TabsTrigger>
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
                                                            disabled={!checkIsComplete()}
                                                        >
                                                            <Sparkles className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {checkIsComplete()
                                                            ? "Crear Oportunidad"
                                                            : "Complete el registro antes de crear oportunidad"
                                                        }
                                                    </TooltipContent>
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
                                        <Label>Nombre {isFieldMissing('name') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            value={formData.name || ""}
                                            onChange={(e) => handleInputChange("name", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Primer Apellido {isFieldMissing('apellido1') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            value={formData.apellido1 || ""}
                                            onChange={(e) => handleInputChange("apellido1", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Segundo Apellido</Label>
                                        <Input
                                            value={formData.apellido2 || ""}
                                            onChange={(e) => handleInputChange("apellido2", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Cédula {isFieldMissing('cedula') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            value={formData.cedula || ""}
                                            onChange={(e) => handleInputChange("cedula", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Vencimiento Cédula</Label>
                                        <Input
                                            type="date"
                                            value={(formData as any).cedula_vencimiento || ""}
                                            onChange={(e) => handleInputChange("cedula_vencimiento" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fecha de Nacimiento {isFieldMissing('fecha_nacimiento') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            type="date"
                                            value={formData.fecha_nacimiento ? String(formData.fecha_nacimiento).split('T')[0] : ""}
                                            onChange={(e) => handleInputChange("fecha_nacimiento", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
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
                                        <Label>Estado Civil {isFieldMissing('estado_civil') && <span className="text-red-500">*</span>}</Label>
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
                                        <Label>Email {isFieldMissing('email') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            value={formData.email || ""}
                                            onChange={(e) => handleInputChange("email", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Teléfono Móvil {isFieldMissing('phone') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            value={formData.phone || ""}
                                            onChange={(e) => handleInputChange("phone", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Teléfono 2</Label>
                                        <Input
                                            value={(formData as any).telefono2 || ""}
                                            onChange={(e) => handleInputChange("telefono2" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Teléfono Amigo</Label>
                                        <Input
                                            value={(formData as any).telefono3 || ""}
                                            onChange={(e) => handleInputChange("telefono3" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>WhatsApp {isFieldMissing('whatsapp') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            value={formData.whatsapp || ""}
                                            onChange={(e) => handleInputChange("whatsapp", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Teléfono Casa</Label>
                                        <Input
                                            value={(formData as any).tel_casa || ""}
                                            onChange={(e) => handleInputChange("tel_casa" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
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
                                        <Label>Provincia {isFieldMissing('province') && <span className="text-red-500">*</span>}</Label>
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
                                        <Label>Cantón {isFieldMissing('canton') && <span className="text-red-500">*</span>}</Label>
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
                                         <Label>Distrito {isFieldMissing('distrito') && <span className="text-red-500">*</span>}</Label>
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
                                        <Label>Dirección Exacta {isFieldMissing('direccion1') && <span className="text-red-500">*</span>}</Label>
                                        <Textarea
                                            value={formData.direccion1 || ""}
                                            onChange={(e) => handleInputChange("direccion1", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="col-span-3 md:col-span-1 space-y-2">
                                        <Label>Dirección 2 (Opcional)</Label>
                                        <Textarea
                                            value={(formData as any).direccion2 || ""}
                                            onChange={(e) => handleInputChange("direccion2" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
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
                                        <Label>Nivel Académico {isFieldMissing('nivel_academico') && <span className="text-red-500">*</span>}</Label>
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
                                        <Label>Profesión {isFieldMissing('profesion') && <span className="text-red-500">*</span>}</Label>
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
                                        <Label>Sector {isFieldMissing('sector') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            value={(formData as any).sector || ""}
                                            onChange={(e) => handleInputChange("sector" as keyof Lead, e.target.value)} 
                                            disabled={!isEditMode} onBlur={handleBlur} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Puesto {isFieldMissing('puesto') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            value={(formData as any).puesto || ""}
                                            onChange={(e) => handleInputChange("puesto" as keyof Lead, e.target.value)} 
                                            disabled={!isEditMode} onBlur={handleBlur} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Nombramiento</Label>
                                        <Select
                                            value={(formData as any).estado_puesto || ""}
                                            onValueChange={(value) => handleInputChange("estado_puesto" as keyof Lead, value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
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
                                        <Label>Institución {isFieldMissing('institucion_labora') && <span className="text-red-500">*</span>}</Label>
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
                                        <Label>Deductora {isFieldMissing('deductora_id') && <span className="text-red-500">*</span>}</Label>
                                        <div className="flex items-center gap-6">
                                            {deductoras.map((deductora) => (
                                                <Button
                                                    key={deductora.id}
                                                    type="button"
                                                    variant={(formData as any).deductora_id === deductora.id ? "default" : "outline"}
                                                    size="default"
                                                    onClick={() => isEditMode && handleInputChange("deductora_id" as keyof Lead, deductora.id)}
                                                    disabled={!isEditMode} onBlur={handleBlur}
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
                                        <Label>Provincia {isFieldMissing('trabajo_provincia') && <span className="text-red-500">*</span>}</Label>
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
                                         <Label>Cantón {isFieldMissing('trabajo_canton') && <span className="text-red-500">*</span>}</Label>
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
                                         <Label>Distrito {isFieldMissing('trabajo_distrito') && <span className="text-red-500">*</span>}</Label>
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
                                         <Label>Dirección Exacta (Trabajo) {isFieldMissing('trabajo_direccion') && <span className="text-red-500">*</span>}</Label>
                                         <Textarea
                                             value={(formData as any).trabajo_direccion || ""}
                                             onChange={(e) => handleInputChange("trabajo_direccion" as keyof Lead, e.target.value)}
                                             disabled={!isEditMode} onBlur={handleBlur}
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
                                {getMissingDocuments().length > 0 && (
                                    <div className="px-6 pb-4">
                                        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                                            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-red-900">Documentos obligatorios faltantes</p>
                                                <p className="text-sm text-red-700 mt-1">
                                                    {getMissingDocuments().map((doc, i) => (
                                                        <span key={doc}>
                                                            {i > 0 && ', '}
                                                            <span className="font-semibold">{doc}</span>
                                                        </span>
                                                    ))}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <CardContent>
                                    <DocumentManager
                                        personId={Number(lead.id)}
                                        initialDocuments={(lead as any).documents || []}
                                        onDocumentChange={fetchLead}
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
