"use client";

import React, { useEffect, useState, FormEvent, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User as UserIcon, Save, Loader2, PanelRightClose, PanelRightOpen, ChevronDown, ChevronUp, Paperclip, Send, Smile, Pencil, Sparkles, Archive, FileText, Plus, CreditCard, Banknote, Calendar, CheckCircle2, Clock, AlertCircle, ExternalLink, PlusCircle, ChevronsUpDown, Check } from "lucide-react";

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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CaseChat } from "@/components/case-chat";
import { CreateOpportunityDialog } from "@/components/opportunities/create-opportunity-dialog";
import { DocumentManager } from "@/components/document-manager";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import api from "@/lib/axios";
import { Client, Credit, CreditPayment, chatMessages, Lead } from "@/lib/data";
import { PROVINCES, Province, Canton, Location } from "@/lib/cr-locations";

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

const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
            <CardTitle>Tareas del Cliente</CardTitle>
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
              <p className="text-muted-foreground">No hay tareas para este cliente.</p>
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
            <DialogDescription>Crea una nueva tarea para este cliente.</DialogDescription>
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

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const id = params.id as string;
  const mode = searchParams.get("mode") || "view"; // view | edit
  const isEditMode = mode === "edit";

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Client>>({});
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [isOpportunitiesOpen, setIsOpportunitiesOpen] = useState(true);
  const [isOpportunityDialogOpen, setIsOpportunityDialogOpen] = useState(false);
  const [agents, setAgents] = useState<{id: number, name: string}[]>([]);
  const [deductoras, setDeductoras] = useState<{id: number, nombre: string}[]>([]);
  const [leads, setLeads] = useState<{id: number, name: string}[]>([]);
  const [instituciones, setInstituciones] = useState<{id: number, nombre: string}[]>([]);
  const [institucionSearch, setInstitucionSearch] = useState("");
  const [institucionOpen, setInstitucionOpen] = useState(false);
  const [profesionSearch, setProfesionSearch] = useState("");
  const [profesionOpen, setProfesionOpen] = useState(false);

  // Credits and Payments state
  const [credits, setCredits] = useState<Credit[]>([]);
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Refresh key to trigger data re-fetch without full page reload
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshData = React.useCallback(() => setRefreshKey(k => k + 1), []);

  const fetchClient = useCallback(async () => {
    try {
      const response = await api.get(`/api/clients/${id}`);
      setClient(response.data);
      setFormData(response.data);
    } catch (error) {
      console.error("Error fetching client:", error);
      toast({ title: "Error", description: "No se pudo cargar el cliente.", variant: "destructive" });
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

    const fetchLeads = async () => {
        try {
            const response = await api.get('/api/leads?all=true');
            const data = response.data.data || response.data;
            setLeads(data.map((l: { id: number; name: string }) => ({ id: l.id, name: l.name })));
        } catch (error) {
            console.error("Error fetching leads:", error);
        }
    };

    const fetchInstituciones = async () => {
        try {
            const response = await api.get('/api/instituciones');
            setInstituciones(response.data);
        } catch (error) {
            console.error("Error fetching instituciones:", error);
        }
    };

    const fetchCredits = async () => {
        setLoadingCredits(true);
        try {
            const response = await api.get(`/api/credits?lead_id=${id}`);
            // Handle paginated response (response.data.data) or direct array (response.data)
            const creditsData = Array.isArray(response.data) ? response.data : (response.data.data || []);
            setCredits(creditsData);
        } catch (error) {
            console.error("Error fetching credits:", error);
            setCredits([]);
        } finally {
            setLoadingCredits(false);
        }
    };

    const fetchPayments = async () => {
        setLoadingPayments(true);
        try {
            // Use server-side filtering by passing client_id parameter
            const response = await api.get('/api/credit-payments', {
                params: { client_id: id }
            });
            const paymentsData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
            setPayments(paymentsData);
        } catch (error) {
            console.error("Error fetching payments:", error);
            setPayments([]);
        } finally {
            setLoadingPayments(false);
        }
    };

    if (id) {
      fetchClient();
      fetchAgents();
      fetchDeductoras();
      fetchLeads();
      fetchInstituciones();
      fetchCredits();
      fetchPayments();
    }
  }, [id, toast, refreshKey]);

  const leadName = React.useMemo(() => {
      if (!client || leads.length === 0) return null;
      const leadId = client.lead_id || client.relacionado_a;
      const found = leads.find(l => String(l.id) === String(leadId));
      return found?.name;
  }, [client, leads]);

  const REQUIRED_FIELDS = [
    'cedula', 'name', 'apellido1', 'email', 'phone', 'whatsapp', 'fecha_nacimiento', 'estado_civil',
    'profesion', 'nivel_academico', 'puesto', 'institucion_labora', 'deductora_id', 'sector',
    'province', 'canton', 'distrito', 'direccion1',
    'trabajo_provincia', 'trabajo_canton', 'trabajo_distrito', 'trabajo_direccion'
  ];

  const isFieldMissing = useCallback((field: string) => {
    if (!formData || !REQUIRED_FIELDS.includes(field)) return false;
    const value = (formData as any)[field];
    if (field === 'deductora_id') return !value || value === 0;
    return value === null || value === undefined || value === '';
  }, [formData]);

  const getMissingDocuments = useCallback(() => {
    const documents = (client as any)?.documents || [];
    const missing = [];
    const hasCedula = documents.some((doc: any) => doc.category === 'cedula');
    const hasRecibo = documents.some((doc: any) => doc.category === 'recibo_servicio');

    if (!hasCedula) missing.push('Cédula');
    if (!hasRecibo) missing.push('Recibo de Servicio');

    return missing;
  }, [client]);

  const getMissingFieldsCount = useCallback(() => {
    if (!formData) return 0;
    return REQUIRED_FIELDS.filter(field => {
      const value = (formData as any)[field];
      if (field === 'deductora_id') return !value || value === 0;
      return value === null || value === undefined || value === '';
    }).length;
  }, [formData]);

  const handleInputChange = (field: keyof Client, value: string | number | boolean | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const selectedProvince = React.useMemo(() =>
    PROVINCES.find(p => p.name === formData.province), 
    [formData.province]
  );

  const selectedCanton = React.useMemo(() => 
    selectedProvince?.cantons.find(c => c.name === formData.canton), 
    [selectedProvince, formData.canton]
  );

  const cantons = selectedProvince?.cantons || [];
  const districts = selectedCanton?.districts || [];

  const handleProvinceChange = (value: string) => {
    setFormData(prev => ({ 
        ...prev, 
        province: value,
        canton: "",
        distrito: ""
    }));
  };

  const handleCantonChange = (value: string) => {
    setFormData(prev => ({ 
        ...prev, 
        canton: value,
        distrito: ""
    }));
  };

  const handleDistrictChange = (value: string) => {
    setFormData(prev => ({ ...prev, distrito: value }));
  };

  // Work Address Logic
  const selectedWorkProvince = React.useMemo(() => 
    PROVINCES.find(p => p.name === formData.trabajo_provincia), 
    [formData.trabajo_provincia]
  );

  const selectedWorkCanton = React.useMemo(() => 
    selectedWorkProvince?.cantons.find(c => c.name === formData.trabajo_canton), 
    [selectedWorkProvince, formData.trabajo_canton]
  );

  const workCantons = selectedWorkProvince?.cantons || [];
  const workDistricts = selectedWorkCanton?.districts || [];

  const handleWorkProvinceChange = (value: string) => {
    setFormData(prev => ({ 
        ...prev, 
        trabajo_provincia: value,
        trabajo_canton: "",
        trabajo_distrito: ""
    }));
  };

  const handleWorkCantonChange = (value: string) => {
    setFormData(prev => ({ 
        ...prev, 
        trabajo_canton: value,
        trabajo_distrito: ""
    }));
  };

  const handleWorkDistrictChange = (value: string) => {
    setFormData(prev => ({ ...prev, trabajo_distrito: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Sanitize deductora_id to ensure it's a valid number or null
      const sanitizedData = {
        ...formData,
        deductora_id: formData.deductora_id ? Number(formData.deductora_id) : null,
      };

      console.log('Datos a enviar:', sanitizedData);

      await api.put(`/api/clients/${id}`, sanitizedData);
      toast({ title: "Guardado", description: "Cliente actualizado correctamente." });
      setClient(prev => ({ ...prev, ...formData } as Client));
      router.push(`/dashboard/clientes/${id}?mode=view`);
    } catch (error: any) {
      console.error("Error updating client:", error);
      console.error("Error response:", error.response?.data);

      // Mostrar errores de validación específicos si existen
      if (error.response?.data?.errors) {
        const errorMessages = Object.entries(error.response.data.errors)
          .map(([field, messages]: [string, any]) => `${field}: ${messages.join(', ')}`)
          .join('\n');
        toast({
          title: "Error de validación",
          description: errorMessages,
          variant: "destructive"
        });
      } else {
        toast({ title: "Error", description: "No se pudo guardar los cambios.", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!client) return;
    if (!confirm(`¿Archivar a ${client.name}?`)) return;
    try {
      await api.patch(`/api/clients/${id}/toggle-active`);
      toast({ title: "Archivado", description: "Cliente archivado correctamente." });
      router.push('/dashboard/clientes');
    } catch (error) {
      console.error("Error archiving client:", error);
      toast({ title: "Error", description: "No se pudo archivar el cliente.", variant: "destructive" });
    }
  };

  const [activeTab, setActiveTab] = useState("datos");

  const handleViewExpediente = () => {
    setActiveTab("archivos");
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!client) {
    return <div className="p-8 text-center">Cliente no encontrado.</div>;
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
          {isEditMode && (
            <>
              <Button variant="ghost" onClick={() => router.push(`/dashboard/clientes/${id}?mode=view`)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar cambios
              </Button>
            </>
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-4">
              <TabsTrigger value="datos" className="relative">
                Datos
                {getMissingFieldsCount() > 0 && (
                  <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {getMissingFieldsCount()}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="creditos" className="flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" />
                Créditos
                {credits.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{credits.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="pagos" className="flex items-center gap-1">
                <Banknote className="h-3.5 w-3.5" />
                Pagos
                {payments.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{payments.length}</Badge>
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
                <h1 className="text-2xl font-bold tracking-tight uppercase">{client.name} {client.apellido1} {client.apellido2}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <span>ID #{client.id}</span>
                    <span> · </span>
                    <span>{client.cedula}</span>
                    <span> · </span>
                    <span>Registrado {client.created_at ? new Date(client.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A'}</span>
                </div>
                
                <div className="flex items-center gap-3 mt-4">
                    <Badge variant={client.is_active ? "default" : "secondary"} className="rounded-full px-3 font-normal">
                        {client.status || (client.is_active ? "Activo" : "Inactivo")}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 font-normal text-slate-600">
                        {leadName || client.relacionado_a || "Cliente"}
                    </Badge>

                    {!isEditMode && (
                        <div className="flex items-center gap-2 ml-1">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size="icon" className="h-9 w-9 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border-0" onClick={() => router.push(`/dashboard/clientes/${id}?mode=edit`)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Editar Cliente</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

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

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="icon"
                                            className="h-9 w-9 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 border-0"
                                            onClick={handleViewExpediente}
                                        >
                                            <FileText className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Ver Expediente</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

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
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Primer Apellido {isFieldMissing('apellido1') && <span className="text-red-500">*</span>}</Label>
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
                <Label>Cédula {isFieldMissing('cedula') && <span className="text-red-500">*</span>}</Label>
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
                  value={formData.cedula_vencimiento || ""} 
                  onChange={(e) => handleInputChange("cedula_vencimiento", e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Nacimiento {isFieldMissing('fecha_nacimiento') && <span className="text-red-500">*</span>}</Label>
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
                    value={formData.genero || ""} 
                    onValueChange={(value) => handleInputChange("genero", value)}
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
                  <Input value={formData.genero || ""} disabled />
                )}
              </div>
              <div className="space-y-2">
                <Label>Estado Civil {isFieldMissing('estado_civil') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Select
                    value={formData.estado_civil || ""}
                    onValueChange={(value) => handleInputChange("estado_civil", value)}
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
                  <Input value={formData.estado_civil || ""} disabled />
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
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono Móvil {isFieldMissing('phone') && <span className="text-red-500">*</span>}</Label>
                <Input
                  value={formData.phone || ""}
                  onChange={(e) => handleInputChange("phone", e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono 2</Label>
                <Input 
                  value={formData.telefono2 || ""} 
                  onChange={(e) => handleInputChange("telefono2", e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono Amigo</Label>
                <Input
                  value={formData.telefono3 || ""}
                  onChange={(e) => handleInputChange("telefono3", e.target.value)}
                  disabled={!isEditMode}
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp {isFieldMissing('whatsapp') && <span className="text-red-500">*</span>}</Label>
                <Input
                  value={formData.whatsapp || ""}
                  onChange={(e) => handleInputChange("whatsapp", e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono Casa</Label>
                <Input 
                  value={formData.tel_casa || ""} 
                  onChange={(e) => handleInputChange("tel_casa", e.target.value)} 
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
                <Label>Provincia {isFieldMissing('province') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Select
                    value={formData.province || ""}
                    onValueChange={handleProvinceChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar provincia" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map((p) => (
                        <SelectItem key={p.id} value={p.name}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={formData.province || ""} disabled />
                )}
              </div>
              <div className="space-y-2">
                <Label>Cantón {isFieldMissing('canton') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Select
                    value={formData.canton || ""}
                    onValueChange={handleCantonChange}
                    disabled={!selectedProvince}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cantón" />
                    </SelectTrigger>
                    <SelectContent>
                      {cantons.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={formData.canton || ""} disabled />
                )}
              </div>
              <div className="space-y-2">
                <Label>Distrito {isFieldMissing('distrito') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Select
                    value={formData.distrito || ""}
                    onValueChange={handleDistrictChange}
                    disabled={!selectedCanton}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar distrito" />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map((d) => (
                        <SelectItem key={d.id} value={d.name}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={formData.distrito || ""} disabled />
                )}
              </div>
              <div className="col-span-3 md:col-span-2 space-y-2">
                <Label>Dirección Exacta {isFieldMissing('direccion1') && <span className="text-red-500">*</span>}</Label>
                <Textarea
                  value={formData.direccion1 || ""} 
                  onChange={(e) => handleInputChange("direccion1", e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="col-span-3 md:col-span-1 space-y-2">
                <Label>Dirección 2 (Opcional)</Label>
                <Textarea 
                  value={formData.direccion2 || ""} 
                  onChange={(e) => handleInputChange("direccion2", e.target.value)} 
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
                <Label>Nivel Académico {isFieldMissing('nivel_academico') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Select
                    value={formData.nivel_academico || ""}
                    onValueChange={(value) => handleInputChange("nivel_academico", value)}
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
                    value={formData.nivel_academico || ""}
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
                        {formData.profesion || "Seleccionar profesión"}
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
                                handleInputChange("profesion", prof);
                                setProfesionOpen(false);
                                setProfesionSearch("");
                              }}
                            >
                              <Check className={`h-4 w-4 ${formData.profesion === prof ? "opacity-100" : "opacity-0"}`} />
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
                    value={formData.profesion || ""}
                    disabled
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Sector {isFieldMissing('sector') && <span className="text-red-500">*</span>}</Label>
                <Input
                  value={formData.sector || ""} 
                  onChange={(e) => handleInputChange("sector", e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Puesto {isFieldMissing('puesto') && <span className="text-red-500">*</span>}</Label>
                <Input
                  value={formData.puesto || ""} 
                  onChange={(e) => handleInputChange("puesto", e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Nombramiento</Label>
                <Select
                  value={formData.estado_puesto || ""}
                  onValueChange={(value) => handleInputChange("estado_puesto", value)}
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
                        {formData.institucion_labora || "Seleccionar institución"}
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
                                handleInputChange("institucion_labora", inst.nombre);
                                setInstitucionOpen(false);
                                setInstitucionSearch("");
                              }}
                            >
                              <Check className={`h-4 w-4 ${formData.institucion_labora === inst.nombre ? "opacity-100" : "opacity-0"}`} />
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
                    value={formData.institucion_labora || ""}
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
                      variant={formData.deductora_id === deductora.id ? "default" : "outline"}
                      size="default"
                      onClick={() => isEditMode && handleInputChange("deductora_id", deductora.id)}
                      disabled={!isEditMode}
                      className={`flex-1 ${formData.deductora_id === deductora.id ? "bg-primary text-primary-foreground" : ""}`}
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
                    value={formData.trabajo_provincia || ""}
                    onValueChange={handleWorkProvinceChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar provincia" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map((p) => (
                        <SelectItem key={p.id} value={p.name}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={formData.trabajo_provincia || ""} disabled />
                )}
              </div>
              <div className="space-y-2">
                <Label>Cantón {isFieldMissing('trabajo_canton') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Select
                    value={formData.trabajo_canton || ""}
                    onValueChange={handleWorkCantonChange}
                    disabled={!selectedWorkProvince}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cantón" />
                    </SelectTrigger>
                    <SelectContent>
                      {workCantons.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={formData.trabajo_canton || ""} disabled />
                )}
              </div>
              <div className="space-y-2">
                <Label>Distrito {isFieldMissing('trabajo_distrito') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Select
                    value={formData.trabajo_distrito || ""}
                    onValueChange={handleWorkDistrictChange}
                    disabled={!selectedWorkCanton}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar distrito" />
                    </SelectTrigger>
                    <SelectContent>
                      {workDistricts.map((d) => (
                        <SelectItem key={d.id} value={d.name}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={formData.trabajo_distrito || ""} disabled />
                )}
              </div>
              <div className="col-span-3 space-y-2">
                <Label>Dirección Exacta (Trabajo) {isFieldMissing('trabajo_direccion') && <span className="text-red-500">*</span>}</Label>
                <Textarea
                  value={formData.trabajo_direccion || ""}
                  onChange={(e) => handleInputChange("trabajo_direccion", e.target.value)}
                  disabled={!isEditMode}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* System & Other Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Otros Detalles</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {/*<div className="space-y-2">*/}
              {/*  <Label>Estado</Label>*/}
              {/*  <Input */}
              {/*    value={formData.status || ""} */}
              {/*    onChange={(e) => handleInputChange("status", e.target.value)} */}
              {/*    disabled={!isEditMode} */}
              {/*  />*/}
              {/*</div>*/}
              {/*<div className="space-y-2">*/}
              {/*  <Label>Lead Status ID</Label>*/}
              {/*  <Input */}
              {/*    value={formData.lead_status_id || ""} */}
              {/*    onChange={(e) => handleInputChange("lead_status_id", e.target.value)} */}
              {/*    disabled={!isEditMode} */}
              {/*  />*/}
              {/*</div>*/}
              <div className="space-y-2">
                <Label>Responsable</Label>
                {isEditMode ? (
                  <Select 
                    value={String(formData.assigned_to_id || "")} 
                    onValueChange={(value) => handleInputChange("assigned_to_id", value)}
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
                    value={agents.find(a => a.id === formData.assigned_to_id)?.name || formData.assigned_to_id || ""} 
                    disabled 
                  />
                )}
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
            </TabsContent>

            {/* Credits Tab */}
            <TabsContent value="creditos">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Historial de Créditos
                      </CardTitle>
                      <CardDescription>Todos los créditos asociados a este cliente</CardDescription>
                    </div>
                    <Link href="/dashboard/creditos">
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Nuevo Crédito
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingCredits ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : credits.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>No hay créditos registrados para este cliente.</p>
                      <Link href="/dashboard/creditos">
                        <Button variant="outline" size="sm" className="mt-4">
                          Crear primer crédito
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Summary Cards */}
                      <div className="grid gap-4 md:grid-cols-4">
                        <Card className="bg-blue-50 border-blue-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-blue-600 font-medium">Total Créditos</div>
                            <div className="text-2xl font-bold text-blue-700">{credits.length}</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-green-50 border-green-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-green-600 font-medium">Monto Total</div>
                            <div className="text-2xl font-bold text-green-700">
                              {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(
                                credits.reduce((sum, c) => sum + (c.monto_credito || 0), 0)
                              )}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-amber-50 border-amber-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-amber-600 font-medium">Activos</div>
                            <div className="text-2xl font-bold text-amber-700">
                              {credits.filter(c => c.status !== 'Cancelado' && c.status !== 'Rechazado').length}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-purple-50 border-purple-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-purple-600 font-medium">Saldo Pendiente</div>
                            <div className="text-2xl font-bold text-purple-700">
                              {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(
                                credits.reduce((sum, c) => sum + (c.saldo || 0), 0)
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Credits Table */}
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Referencia</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Monto</TableHead>
                              <TableHead>Saldo</TableHead>
                              <TableHead>Plazo</TableHead>
                              <TableHead>Tasa</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {credits.map((credit) => (
                              <TableRow key={credit.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium">{credit.reference || credit.numero_operacion || `#${credit.id}`}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{credit.tipo_credito || credit.category || 'Regular'}</Badge>
                                </TableCell>
                                <TableCell className="font-mono">
                                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(credit.monto_credito || 0)}
                                </TableCell>
                                <TableCell className="font-mono">
                                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(credit.saldo || 0)}
                                </TableCell>
                                <TableCell>{credit.plazo} meses</TableCell>
                                <TableCell>{credit.tasa_anual || 0}%</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={credit.status === 'Formalizado' || credit.status === 'Al día' ? 'default' :
                                             credit.status === 'En mora' ? 'destructive' :
                                             credit.status === 'Cancelado' ? 'secondary' : 'outline'}
                                    className={credit.status === 'Al día' ? 'bg-green-500' :
                                               credit.status === 'Formalizado' ? 'bg-blue-500' : ''}
                                  >
                                    {credit.status === 'Al día' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                    {credit.status === 'En mora' && <AlertCircle className="h-3 w-3 mr-1" />}
                                    {credit.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {credit.opened_at ? new Date(credit.opened_at).toLocaleDateString('es-CR') : '-'}
                                </TableCell>
                                <TableCell>
                                  <Link href={`/dashboard/creditos/${credit.id}`}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payments Tab */}
            <TabsContent value="pagos">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    Historial de Pagos
                  </CardTitle>
                  <CardDescription>Todos los pagos realizados por este cliente</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPayments ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Banknote className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>No hay pagos registrados para este cliente.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Payment Summary */}
                      <div className="grid gap-4 md:grid-cols-3">
                        <Card className="bg-green-50 border-green-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-green-600 font-medium">Total Pagado</div>
                            <div className="text-2xl font-bold text-green-700">
                              {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(
                                payments.reduce((sum, p) => sum + (p.monto || 0), 0)
                              )}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-blue-50 border-blue-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-blue-600 font-medium">Número de Pagos</div>
                            <div className="text-2xl font-bold text-blue-700">{payments.length}</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-purple-50 border-purple-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-purple-600 font-medium">Último Pago</div>
                            <div className="text-2xl font-bold text-purple-700">
                              {payments.length > 0
                                ? new Date(payments[0].fecha || payments[0].created_at || '').toLocaleDateString('es-CR')
                                : '-'}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Payments Table */}
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Crédito</TableHead>
                              <TableHead>Monto</TableHead>
                              <TableHead>Capital</TableHead>
                              <TableHead>Interés</TableHead>
                              <TableHead>Mora</TableHead>
                              <TableHead>Origen</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {payments.map((payment) => (
                              <TableRow key={payment.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    {payment.fecha
                                      ? new Date(payment.fecha).toLocaleDateString('es-CR')
                                      : new Date(payment.created_at || '').toLocaleDateString('es-CR')}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Link href={`/dashboard/creditos/${payment.credit_id}`} className="text-primary hover:underline">
                                    {payment.credit?.reference || `#${payment.credit_id}`}
                                  </Link>
                                </TableCell>
                                <TableCell className="font-mono font-medium text-green-600">
                                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(payment.monto || 0)}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(payment.capital_aplicado || 0)}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(payment.interes_aplicado || 0)}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {(payment.mora_aplicada ?? 0) > 0 ? (
                                    <span className="text-red-500">
                                      {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(payment.mora_aplicada || 0)}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="font-normal">
                                    {payment.origen || 'Ventanilla'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tareas">
              <TareasTab opportunityReference={client.cedula} opportunityId={client.id} />
            </TabsContent>

            <TabsContent value="archivos">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5" />
                    Archivos del Cliente
                  </CardTitle>
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
                      personId={parseInt(client.id)}
                      initialDocuments={client.documents || []}
                      onDocumentChange={fetchClient}
                   />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Side Panel */}
        {isPanelVisible && (
          <div className="space-y-6 lg:col-span-2 h-[calc(100vh-8rem)] flex flex-col">
            <Card className="flex-1 flex flex-col overflow-hidden border-0 shadow-none lg:border lg:shadow-sm">
              <Tabs defaultValue="comunicaciones" className="flex flex-col h-full">
                <div className="px-4 pt-4 border-b">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>
                    <TabsTrigger value="comunicaciones">Comunicaciones</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="oportunidades" className="flex-1 p-4 m-0 overflow-y-auto">
                  <div className="text-center text-muted-foreground py-8">
                    No hay oportunidades activas.
                    <div className="mt-4">
                        <Button variant="outline" size="sm" onClick={() => setIsOpportunityDialogOpen(true)}>
                            Crear oportunidad
                        </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="comunicaciones" className="flex-1 flex flex-col overflow-hidden m-0">
                  {/* Oportunidades Ligadas Accordion */}
                  <div className="border-b bg-white z-10">
                    <Collapsible
                      open={isOpportunitiesOpen}
                      onOpenChange={setIsOpportunitiesOpen}
                      className="w-full"
                    >
                      <div className="flex items-center justify-between px-4 py-3">
                        <h4 className="text-sm font-semibold text-foreground">Oportunidades ligadas</h4>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            {isOpportunitiesOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="sr-only">Toggle</span>
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="px-4 pb-3 space-y-2">
                        {client.opportunities && client.opportunities.length > 0 ? (
                          client.opportunities.map((opp) => (
                            <div key={opp.id} className="rounded-md border bg-muted/30 p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                                <div className="flex justify-between items-start mb-1">
                                  <div>
                                      <p className="text-sm font-medium text-primary">{opp.opportunity_type || 'Oportunidad'}</p>
                                      <p className="text-xs text-muted-foreground">#{opp.id}</p>
                                  </div>
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">{opp.status}</Badge>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Monto: {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(opp.amount)}</span>
                                  <span>{opp.created_at ? new Date(opp.created_at).toLocaleDateString() : ''}</span>
                                </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center text-sm text-muted-foreground py-2">
                            Aún no hay oportunidades para este lead.
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  {/* Chat Area */}
                  <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 relative">
                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          {chatMessages.map((msg, index) => (
                              <div
                                key={index}
                                className={`flex items-start gap-3 ${
                                  msg.senderType === 'agent' ? 'justify-end' : ''
                                }`}
                              >
                                {msg.senderType === 'client' && (
                                  <Avatar className="h-8 w-8 border bg-white">
                                    <AvatarImage src={msg.avatarUrl} />
                                    <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                )}
                                <div
                                  className={`flex flex-col ${
                                    msg.senderType === 'agent' ? 'items-end' : 'items-start'
                                  }`}
                                >
                                  <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                                      msg.senderType === 'agent'
                                        ? 'bg-primary text-primary-foreground rounded-br-none'
                                        : 'bg-white border border-slate-100 rounded-bl-none'
                                    }`}
                                  >
                                    <p>{msg.text}</p>
                                  </div>
                                  <span className="mt-1 text-[10px] text-muted-foreground px-1">
                                    {msg.time}
                                  </span>
                                </div>
                              </div>
                          ))}
                      </div>

                      {/* Input Area */}
                      <div className="p-3 border-t bg-white">
                          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0">
                                  <Paperclip className="h-4 w-4" />
                              </Button>
                              <Input 
                                placeholder="Escribe un mensaje..." 
                                className="flex-1 h-9 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2" 
                              />
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0">
                                  <Smile className="h-4 w-4" />
                              </Button>
                              <Button size="icon" className="h-8 w-8 shrink-0">
                                  <Send className="h-4 w-4" />
                              </Button>
                          </div>
                      </div>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        )}
      </div>

      <CreateOpportunityDialog
        open={isOpportunityDialogOpen}
        onOpenChange={setIsOpportunityDialogOpen}
        leads={client ? [client as unknown as Lead] : []}
        defaultLeadId={client ? String(client.id) : undefined}
        onSuccess={() => {
            // Refresh client data to show new opportunity
            refreshData();
        }}
      />
    </div>
  );
}
