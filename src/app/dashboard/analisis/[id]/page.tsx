'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, ThumbsUp, ThumbsDown, ArrowLeft, File, Image as ImageIcon, FileSpreadsheet, FolderInput, Pencil, Download, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';
import { usePermissions } from '@/contexts/PermissionsContext';
import { FormEvent } from 'react';
import {
  findEmpresaByName,
  getFileExtension,
  matchesRequirement,
  Requirement,
  Empresa
} from '@/lib/empresas-mock';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { CreditFormModal } from '@/components/CreditFormModal';
import {
  AnalisisItem,
  AnalisisFile,
  Propuesta,
  formatCurrency,
  formatFileSize,
} from '@/lib/analisis';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Helper functions for currency
const parseCurrencyToNumber = (value: string): string => {
  let cleaned = value.replace(/[₡$]/g, '');
  cleaned = cleaned.replace(/\s/g, '');
  cleaned = cleaned.replace(/,/g, '');
  cleaned = cleaned.replace(/[^\d.]/g, '');
  return cleaned;
};

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
            <CardTitle>Tareas del Análisis</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {tasks.length > 0 ? `${tasks.length} ${tasks.length === 1 ? "tarea" : "tareas"}` : "No hay tareas"}
            </p>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <FileText className="h-4 w-4" />
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
              <p className="text-muted-foreground">No hay tareas para este análisis.</p>
              <Button onClick={openCreateDialog} variant="outline" className="mt-4 gap-2">
                <FileText className="h-4 w-4" />
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
            <DialogDescription>Crea una nueva tarea para este análisis.</DialogDescription>
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

export default function AnalisisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const analisisId = params.id as string;

  const [analisis, setAnalisis] = useState<AnalisisItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para estado_pep y estado_cliente
  const [estadoPep, setEstadoPep] = useState<string | null>('Pendiente');
  const [estadoCliente, setEstadoCliente] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Estados editables (solo cuando estado_pep === 'Pendiente de cambios')
  const [editMontoCredito, setEditMontoCredito] = useState<number>(0);
  const [editPlazo, setEditPlazo] = useState<number>(36);
  const [saving, setSaving] = useState(false);

  // Propuestas state
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [loadingPropuestas, setLoadingPropuestas] = useState(false);
  const [propuestaForm, setPropuestaForm] = useState({
    monto: '',
    plazo: '',
    // cuota: '',
    // interes: '',
    // categoria: '',
  });
  const [savingPropuesta, setSavingPropuesta] = useState(false);
  const [editingPropuesta, setEditingPropuesta] = useState<Propuesta | null>(null);

  // Estados para archivos del filesystem
  const [heredados, setHeredados] = useState<AnalisisFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Verificación manual de documentos (key: requirement name, value: boolean)
  const [manualVerifications, setManualVerifications] = useState<Record<string, boolean>>({});

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  // Empresa encontrada basada en institucion_labora del lead
  const [empresaMatch, setEmpresaMatch] = useState<Empresa | undefined>(undefined);

  // Estado del modal de crédito
  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false);
  const [creditForm, setCreditForm] = useState({
    reference: '',
    title: '',
    status: 'Por firmar',
    category: 'Crédito',
    monto_credito: '',
    leadId: '',
    clientName: '',
    description: '',
    divisa: 'CRC',
    plazo: '36',
    poliza: false,
    conCargosAdicionales: false,
  });
  const [products, setProducts] = useState<Array<{ id: number; name: string; }>>([]);
  const [leads, setLeads] = useState<Array<{ id: number; name?: string; deductora_id?: number; }>>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Configuración de cargos adicionales por defecto
  const CARGOS_CONFIG = {
    comision: { porcentaje: 0.03, fijo: null },
    transporte: { porcentaje: null, fijo: 10000 },
    respaldo_deudor: { porcentaje: null, fijo: 4950, soloRegular: true },
    descuento_factura: { porcentaje: null, fijo: 0 },
  };

  const calcularCargosDefault = (monto: number, category: string) => {
    const esRegular = category === 'Regular' || category === 'Personal (Diferentes usos)' || category === 'Refundición (Pagar deudas actuales)';
    return {
      comision: Math.round(monto * (CARGOS_CONFIG.comision.porcentaje || 0) * 100) / 100,
      transporte: CARGOS_CONFIG.transporte.fijo || 0,
      respaldo_deudor: esRegular ? (CARGOS_CONFIG.respaldo_deudor.fijo || 0) : 0,
      descuento_factura: 0,
    };
  };

  // Estados para collapsibles de historial crediticio
  const [manchasOpen, setManchasOpen] = useState(false);
  const [juiciosOpen, setJuiciosOpen] = useState(false);
  const [embargosOpen, setEmbargosOpen] = useState(false);

  // Cargar archivos del filesystem
  const fetchAnalisisFiles = useCallback(async () => {
    try {
      setLoadingFiles(true);
      const res = await api.get(`/api/analisis/${analisisId}/files`);
      // Combinar heredados y específicos en una sola lista
      const allFiles = [...(res.data.heredados || []), ...(res.data.especificos || [])];
      setHeredados(allFiles);
    } catch (error) {
      console.error('Error fetching analisis files:', error);
    } finally {
      setLoadingFiles(false);
    }
  }, [analisisId]);

  // Lightbox helper functions - DEBEN estar ANTES de los returns condicionales
  const getViewableFiles = useCallback(() => {
    return heredados.filter(file => {
      const name = file.name.toLowerCase();
      return name.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/);
    });
  }, [heredados]);

  const openLightbox = useCallback((file: AnalisisFile) => {
    const viewableFiles = heredados.filter(f => {
      const name = f.name.toLowerCase();
      return name.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/);
    });
    const index = viewableFiles.findIndex(f => f.path === file.path);
    if (index !== -1) {
      setLightboxIndex(index);
      setLightboxZoom(1);
      setLightboxOpen(true);
    }
  }, [heredados]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setLightboxZoom(1);
  }, []);

  const goToPrevious = useCallback(() => {
    const viewableFiles = heredados.filter(file => {
      const name = file.name.toLowerCase();
      return name.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/);
    });
    setLightboxIndex((prev) => (prev > 0 ? prev - 1 : viewableFiles.length - 1));
    setLightboxZoom(1);
  }, [heredados]);

  const goToNext = useCallback(() => {
    const viewableFiles = heredados.filter(file => {
      const name = file.name.toLowerCase();
      return name.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/);
    });
    setLightboxIndex((prev) => (prev < viewableFiles.length - 1 ? prev + 1 : 0));
    setLightboxZoom(1);
  }, [heredados]);

  useEffect(() => {
    const fetchAnalisis = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/analisis/${analisisId}`);
        const data = res.data as AnalisisItem;
        setAnalisis(data);

        // Inicializar estados
        setEstadoPep(data.estado_pep || 'Pendiente');
        setEstadoCliente(data.estado_cliente || null);

        // Inicializar campos editables
        setEditMontoCredito(data.monto_credito || 0);
        setEditPlazo(data.plazo || 36);

        // Inicializar propuestas desde eager loading
        if (data.propuestas) {
          setPropuestas(data.propuestas);
        }

        // Cargar archivos del filesystem (heredados/específicos)
        fetchAnalisisFiles();

        // Buscar empresa por institucion_labora
        if (data.lead?.institucion_labora) {
          const empresa = findEmpresaByName(data.lead.institucion_labora);
          setEmpresaMatch(empresa);
        }
      } catch (err) {
        console.error('Error fetching analisis:', err);
        setError('No se pudo cargar el análisis.');
      } finally {
        setLoading(false);
      }
    };

    if (analisisId) {
      fetchAnalisis();
    }
  }, [analisisId, fetchAnalisisFiles]);

  // Cargar products y clients para el modal de crédito
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, clientsRes] = await Promise.all([
          api.get('/api/products'),
          api.get('/api/clients', { params: { per_page: 1000 } }) // Traer muchos clientes
        ]);
        setProducts(productsRes.data || []);
        const clientsData = clientsRes.data.data || clientsRes.data || [];
        setLeads(clientsData);
      } catch (error) {
        console.error('Error fetching products/clients:', error);
      }
    };
    fetchData();
  }, []);

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === '+' || e.key === '=') setLightboxZoom(z => Math.min(z + 0.25, 3));
      if (e.key === '-') setLightboxZoom(z => Math.max(z - 0.25, 0.5));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, closeLightbox, goToPrevious, goToNext]);

  // Handler para actualizar estados
  const handleEstadoChange = async (field: 'estado_pep' | 'estado_cliente', value: string | null) => {
    try {
      setUpdatingStatus(true);
      const payload: Record<string, string | null> = { [field]: value };

      // Si estado_pep cambia a 'Aceptado', auto-setear estado_cliente a 'Pendiente'
      if (field === 'estado_pep' && value === 'Aceptado') {
        payload.estado_cliente = 'Pendiente';
      }

      // Si estado_pep cambia a algo diferente de 'Aceptado', limpiar estado_cliente
      if (field === 'estado_pep' && value !== 'Aceptado') {
        payload.estado_cliente = null;
      }

      await api.put(`/api/analisis/${analisisId}`, payload);

      // Actualizar estados locales juntos para que el render sea consistente
      if (field === 'estado_pep') {
        setEstadoPep(value);
        if (value === 'Aceptado') {
          setEstadoCliente('Pendiente');
          // Auto-aceptar la primera propuesta pendiente
          const propuestaPendiente = propuestas.find(p => p.estado === 'Pendiente');
          if (propuestaPendiente) {
            await handleAceptarPropuesta(propuestaPendiente.id);
          }
        } else {
          setEstadoCliente(null);
        }
      } else {
        setEstadoCliente(value);
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      const errorMessage = error?.response?.data?.message || 'Error al actualizar el estado';
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handler para guardar cambios cuando estado_pep === 'Pendiente de cambios'
  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      await api.put(`/api/analisis/${analisisId}`, {
        monto_credito: editMontoCredito,
        plazo: editPlazo,
      });
      setAnalisis(prev => prev ? {
        ...prev,
        monto_credito: editMontoCredito,
        plazo: editPlazo,
      } : null);
      toast({ title: 'Guardado', description: 'Los cambios se guardaron correctamente.' });
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({ title: 'Error', description: 'No se pudieron guardar los cambios.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ===== Propuestas CRUD =====
  const fetchPropuestas = useCallback(async () => {
    if (!analisis?.reference) return;
    setLoadingPropuestas(true);
    try {
      const res = await api.get(`/api/analisis/${analisis.reference}/propuestas`);
      setPropuestas(res.data);
    } catch (err) {
      console.error('Error fetching propuestas:', err);
    } finally {
      setLoadingPropuestas(false);
    }
  }, [analisis?.reference]);

  const resetPropuestaForm = () => {
    setPropuestaForm({ monto: '', plazo: '' /*, cuota: '', interes: '', categoria: '' */ });
    setEditingPropuesta(null);
  };

  const handleSubmitPropuesta = async () => {
    if (!analisis?.reference) return;

    const monto = parseFloat(propuestaForm.monto);
    const plazo = parseInt(propuestaForm.plazo);
    // const cuota = parseFloat(propuestaForm.cuota);
    // const interes = parseFloat(propuestaForm.interes);

    if (!monto || !plazo) {
      toast({ title: 'Error', description: 'Monto y plazo son obligatorios.', variant: 'destructive' });
      return;
    }

    setSavingPropuesta(true);
    try {
      if (editingPropuesta) {
        await api.put(`/api/propuestas/${editingPropuesta.id}`, {
          monto, plazo,
          // cuota, interes,
          // categoria: propuestaForm.categoria || null,
        });
        toast({ title: 'Propuesta actualizada' });
      } else {
        await api.post(`/api/analisis/${analisis.reference}/propuestas`, {
          monto, plazo,
          // cuota, interes,
          // categoria: propuestaForm.categoria || null,
        });
        toast({ title: 'Propuesta creada' });
      }
      resetPropuestaForm();
      fetchPropuestas();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo guardar la propuesta.',
        variant: 'destructive',
      });
    } finally {
      setSavingPropuesta(false);
    }
  };

  const handleEditPropuesta = (p: Propuesta) => {
    setEditingPropuesta(p);
    setPropuestaForm({
      monto: String(p.monto),
      plazo: String(p.plazo),
      // cuota: String(p.cuota),
      // interes: String(p.interes),
      // categoria: p.categoria || '',
    });
  };

  const handleDeletePropuesta = async (id: number) => {
    try {
      await api.delete(`/api/propuestas/${id}`);
      toast({ title: 'Propuesta eliminada' });
      fetchPropuestas();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo eliminar.',
        variant: 'destructive',
      });
    }
  };

  const handleAceptarPropuesta = async (id: number) => {
    try {
      await api.patch(`/api/propuestas/${id}/aceptar`);
      toast({ title: 'Propuesta aceptada', description: 'Las demás propuestas pendientes fueron denegadas automáticamente.' });
      fetchPropuestas();
      // Refrescar el análisis para reflejar monto/plazo y estado_pep de la propuesta aceptada
      const resAnalisis = await api.get(`/api/analisis/${analisisId}`);
      const data = resAnalisis.data as AnalisisItem;
      setAnalisis(data);
      setEstadoPep(data.estado_pep || 'Aceptado');
      setEstadoCliente(data.estado_cliente || 'Pendiente');
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo aceptar.',
        variant: 'destructive',
      });
    }
  };

  const handleDenegarPropuesta = async (id: number) => {
    try {
      await api.patch(`/api/propuestas/${id}/denegar`);
      toast({ title: 'Propuesta denegada' });
      fetchPropuestas();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo denegar.',
        variant: 'destructive',
      });
    }
  };

  // Helper para obtener info del tipo de archivo (no depende de analisis)
  const getFileTypeInfo = (fileName: string) => {
    const name = fileName.toLowerCase();
    if (name.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return { icon: ImageIcon, label: 'Imagen', color: 'text-purple-600' };
    }
    if (name.endsWith('.pdf')) {
      return { icon: FileText, label: 'PDF', color: 'text-red-600' };
    }
    if (name.match(/\.(xls|xlsx|csv)$/)) {
      return { icon: FileSpreadsheet, label: 'Excel', color: 'text-green-600' };
    }
    if (name.match(/\.(doc|docx)$/)) {
      return { icon: FileText, label: 'Word', color: 'text-blue-600' };
    }
    if (name.match(/\.(html|htm)$/)) {
      return { icon: FileText, label: 'HTML', color: 'text-orange-600' };
    }
    return { icon: File, label: 'Archivo', color: 'text-slate-600' };
  };

  const isRequirementFulfilled = (req: Requirement): { fulfilled: boolean; autoMatch: boolean; matchedFiles: AnalisisFile[] } => {
    // Buscar archivos que coincidan por nombre y extensión
    const matchedFiles = allFiles.filter(file => {
      const fileExt = getFileExtension(file.name);
      const extMatches = fileExt === req.file_extension.toLowerCase() ||
        (req.file_extension === 'jpg' && ['jpg', 'jpeg', 'png'].includes(fileExt)) ||
        (req.file_extension === 'pdf' && fileExt === 'pdf') ||
        (req.file_extension === 'html' && ['html', 'htm'].includes(fileExt));

      const nameMatches = matchesRequirement(file.name, req.name);

      return extMatches && nameMatches;
    });

    // Si hay match automático por nombre
    if (matchedFiles.length >= req.quantity) {
      return { fulfilled: true, autoMatch: true, matchedFiles };
    }

    // Si está verificado manualmente
    if (manualVerifications[req.name]) {
      return { fulfilled: true, autoMatch: false, matchedFiles };
    }

    return { fulfilled: false, autoMatch: false, matchedFiles };
  };

  // Toggle verificación manual
  const toggleManualVerification = (reqName: string) => {
    setManualVerifications(prev => ({
      ...prev,
      [reqName]: !prev[reqName]
    }));
  };

  // Requisitos por defecto si no hay empresa match
  const defaultRequirements: Requirement[] = [
    { name: 'Constancia Salarial', file_extension: 'pdf', quantity: 1 },
    { name: 'Comprobantes de Pago', file_extension: 'pdf', quantity: 6 },
  ];

  // Early returns movidos aquí para cumplir con reglas de hooks
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error || !analisis) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-500">
          <p>{error || 'Análisis no encontrado'}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard/analisis')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver al listado
          </Button>
        </div>
      </div>
    );
  }

  // Después de los early returns, TypeScript sabe que analisis no es null
  const lead = analisis.lead;
  const allFiles = heredados;
  const isEditMode = estadoPep === 'Pendiente de cambios';
  const requirements = empresaMatch?.requirements || defaultRequirements;

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/analisis')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Análisis: {analisis.reference}</h1>
            <p className="text-sm text-gray-500">Revisión de datos financieros y laborales del cliente</p>
          </div>
        </div>

        {/* Selectores de Estado */}
        <div className="flex items-end gap-4">
          {/* Estado PEP */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Estado PEP</Label>
            <Select
              value={estadoPep || 'Pendiente'}
              onValueChange={(v) => handleEstadoChange('estado_pep', v)}
              disabled={updatingStatus || !hasPermission('analizados', 'delete') || analisis?.credit_status === 'Formalizado'}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pendiente">Pendiente</SelectItem>
                <SelectItem value="Aceptado">Aceptado</SelectItem>
                <SelectItem value="Pendiente de cambios">Pendiente de cambios</SelectItem>
                <SelectItem value="Rechazado">Rechazado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Estado Cliente - Solo visible si estado_pep === 'Aceptado' */}
          {estadoPep === 'Aceptado' && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Estado Cliente</Label>
              <Select
                value={estadoCliente || ''}
                onValueChange={(v) => handleEstadoChange('estado_cliente', v)}
                disabled={updatingStatus || !hasPermission('analizados', 'archive') || analisis?.credit_status === 'Formalizado'}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sin definir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Aprobado">Aprobado</SelectItem>
                  <SelectItem value="Rechazado">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Botón de Crédito - Crear o Ver según el estado */}
          {estadoCliente === 'Aprobado' && (
            analisis.has_credit || analisis.credit_id ? (
              <Button
                variant="outline"
                onClick={() => router.push(`/dashboard/creditos/${analisis.credit_id}`)}
                className="w-[180px] h-9 justify-start"
              >
                <FileText className="h-4 w-4 mr-2" />
                Ver Crédito
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={async () => {
                  try {
                    // Obtener la próxima referencia del servidor
                    const refResponse = await api.get('/api/credits/next-reference');
                    const nextReference = refResponse.data.reference;

                    setCreditForm({
                      reference: nextReference,
                      title: analisis.lead?.name || '',
                      status: 'Por firmar',
                      category: analisis.category || 'Regular',
                      monto_credito: analisis.monto_credito ? String(analisis.monto_credito) : '',
                      leadId: analisis.lead_id ? String(analisis.lead_id) : '',
                      clientName: analisis.lead?.name || '',
                      description: `Crédito generado desde análisis ${analisis.reference}`,
                      divisa: analisis.divisa || 'CRC',
                      plazo: analisis.plazo ? String(analisis.plazo) : '36',
                      poliza: false,
                      conCargosAdicionales: true,
                    });
                    setIsCreditDialogOpen(true);
                  } catch (err) {
                    toast({
                      variant: "destructive",
                      title: "Error",
                      description: "No se pudo obtener la referencia del crédito",
                    });
                  }
                }}
                className="w-[180px] h-9 justify-start"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generar crédito
              </Button>
            )
          )}
        </div>
      </div>

      {/* Contenido Principal */}
      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <div className="space-y-6">
            {/* Fila 1: Información del Cliente */}
        <div className="space-y-4">
          {/* Información del Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Nombre */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre</p>
                  {lead?.id ? (
                    <Link
                      href={`/dashboard/clientes/${lead.id}`}
                      className="text-base font-semibold text-blue-600 hover:underline"
                    >
                      {lead.name}
                    </Link>
                  ) : (
                    <span className="text-base">N/A</span>
                  )}
                </div>

                {/* Cédula */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cédula</p>
                  <p className="text-base font-semibold">{lead?.cedula || 'N/A'}</p>
                </div>

                {/* Estado Civil */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado Civil</p>
                  <p className="text-base">{lead?.estado_civil || 'N/A'}</p>
                </div>

                {/* Institución */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Institución</p>
                  <p className="text-base font-semibold">{lead?.institucion_labora || 'N/A'}</p>
                </div>

                {/* Puesto */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Puesto</p>
                  <p className="text-base">{analisis.cargo || lead?.puesto || 'N/A'}</p>
                </div>

                {/* Nombramiento */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombramiento</p>
                  <p className="text-base">{analisis.nombramiento || lead?.estado_puesto || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumen Financiero */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Resumen Financiero</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Producto */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Producto</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-sm font-semibold px-3 py-1">
                      {analisis.opportunity?.opportunity_type || 'No especificado'}
                    </Badge>
                  </div>
                </div>

                {/* Ingreso Neto */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ingreso Neto</p>
                  <div className="text-2xl font-bold text-green-600">
                    ₡{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
                      Math.min(
                        ...[
                          analisis.ingreso_neto,
                          analisis.ingreso_neto_2,
                          analisis.ingreso_neto_3,
                          analisis.ingreso_neto_4,
                          analisis.ingreso_neto_5,
                          analisis.ingreso_neto_6,
                        ].filter(v => v != null && v > 0)
                      ) || 0
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Mínimo de todos los meses</p>
                </div>

                {/* Monto Crédito */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monto Crédito</p>
                  <div className="text-2xl font-bold text-blue-600">
                    ₡{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(analisis.monto_sugerido || 0)}
                  </div>
                </div>

                {/* Plazo */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plazo</p>
                  <div className="text-2xl font-bold text-slate-700">
                    {analisis.plazo || 36} <span className="text-base font-normal text-muted-foreground">meses</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fila 2: Manchas/Juicios/Embargos + Salarios */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Resumen de Manchas/Juicios/Embargos con detalles expandibles */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Historial Crediticio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Manchas */}
              <Collapsible open={manchasOpen} onOpenChange={setManchasOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-2 bg-orange-50 rounded border border-orange-200 hover:bg-orange-100 transition-colors">
                    <span className="text-sm font-medium text-orange-900 flex items-center gap-2">
                      Manchas
                      {manchasOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                    <Badge variant={analisis.numero_manchas > 0 ? "destructive" : "secondary"} className="text-base px-3">
                      {analisis.numero_manchas || 0}
                    </Badge>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {analisis.manchas_detalle && analisis.manchas_detalle.length > 0 ? (
                    <div className="mt-2 space-y-2 pl-4">
                      {analisis.manchas_detalle.map((mancha, idx) => (
                        <div key={idx} className="p-3 bg-white rounded border border-orange-100 text-sm">
                          <p className="font-medium text-gray-700">{mancha.descripcion}</p>
                          <p className="text-orange-700 font-semibold mt-1">
                            Monto: ₡{new Intl.NumberFormat('en-US').format(mancha.monto)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2 pl-4">Sin detalles</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Juicios */}
              <Collapsible open={juiciosOpen} onOpenChange={setJuiciosOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-2 bg-red-50 rounded border border-red-200 hover:bg-red-100 transition-colors">
                    <span className="text-sm font-medium text-red-900 flex items-center gap-2">
                      Juicios
                      {juiciosOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                    <Badge variant={analisis.numero_juicios > 0 ? "destructive" : "secondary"} className="text-base px-3">
                      {analisis.numero_juicios || 0}
                    </Badge>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {analisis.juicios_detalle && analisis.juicios_detalle.length > 0 ? (
                    <div className="mt-2 space-y-2 pl-4">
                      {analisis.juicios_detalle.map((juicio, idx) => (
                        <div key={idx} className="p-3 bg-white rounded border border-red-100 text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-gray-700">Expediente: {juicio.expediente}</p>
                            <Badge variant={juicio.estado === 'activo' ? 'destructive' : 'secondary'}>
                              {juicio.estado}
                            </Badge>
                          </div>
                          <p className="text-gray-600">Fecha: {new Date(juicio.fecha).toLocaleDateString('es-CR')}</p>
                          <p className="text-red-700 font-semibold">
                            Monto: ₡{new Intl.NumberFormat('en-US').format(juicio.monto)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2 pl-4">Sin detalles</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Embargos */}
              <Collapsible open={embargosOpen} onOpenChange={setEmbargosOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-2 bg-purple-50 rounded border border-purple-200 hover:bg-purple-100 transition-colors">
                    <span className="text-sm font-medium text-purple-900 flex items-center gap-2">
                      Embargos
                      {embargosOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                    <Badge variant={analisis.numero_embargos > 0 ? "destructive" : "secondary"} className="text-base px-3">
                      {analisis.numero_embargos || 0}
                    </Badge>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {analisis.embargos_detalle && analisis.embargos_detalle.length > 0 ? (
                    <div className="mt-2 space-y-2 pl-4">
                      {analisis.embargos_detalle.map((embargo, idx) => (
                        <div key={idx} className="p-3 bg-white rounded border border-purple-100 text-sm space-y-1">
                          <p className="font-medium text-gray-700">{embargo.motivo}</p>
                          <p className="text-gray-600">Fecha: {new Date(embargo.fecha).toLocaleDateString('es-CR')}</p>
                          <p className="text-purple-700 font-semibold">
                            Monto: ₡{new Intl.NumberFormat('en-US').format(embargo.monto)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2 pl-4">Sin detalles</p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Resumen de Salarios (todos los meses) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Ingresos Mensuales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[160px] overflow-y-auto">
              {[
                { mes: 1, bruto: analisis.ingreso_bruto, neto: analisis.ingreso_neto },
                { mes: 2, bruto: analisis.ingreso_bruto_2, neto: analisis.ingreso_neto_2 },
                { mes: 3, bruto: analisis.ingreso_bruto_3, neto: analisis.ingreso_neto_3 },
                { mes: 4, bruto: analisis.ingreso_bruto_4, neto: analisis.ingreso_neto_4 },
                { mes: 5, bruto: analisis.ingreso_bruto_5, neto: analisis.ingreso_neto_5 },
                { mes: 6, bruto: analisis.ingreso_bruto_6, neto: analisis.ingreso_neto_6 },
              ]
                .filter(item => item.bruto || item.neto) // Solo mostrar meses con datos
                .map(item => (
                  <div key={item.mes} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                    <span className="font-medium text-gray-700">Mes {item.mes}</span>
                    <div className="flex gap-3">
                      <span className="text-gray-600">
                        B: ₡{new Intl.NumberFormat('en-US').format(item.bruto || 0)}
                      </span>
                      <span className="text-green-700 font-semibold">
                        N: ₡{new Intl.NumberFormat('en-US').format(item.neto || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              {![analisis.ingreso_bruto, analisis.ingreso_bruto_2, analisis.ingreso_bruto_3,
                 analisis.ingreso_bruto_4, analisis.ingreso_bruto_5, analisis.ingreso_bruto_6].some(v => v) && (
                <p className="text-sm text-gray-400 text-center py-4">No hay ingresos registrados</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fila 3: Propuestas de Crédito */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Propuestas de Crédito</CardTitle>
              <Badge variant="outline" className="text-xs">
                {propuestas.length} propuesta{propuestas.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Formulario de creación/edición (solo en modo edición) */}
            {isEditMode && (
              <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
                <p className="text-sm font-medium text-slate-700">
                  {editingPropuesta ? 'Editar Propuesta' : 'Nueva Propuesta'}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Monto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={propuestaForm.monto}
                      onChange={(e) => setPropuestaForm(prev => ({ ...prev, monto: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Plazo (meses)</Label>
                    <Input
                      type="number"
                      placeholder="Agregar plazo"
                      value={propuestaForm.plazo}
                      onChange={(e) => setPropuestaForm(prev => ({ ...prev, plazo: e.target.value }))}
                    />
                  </div>
                  {/* Comentado temporalmente: cuota, interes, categoria
                  <div>
                    <Label className="text-xs">Cuota</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={propuestaForm.cuota}
                      onChange={(e) => setPropuestaForm(prev => ({ ...prev, cuota: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Interés (%)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="33.50"
                      value={propuestaForm.interes}
                      onChange={(e) => setPropuestaForm(prev => ({ ...prev, interes: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Categoría</Label>
                    <Select
                      value={propuestaForm.categoria}
                      onValueChange={(v) => setPropuestaForm(prev => ({ ...prev, categoria: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Regular">Regular</SelectItem>
                        <SelectItem value="Micro-crédito">Micro-crédito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  */}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSubmitPropuesta} disabled={savingPropuesta}>
                    {savingPropuesta && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    {editingPropuesta ? 'Actualizar' : 'Agregar Propuesta'}
                  </Button>
                  {editingPropuesta && (
                    <Button size="sm" variant="outline" onClick={resetPropuestaForm}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Tabla de propuestas */}
            {propuestas.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Monto</TableHead>
                      <TableHead className="text-xs">Plazo</TableHead>
                      {/* Comentado temporalmente: Cuota, Interés, Categoría
                      <TableHead className="text-xs">Cuota</TableHead>
                      <TableHead className="text-xs">Interés</TableHead>
                      <TableHead className="text-xs">Categoría</TableHead>
                      */}
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propuestas.map((p, index) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{formatCurrency(p.monto)}</TableCell>
                        <TableCell className="text-sm">{p.plazo} meses</TableCell>
                        {/* Comentado temporalmente: cuota, interes, categoria
                        <TableCell className="text-sm">{formatCurrency(p.cuota)}</TableCell>
                        <TableCell className="text-sm">{p.interes}%</TableCell>
                        <TableCell className="text-sm">{p.categoria || '-'}</TableCell>
                        */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              p.estado === 'Aceptada'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : p.estado === 'Denegada'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }
                          >
                            {p.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString('es-CR')}
                        </TableCell>
                        <TableCell className="text-right">
                          {/* Mostrar botones para la primera propuesta si está pendiente, o para todas si está en modo edición */}
                          {p.estado === 'Pendiente' && (index === 0 || isEditMode) && (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleAceptarPropuesta(p.id)}
                                title="Aceptar"
                              >
                                <ThumbsUp className="h-5 w-5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDenegarPropuesta(p.id)}
                                title="Denegar"
                              >
                                <ThumbsDown className="h-5 w-5" />
                              </Button>
                              {isEditMode && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                                  onClick={() => handleEditPropuesta(p)}
                                  title="Editar"
                                >
                                  <Pencil className="h-5 w-5" />
                                </Button>
                              )}
                            </div>
                          )}
                          {p.estado !== 'Pendiente' && p.aceptada_por_user && (
                            <span className="text-xs text-muted-foreground">
                              por {p.aceptada_por_user.name}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No hay propuestas registradas para este análisis.
              </div>
            )}
          </CardContent>
        </Card>


        {/* Fila 3: Documentos con Miniaturas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderInput className="h-4 w-4 text-blue-500" />
              Documentos
              <Badge variant="secondary" className="ml-2">{heredados.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingFiles ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : heredados.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin documentos</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {heredados.map((file) => {
                  const { icon: FileIcon, color } = getFileTypeInfo(file.name);
                  const isImage = file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
                  const isPdf = file.name.toLowerCase().endsWith('.pdf');

                  return (
                    <div
                      key={file.path}
                      className="rounded-lg border overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Miniatura más grande */}
                      <div className="h-36 bg-gray-100 flex items-center justify-center relative overflow-hidden">
                        {isImage ? (
                          <button
                            type="button"
                            onClick={() => openLightbox(file)}
                            className="w-full h-full relative group cursor-pointer"
                          >
                            <img
                              src={file.url}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                              <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                        ) : isPdf ? (
                          <button
                            type="button"
                            onClick={() => openLightbox(file)}
                            className="w-full h-full relative bg-white group cursor-pointer"
                          >
                            <iframe
                              src={`${file.url}#toolbar=0&navpanes=0&scrollbar=0`}
                              className="absolute inset-0 w-full h-full pointer-events-none"
                              title={file.name}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                              <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <FileIcon className={`h-12 w-12 ${color}`} />
                            <span className="text-[10px] uppercase font-medium text-gray-500">
                              {file.name.split('.').pop()}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Info y botón de descarga */}
                      <div className="p-3">
                        <p className="text-xs font-medium truncate mb-1" title={file.name}>
                          {file.name}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            asChild
                          >
                            <a href={file.url} download={file.name}>
                              <Download className="h-4 w-4 mr-1" />
                              <span className="text-xs">Descargar</span>
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        <TabsContent value="tareas">
          <TareasTab opportunityReference={analisis.reference} opportunityId={analisis.id} />
        </TabsContent>
      </Tabs>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
          {(() => {
            const viewableFiles = getViewableFiles();
            const currentFile = viewableFiles[lightboxIndex];
            if (!currentFile) return null;
            const isImage = currentFile.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
            const isPdf = currentFile.name.toLowerCase().endsWith('.pdf');

            return (
              <div className="relative w-full h-[90vh] flex flex-col">
                {/* Header con controles */}
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
                  <div className="text-white">
                    <p className="text-sm font-medium truncate max-w-[300px]">{currentFile.name}</p>
                    <p className="text-xs text-white/70">{lightboxIndex + 1} de {viewableFiles.length}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isImage && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white hover:bg-white/20"
                          onClick={() => setLightboxZoom(z => Math.max(z - 0.25, 0.5))}
                        >
                          <ZoomOut className="h-5 w-5" />
                        </Button>
                        <span className="text-white text-sm min-w-[60px] text-center">{Math.round(lightboxZoom * 100)}%</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white hover:bg-white/20"
                          onClick={() => setLightboxZoom(z => Math.min(z + 0.25, 3))}
                        >
                          <ZoomIn className="h-5 w-5" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                      asChild
                    >
                      <a href={currentFile.url} download={currentFile.name}>
                        <Download className="h-5 w-5" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                      onClick={closeLightbox}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Contenido principal */}
                <div className="flex-1 flex items-center justify-center overflow-auto p-4 pt-20">
                  {isImage ? (
                    <img
                      src={currentFile.url}
                      alt={currentFile.name}
                      className="max-w-full max-h-full object-contain transition-transform duration-200"
                      style={{ transform: `scale(${lightboxZoom})` }}
                    />
                  ) : isPdf ? (
                    <iframe
                      src={currentFile.url}
                      className="w-full h-full bg-white rounded"
                      title={currentFile.name}
                    />
                  ) : null}
                </div>

                {/* Navegación */}
                {viewableFiles.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                      onClick={goToPrevious}
                    >
                      <ChevronLeft className="h-8 w-8" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                      onClick={goToNext}
                    >
                      <ChevronRight className="h-8 w-8" />
                    </Button>
                  </>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <CreditFormModal
        open={isCreditDialogOpen}
        onOpenChange={setIsCreditDialogOpen}
        initialData={{
          reference: creditForm.reference,
          title: creditForm.title,
          monto_credito: creditForm.monto_credito,
          leadId: creditForm.leadId,
          clientName: creditForm.clientName,
          category: creditForm.category,
          divisa: creditForm.divisa,
          plazo: creditForm.plazo,
          description: creditForm.description,
        }}
        products={products}
        leads={leads}
        onSuccess={async () => {
          // Refrescar análisis para actualizar has_credit
          const resAnalisis = await api.get(`/api/analisis/${analisisId}`);
          setAnalisis(resAnalisis.data);
        }}
      />
    </div>
  );
}
