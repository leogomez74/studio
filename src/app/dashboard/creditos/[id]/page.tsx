'use client';

/**
 * Cargos Adicionales - Implementación
 * ====================================
 *
 * Tipos de cargos:
 * - Comisión (3% del monto, vendedores externos)
 * - Transporte (₡10,000 fijos)
 * - Respaldo deudor (₡4,950 fijos, solo créditos regulares)
 * - Descuento factura (monto variable)
 *
 * Estado actual:
 * [x] UI de cargos adicionales en sección Detalles Financieros
 * [x] Edición de montos por tipo de cargo
 * [x] Cálculo de total de cargos y monto neto
 * [x] CARGOS_CONFIG con reglas de negocio
 * [x] Aplicar valores por defecto según config
 * [x] Backend: migración cargos_adicionales (JSON)
 * [x] Backend: modelo Credit con cast a array
 * [x] Backend: validación en CreditController
 * [ ] Asociar cargo a cuota específica o distribuir en plan de pagos
 * [ ] Mostrar desglose en balance general
 * [ ] Historial de cargos aplicados
 */

import React, { useState, useEffect, use, FormEvent, useCallback } from 'react';
import { format } from 'date-fns';
// --- Agent Option ---
interface AgentOption {
  id: number;
  name: string;
}
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Paperclip,
  FileText,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  ClipboardCheck,
  Loader2,
  Pencil,
  Save,
  X,
  Check,
  Download,
  FileSpreadsheet,
  PlusCircle,
  RefreshCw,
  Receipt,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ScrollableTableContainer,
} from '@/components/ui/table';
import api from '@/lib/axios';
import { useToast } from "@/hooks/use-toast";
import { CaseChat } from '@/components/case-chat';
import { DocumentManager } from '@/components/document-manager';
import { CreditDocumentManager } from '@/components/credit-document-manager';
import { RefundicionModal } from '@/components/RefundicionModal';

// --- Interfaces ---

interface CreditDocument {
  id: number;
  credit_id: number;
  name: string;
  notes: string | null;
  url?: string | null;
  path?: string | null;
  mime_type?: string | null;
  size?: number | null;
  created_at: string;
  updated_at: string;
}

interface CreditPayment {
  id: number;
  credit_id: number;
  numero_cuota: number;
  proceso: string | null;
  fecha_cuota: string;
  fecha_pago: string | null;
  cuota: number;
  poliza: number;
  interes_corriente: number;
  int_corriente_vencido: number;
  interes_moratorio: number;
  amortizacion: number;
  saldo_anterior: number;
  nuevo_saldo: number;
  estado: string;
  fecha_movimiento: string | null;
  movimiento_total: number;
  movimiento_amortizacion?: number;
  // New fields
  linea?: string | null;
  fecha_inicio?: string | null;
  fecha_corte?: string | null;
  tasa_actual?: number | null;
  plazo_actual?: number | null;
  dias?: number | null;
  dias_mora?: number | null;
}

interface PlanDePago {
  id: number;
  credit_id: number;
  linea: string | null;
  numero_cuota: number;
  proceso: string | null;
  fecha_inicio: Date | null;
  fecha_corte: string | null;
  fecha_pago: string | null;
  tasa_actual: number;
  plazo_actual: number;
  cuota: number;
  poliza: number;
  interes_corriente: number;
  int_corriente_vencido: number;
  interes_moratorio: number;
  amortizacion: number;
  saldo_anterior: number;
  saldo_nuevo: number;
  dias: number;
  estado: string | null;
  dias_mora: number;
  fecha_movimiento: string | null;
  movimiento_total: number;
  movimiento_poliza: number;
  movimiento_interes_corriente: number;
  movimiento_int_corriente_vencido: number;
  movimiento_interes_moratorio: number;
  movimiento_principal: number;
  movimiento_amortizacion?: number;
  movimiento_caja_usuario: string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  concepto: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientOption {
  id: number;
  name: string;
  cedula: string;
  email: string;
  phone: string;
  ocupacion?: string;
  departamento_cargo?: string;
}

// Configuración de cargos adicionales con reglas de negocio
// - Comisión: 3% del monto (vendedores externos)
// - Respaldo deudor: ₡4,950 fijos (solo créditos regulares)
// - Transporte: ₡10,000 fijos
// - Los cargos se restan del monto del crédito
const CARGOS_CONFIG = {
  comision: {
    label: 'Comisión (3%)',
    porcentaje: 0.03,
    fijo: null as number | null,
    soloRegular: false,
    descripcion: '3% del monto para vendedores externos'
  },
  transporte: {
    label: 'Transporte',
    porcentaje: null as number | null,
    fijo: 10000,
    soloRegular: false,
    descripcion: '₡10,000 fijos'
  },
  respaldo_deudor: {
    label: 'Respaldo deudor',
    porcentaje: null as number | null,
    fijo: 4950,
    soloRegular: true,
    descripcion: '₡4,950 solo para créditos regulares'
  },
  descuento_factura: {
    label: 'Descuento factura',
    porcentaje: null as number | null,
    fijo: null as number | null,
    soloRegular: false,
    descripcion: 'Monto variable'
  },
  cancelacion_manchas: {
    label: 'Cancelación de manchas',
    porcentaje: null as number | null,
    fijo: null as number | null,
    soloRegular: false,
    descripcion: 'Monto variable para cancelación de manchas'
  },
};

type TipoCargoAdicional = keyof typeof CARGOS_CONFIG;

interface CargosAdicionales {
  comision: number;
  transporte: number;
  respaldo_deudor: number;
  descuento_factura: number;
  cancelacion_manchas: number;
}

interface CreditItem {
  id: number;
  reference: string;
  title: string;
  status: string | null;
  category: string | null;
  progress: number;
  opened_at: string | null;
  description: string | null;
  lead_id: number;
  lead?: {
    id: number;
    name: string;
    cedula?: string | null;
    institucion_labora?: string | null;
    documents?: CreditDocument[];
    deductora_id?: number,
    assigned_to_id: number,
    ocupacion?: string | null;
  } | null;
  opportunity_id: string | null;
  client?: ClientOption | null;
  opportunity?: { id: string; title: string | null } | null;
  created_at?: string | null;
  updated_at?: string | null;
  documents?: CreditDocument[];
  payments?: CreditPayment[];
  plan_de_pagos?: PlanDePago[];
  tipo_credito?: string | null;
  numero_operacion?: string | null;
  monto_credito?: number | null;
  cuota?: number | null;
  fecha_ultimo_pago?: string | null;
  garantia?: string | null;
  fecha_culminacion_credito?: string | null;
  formalized_at?: string | null;
  tasa_anual?: number | null;
  tasa?: { id: number; tasa: number } | null;
  plazo?: number | null;
  cuotas_atrasadas?: number | null;
  deductora_id?: number | null;
  deductora?: { id: number; nombre: string } | null;
  assigned_to?: number | null;
  assignedTo?: { id: number; name: string } | null;
  divisa?: string | null;
  linea?: string | null;
  primera_deduccion?: string | null;
  saldo?: number | null;
  // saldo_a_favor removed
  proceso?: string | null;
  poliza?: boolean | null;
  // Cargos adicionales
  cargos_adicionales?: CargosAdicionales | null;
  // Refundición
  refundicion_parent_id?: number | null;
  refundicion_child_id?: number | null;
  refundicion_saldo_absorbido?: number | null;
  refundicion_monto_entregado?: number | null;
  refundicion_at?: string | null;
  cierre_motivo?: string | null;
  refundicion_parent?: { id: number; reference: string; monto_credito: number; saldo: number } | null;
  refundicion_child?: { id: number; reference: string; monto_credito: number; saldo: number } | null;
}

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
            <CardTitle>Tareas del Crédito</CardTitle>
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
              <p className="text-muted-foreground">No hay tareas para este crédito.</p>
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
            <DialogDescription>Crea una nueva tarea para este crédito.</DialogDescription>
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

// --- Helpers ---

function formatDate(dateString?: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function formatCurrency(amount?: number | null): string {
  if (amount === null || amount === undefined) return "0.00";
  return new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

const formatAmount = (amount?: number | null): string => {
  if (amount === null || amount === undefined) return "0.00";
  return new Intl.NumberFormat('es-CR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// --- Main Component ---

interface DeductoraOption {
  id: string | number;
  nombre: string;
}

function CreditDetailClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [credit, setCredit] = useState<CreditItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPanelVisible, setIsPanelVisible] = useState(false);

  // Refundición State
  const [refundicionOpen, setRefundicionOpen] = useState(false);

  // Edit State
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<CreditItem>>({});
  const [saving, setSaving] = useState(false);

  // Formalizar modal
  const [formalizarDialogOpen, setFormalizarDialogOpen] = useState(false);
  const [formalizacionDate, setFormalizacionDate] = useState<Date>(new Date());

  // Cargos Adicionales State
  const [cargosAdicionales, setCargosAdicionales] = useState<CargosAdicionales>({
    comision: 0,
    transporte: 0,
    respaldo_deudor: 0,
    descuento_factura: 0,
    cancelacion_manchas: 0,
  });

  // Estado para trackear el campo de cargo en edición
  const [editingCargo, setEditingCargo] = useState<TipoCargoAdicional | null>(null);
  
  // Combobox/Select Data
  const [users, setUsers] = useState<{id: number, name: string}[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Agents (for Responsable display)
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  // Deductoras
  const [deductoras, setDeductoras] = useState<DeductoraOption[]>([]);
  const [isLoadingDeductoras, setIsLoadingDeductoras] = useState(true);
  // Tasks (for Responsable fallback)
  const [creditTasks, setCreditTasks] = useState<TaskItem[]>([]);

  // Active Tab (controlled by query parameter)
  const [activeTab, setActiveTab] = useState<string>(() => {
    return searchParams.get('tab') || 'credito';
  });

  // Check if localhost (for dev tools)
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Helpers para formateo
  const formatNumber = (n: number | string | null | undefined) => {
    if (n === null || n === undefined) return '-';
    return Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-CR');
  };

  // Función para descargar plan de pagos como Markdown COMPLETO
  const downloadPlanAsMarkdown = () => {
    if (!credit?.plan_de_pagos) return;

    let md = `# Plan de Pagos - ${credit.numero_operacion || credit.reference}\n\n`;
    md += `## Información del Crédito\n\n`;
    md += `| Campo | Valor |\n|-------|-------|\n`;
    md += `| Cliente | ${credit.lead?.name || 'N/A'} |\n`;
    md += `| Cédula | ${credit.lead?.cedula || 'N/A'} |\n`;
    md += `| Monto Original | ₡${formatNumber(credit.monto_credito)} |\n`;
    const interesesVencidosMd = (credit.plan_de_pagos || [])
      .filter(p => p.estado === 'Mora')
      .reduce((sum, p) => sum + (Number(p.int_corriente_vencido) || 0), 0);
    const saldoTotalMd = (Number(credit.saldo) || 0) + interesesVencidosMd;
    md += `| Saldo Actual | ₡${formatNumber(saldoTotalMd)} |\n`;
    md += `| Estado Crédito | ${credit.status} |\n`;
    md += `| Tasa Anual | ${credit.tasa?.tasa ?? credit.tasa_anual ?? '0.00'}% |\n`;
    md += `| Plazo | ${credit.plazo} meses |\n`;
    md += `| Cuota Fija | ₡${formatNumber(credit.cuota)} |\n`;
    md += `| Deductora | ${credit.deductora_id || 'N/A'} |\n`;
    md += `| Formalizado | ${formatDate(credit.formalized_at)} |\n\n`;

    md += `## Tabla de Amortización\n\n`;
    md += `| # | Estado | Fecha Corte | Cuota | Póliza | Int.Corr | Int.Corr.Venc | Int.Mora | Amort | Capital | Saldo por Pagar |\n`;
    md += `|---|--------|-------------|-------|--------|----------|---------------|----------|-------|---------|----------------|\n`;

    const sortedPlan = [...credit.plan_de_pagos].sort((a, b) => a.numero_cuota - b.numero_cuota);

    for (const p of sortedPlan) {
      md += `| ${p.numero_cuota} | ${p.estado || '-'} | ${formatDate(p.fecha_corte)} | ${formatNumber(p.cuota)} | ${formatNumber(p.poliza)} | ${formatNumber(p.interes_corriente)} | ${formatNumber(p.int_corriente_vencido ?? 0)} | ${formatNumber(p.interes_moratorio)} | ${formatNumber(p.amortizacion)} | ${formatNumber(p.saldo_anterior)} | ${formatNumber(p.saldo_nuevo)} |\n`;
    }

    // Tabla de Movimientos
    const hasMovimientos = sortedPlan.some(p => p.movimiento_total && Number(p.movimiento_total) > 0);
    if (hasMovimientos) {
      md += `\n## Movimientos Registrados\n\n`;
      md += `| # | Fecha Mov | Mov.Total | Mov.Póliza | Mov.Int.Corr | Mov.Int.C.Venc | Mov.Int.Mora | Mov.Amort | Concepto |\n`;
      md += `|---|-----------|-----------|------------|--------------|----------------|--------------|-----------|----------|\n`;
      for (const p of sortedPlan) {
        if (p.movimiento_total && Number(p.movimiento_total) > 0) {
          md += `| ${p.numero_cuota} | ${formatDate(p.fecha_movimiento)} | ${formatNumber(p.movimiento_total)} | ${formatNumber(p.movimiento_poliza)} | ${formatNumber(p.movimiento_interes_corriente)} | ${formatNumber(p.movimiento_int_corriente_vencido ?? 0)} | ${formatNumber(p.movimiento_interes_moratorio)} | ${formatNumber(p.movimiento_amortizacion)} | ${p.concepto || '-'} |\n`;
        }
      }
    }

    // Resumen
    const cuotasPagadas = sortedPlan.filter(p => p.estado === 'Pagado').length;
    const cuotasMora = sortedPlan.filter(p => p.estado === 'Mora').length;
    const cuotasPendientes = sortedPlan.filter(p => p.estado === 'Pendiente' && p.numero_cuota > 0).length;
    const totalMora = sortedPlan.reduce((sum, p) => sum + Number(p.interes_moratorio || 0), 0);

    md += `\n## Resumen\n\n`;
    md += `| Concepto | Valor |\n|----------|-------|\n`;
    md += `| Cuotas Pagadas | ${cuotasPagadas} |\n`;
    md += `| Cuotas en Mora | ${cuotasMora} |\n`;
    md += `| Cuotas Pendientes | ${cuotasPendientes} |\n`;
    md += `| Total Int. Moratorio | ₡${formatNumber(totalMora)} |\n`;

    md += `\n---\n*Generado: ${new Date().toLocaleString('es-CR')}*\n`;

    const blob = new Blob([md], { type: 'text/markdown; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plan_pagos_${credit.numero_operacion || credit.reference || id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Función para descargar plan de pagos como PDF
  const downloadPlanAsPDF = async () => {
    if (!credit?.plan_de_pagos) return;

    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const sortedPlan = [...credit.plan_de_pagos].sort((a, b) => a.numero_cuota - b.numero_cuota);

    // Título
    doc.setFontSize(16);
    doc.text(`Plan de Pagos - ${credit.numero_operacion || credit.reference}`, 14, 15);

    // Info del crédito
    doc.setFontSize(10);
    const tasaValue = credit.tasa?.tasa ?? credit.tasa_anual ?? '0.00';
    doc.text(`Cliente: ${credit.lead?.name || 'N/A'}`, 14, 25);
    doc.text(`Monto: ${formatNumber(credit.monto_credito)}`, 14, 30);
    doc.text(`Saldo por Pagar: ${formatNumber(credit.saldo)}`, 120, 25);
    doc.text(`Estado: ${credit.status}`, 120, 30);
    doc.text(`Tasa: ${tasaValue}%`, 200, 25);
    doc.text(`Plazo: ${credit.plazo} meses`, 200, 30);

    // Tabla principal con todas las columnas
    const tableData = sortedPlan.map(p => [
      p.numero_cuota,
      p.estado || '-',
      formatDate(p.fecha_corte),
      formatNumber(p.cuota),
      formatNumber(p.poliza ?? 0),
      formatNumber(p.interes_corriente),
      formatNumber(p.int_corriente_vencido ?? 0),
      formatNumber(p.interes_moratorio),
      formatNumber(p.amortizacion),
      formatNumber(p.saldo_anterior),
      formatNumber(p.saldo_nuevo),
      p.dias_mora || '0',
      formatDate(p.fecha_movimiento),
      formatNumber(p.movimiento_total ?? 0),
      formatNumber(p.movimiento_poliza ?? 0),
      formatNumber(p.movimiento_interes_corriente ?? 0),
      formatNumber(p.movimiento_int_corriente_vencido ?? 0),
      formatNumber(p.movimiento_interes_moratorio ?? 0),
      formatNumber(p.movimiento_amortizacion ?? 0),
      formatNumber(p.movimiento_principal ?? 0),
    ]);

    autoTable(doc, {
      head: [['#', 'Estado', 'Fecha', 'Cuota', 'Póliza', 'Int.Corr', 'Int.C.Venc', 'Int.Mora', 'Amort', 'Capital', 'Saldo', 'Mora', 'F.Mov', 'Mov.Total', 'Mov.Pól', 'Mov.Int.C', 'Mov.Int.V', 'Mov.Int.M', 'Mov.Amort', 'Mov.Princ']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 5.5, cellPadding: 0.8 },
      headStyles: { fillColor: [41, 128, 185], fontSize: 5 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 16 },
        2: { cellWidth: 16 },
        11: { cellWidth: 8 },
        12: { cellWidth: 14 },
      },
    });

    doc.save(`plan_pagos_${credit.numero_operacion || credit.reference || id}.pdf`);
  };
  // Fetch Deductoras
  const fetchDeductoras = async () => {
    try {
      setIsLoadingDeductoras(true);
      const response = await api.get('/api/deductoras');
      let data = response.data;
      if (!Array.isArray(data)) {
        data = data.data || [];
      }
      if (!Array.isArray(data)) {
        data = [];
      }
      setDeductoras(data);
    } catch (error) {
      setDeductoras([]);
      console.error("Error fetching deductoras:", error);
    } finally {
      setIsLoadingDeductoras(false);
    }
  };


  // --- Fetch Data ---

  const fetchCredit = async () => {
    try {
      const response = await api.get(`/api/credits/${id}`);
      const data = response.data;

      // Use backend-provided fecha_ultimo_pago if available
      // Note: This computation should ideally be done on the backend for consistency
      if (!data.fecha_ultimo_pago && Array.isArray(data.payments) && data.payments.length > 0) {
        const paidPayments = data.payments
          .filter((p: any) => p.fecha_pago)
          .sort((a: any, b: any) => new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime());
        if (paidPayments.length > 0) {
          data.fecha_ultimo_pago = paidPayments[0].fecha_pago;
        }
      }

      setCredit(data);
      // Set default value for garantía if not present
      if (!data.garantia) {
        data.garantia = 'Pagaré';
      }
      setFormData(data);
      // Inicializar cargos adicionales
      if (data.cargos_adicionales) {
        setCargosAdicionales(data.cargos_adicionales);
      }
    } catch (error) {
      console.error("Error fetching credit:", error);
      toast({ title: "Error", description: "No se pudo cargar el crédito", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredit();
  }, [id]);

  useEffect(() => {
    const editParam = searchParams.get('edit');
    const estadosEditables = ['Aprobado', 'Por firmar'];
    if (editParam === 'true' && !credit?.formalized_at && credit?.status && estadosEditables.includes(credit.status)) {
      setIsEditMode(true);
    }
  }, [searchParams, credit?.formalized_at, credit?.status]);

  // Update active tab when query parameter changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && (tab === 'credito' || tab === 'plan-pagos')) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoadingUsers(true);
        const response = await api.get('/api/agents');
        setUsers(response.data);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    fetchUsers();
    fetchDeductoras();

    // Fetch agents for Responsable display
    const fetchAgents = async () => {
      try {
        setIsLoadingAgents(true);
        const response = await api.get('/api/agents');
        let data = response.data;
        if (!Array.isArray(data)) {
          data = data.data || [];
        }
        if (!Array.isArray(data)) {
          data = [];
        }
        setAgents(data);
      } catch (error) {
        setAgents([]);
        console.error("Error fetching agents:", error);
      } finally {
        setIsLoadingAgents(false);
      }
    };
    fetchAgents();

    // Fetch tasks for Responsable fallback
    const fetchCreditTasks = async () => {
      try {
        const response = await api.get('/api/tareas');
        const data = response.data.data || response.data;
        const allTasks = Array.isArray(data) ? data : [];

        console.log('[DEBUG RESPONSABLE] ==================================');
        console.log('[DEBUG RESPONSABLE] Total de tareas cargadas:', allTasks.length);

        // Función para normalizar texto (eliminar acentos y convertir a minúsculas)
        const normalizeText = (text: string) => {
          return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''); // Elimina acentos
        };

        // Filtrar tareas con título "Nuevo credito creado" (insensitive a acentos y mayúsculas)
        const filteredTasks = allTasks.filter((task: TaskItem) => {
          if (!task.title) return false;
          const normalizedTitle = normalizeText(task.title);
          return (
            normalizedTitle.includes('nuevo') &&
            normalizedTitle.includes('credito') &&
            normalizedTitle.includes('creado')
          );
        });

        console.log('[DEBUG RESPONSABLE] Tareas con título "Nuevo credito creado":', filteredTasks);
        console.log('[DEBUG RESPONSABLE] Número de tareas encontradas:', filteredTasks.length);

        if (filteredTasks.length > 0) {
          console.log('[DEBUG RESPONSABLE] Primera tarea:', filteredTasks[0]);
          if (filteredTasks[0].assignee) {
            console.log('[DEBUG RESPONSABLE] Responsable encontrado:', filteredTasks[0].assignee.name);
          }
        } else {
          console.log('[DEBUG RESPONSABLE] NO se encontró tarea de crédito creado');
        }
        console.log('[DEBUG RESPONSABLE] ==================================');

        setCreditTasks(filteredTasks);
      } catch (error) {
        console.error("Error fetching credit tasks:", error);
        setCreditTasks([]);
      }
    };
    fetchCreditTasks();
  }, [id]);

  // Recalcular cargos cuando cambia el tipo de crédito
  useEffect(() => {
    if (!isEditMode || !formData.category) return;

    const esRegular = formData.category === 'Regular';

    setCargosAdicionales(prev => {
      const nuevosCargos = { ...prev };

      if (esRegular) {
        // Si es Regular y respaldo_deudor está en 0, aplicar valor por defecto
        if (prev.respaldo_deudor === 0) {
          nuevosCargos.respaldo_deudor = CARGOS_CONFIG.respaldo_deudor.fijo || 0;
        }
      } else {
        // Si no es Regular, respaldo_deudor debe ser 0
        nuevosCargos.respaldo_deudor = 0;
      }

      return nuevosCargos;
    });
  }, [formData.category, isEditMode]);

  // --- Handlers: Edit ---

  const handleInputChange = (field: keyof CreditItem, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCargoChange = (tipo: TipoCargoAdicional, value: number) => {
    setCargosAdicionales(prev => ({ ...prev, [tipo]: value }));
  };

  const getTotalCargos = () => {
    return Object.values(cargosAdicionales).reduce((sum, val) => sum + (val || 0), 0);
  };

  // Calcular comisión sugerida (3% del monto)
  const getComisionSugerida = () => {
    const monto = formData.monto_credito || credit?.monto_credito || 0;
    return monto * 0.03;
  };

  // Monto de desembolso = monto_credito - cargos adicionales
  const getMontoNeto = () => {
    const monto = formData.monto_credito || credit?.monto_credito || 0;
    return monto - getTotalCargos();
  };

  // Monto original = monto_credito (total del crédito)
  const getMontoOriginal = () => {
    return formData.monto_credito || credit?.monto_credito || 0;
  };

  // Aplicar valores por defecto según CARGOS_CONFIG
  const aplicarCargosDefecto = () => {
    const monto = formData.monto_credito || credit?.monto_credito || 0;
    const esRegular = (formData.category || credit?.category) === 'Regular';

    const nuevosCargos: CargosAdicionales = {
      comision: 0,
      transporte: 0,
      respaldo_deudor: 0,
      descuento_factura: 0,
      cancelacion_manchas: 0,
    };

    (Object.entries(CARGOS_CONFIG) as [TipoCargoAdicional, typeof CARGOS_CONFIG[TipoCargoAdicional]][]).forEach(([key, config]) => {
      // Si es solo para Regular y no es Regular, dejar en 0
      if (config.soloRegular && !esRegular) {
        nuevosCargos[key] = 0;
        return;
      }

      // Calcular según porcentaje o fijo
      if (config.porcentaje) {
        nuevosCargos[key] = monto * config.porcentaje;
      } else if (config.fijo) {
        nuevosCargos[key] = config.fijo;
      }
    });

    setCargosAdicionales(nuevosCargos);
  };

  // Export Handlers
  const handleExportCSV = () => {
    if (!credit) return;

    const escapeCSV = (value: string | number | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      "Referencia", "Título", "Estado", "Categoría", "Cliente", "Monto", "Saldo", "Cuota", "Divisa"
    ];
    const row = [
      escapeCSV(credit.reference),
      escapeCSV(credit.title),
      escapeCSV(credit.status),
      escapeCSV(credit.category),
      escapeCSV(credit.client?.name || credit.lead?.name || ""),
      escapeCSV(formatCurrency(credit.monto_credito)),
      escapeCSV(formatCurrency(credit.saldo)),
      escapeCSV(formatCurrency(credit.cuota)),
      escapeCSV(credit.divisa || "CRC"),
    ];

    const csvContent = [headers.join(","), row.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `credito_${credit.reference}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = async () => {
    if (!credit) return;

    const doc = new jsPDF();
    const currentDate = new Date().toLocaleDateString('es-CR');

    const img = new Image();
    img.src = '/logopepweb.png';
    img.onload = () => {
      doc.addImage(img, 'PNG', 14, 10, 40, 15);
      generatePDFContent(doc, credit, currentDate);
    };
    img.onerror = () => {
      doc.text("CREDIPEP", 14, 20);
      generatePDFContent(doc, credit, currentDate);
    };
  };

  const generatePDFContent = (doc: jsPDF, creditData: CreditItem, date: string) => {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("ESTADO DE CUENTA", 105, 15, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`REPORTE AL ${date}`, 105, 22, { align: "center" });

    doc.setFontSize(10);
    doc.text(`*${creditData.lead_id}*`, 195, 15, { align: "right" });
    doc.text(`${creditData.lead_id}`, 195, 22, { align: "right" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${creditData.lead_id}`, 14, 35);
    doc.text(`${creditData.client?.name || "CLIENTE DESCONOCIDO"}`, 14, 40);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("INST./EMPRESA", 100, 35);
    doc.text(`${creditData.client?.ocupacion || "-"}`, 130, 35);
    doc.text(`${creditData.client?.departamento_cargo || "-"}`, 100, 40);
    doc.text("SECCIÓN", 100, 45);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 128);
    doc.text("Planes de Ahorros", 14, 55);
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: 60,
      head: [['N.CON', 'PLAN', 'MENSUALIDAD', 'INICIO', 'REND.CORTE', 'APORTES', 'RENDIMIENTO', 'ACUMULADO']],
      body: [
        ['621', 'SOBRANTES POR APLICAR', '0.00', '27/09/2022', '', '0.64', '0.00', '0.64']
      ],
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fontStyle: 'bold', textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 50 },
      }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 128);
    doc.text("Créditos / Otras deducciones", 14, finalY);
    doc.setTextColor(0, 0, 0);

    const estadosEditables = ['Aprobado', 'Por firmar'];
    const esEditable = creditData.status && estadosEditables.includes(creditData.status);
    const tasaValue = esEditable
      ? (creditData.tasa?.tasa ?? creditData.tasa_anual ?? '0.00')
      : (creditData.tasa_anual ?? creditData.tasa?.tasa ?? '0.00');
    const creditRow = [
      creditData.numero_operacion || creditData.reference,
      creditData.linea || "PEPITO ABIERTO",
      formatAmount(creditData.monto_credito || 0),
      creditData.plazo || 120,
      formatAmount(creditData.cuota || 0),
      formatAmount(creditData.saldo || 0),
      `${tasaValue}%`,
      "0.00",
      creditData.primera_deduccion || "-",
      new Date().toISOString().split('T')[0],
      creditData.fecha_culminacion_credito || "2032-01-01",
      creditData.status || "NORMAL"
    ];

    autoTable(doc, {
      startY: finalY + 5,
      head: [['OPERACIÓN', 'LINEA', 'MONTO', 'PLAZO', 'CUOTA', 'SALDO', 'TASA', 'MOROSIDAD', 'PRI.DED', 'ULT.MOV', 'TERMINA', 'PROCESO']],
      body: [creditRow],
      theme: 'plain',
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fontStyle: 'bold', textColor: [0, 0, 0] },
    });

    finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 128);
    doc.text("Fianzas", 14, finalY);
    doc.setTextColor(0, 0, 0);

    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 128);
    doc.line(14, finalY + 2, 195, finalY + 2);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");

    if (creditData.plan_de_pagos && creditData.plan_de_pagos.length > 0) {
      finalY = finalY + 20;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 128);
      doc.text("Plan de Pagos", 14, finalY);
      doc.setTextColor(0, 0, 0);

      const paymentRows = creditData.plan_de_pagos.map(p => [
        p.numero_cuota,
        formatDate(p.fecha_corte),
        formatDate(p.fecha_pago),
        formatAmount(p.cuota),
        formatAmount(p.interes_corriente),
        formatAmount(p.amortizacion),
        formatAmount(p.saldo_nuevo),
        p.estado
      ]);

      autoTable(doc, {
        startY: finalY + 5,
        head: [['#', 'FECHA CUOTA', 'FECHA PAGO', 'CUOTA', 'INTERÉS', 'AMORTIZACIÓN', 'SALDO', 'ESTADO']],
        body: paymentRows,
        theme: 'striped',
        styles: { fontSize: 7, cellPadding: 1 },
        headStyles: { fontStyle: 'bold', textColor: [0, 0, 0], fillColor: [220, 220, 220] },
      });
    } else {
      doc.text("*** NO TIENE FIANZAS ACTIVAS ***", 20, finalY + 10);
    }

    doc.save(`estado_cuenta_${creditData.lead_id}.pdf`);
  };

  const handleExportPagare = async () => {
    if (!credit) return;

    const today = new Date().toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' });
    const doc = new jsPDF();

    const img = new Image();
    img.src = '/logopepweb.png';
    img.onload = () => {
      doc.addImage(img, 'PNG', 15, 10, 40, 15);
      generatePagareDocument(doc, credit, today);
    };
    img.onerror = () => {
      generatePagareDocument(doc, credit, today);
    };
  };

  const generatePagareDocument = (doc: jsPDF, creditData: CreditItem, prettyDate: string) => {
    doc.setLanguage("es");

    const debtor = creditData.client || creditData.lead || null;
    const nombre = (debtor?.name || '').toUpperCase();
    const cedula = (debtor as any)?.cedula || '';
    const estadoCivil = ((debtor as any)?.estado_civil || '').toUpperCase();
    const profesion = (debtor?.ocupacion || '').toUpperCase();
    const direccion = [
      (debtor as any)?.direccion1,
      (debtor as any)?.direccion2,
    ].filter(Boolean).join(', ').toUpperCase();

    let y = 35;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('OPERACIÓN N°', 160, 15);
    doc.text(creditData.numero_operacion || creditData.reference || '', 188, 15);

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGARE', 105, 25, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`San José, Costa Rica, el día ${prettyDate.toUpperCase()}`, 20, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DEUDOR', 20, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    doc.text('Nombre y apellidos del deudor:', 30, y);
    doc.text(nombre, 90, y);
    y += 4;

    doc.text('Número de cédula de identidad:', 30, y);
    doc.text(cedula, 90, y);
    y += 4;

    doc.text('Estado civil:', 30, y);
    doc.text(estadoCivil, 90, y);
    y += 4;

    doc.text('Profesión/Oficio:', 30, y);
    doc.text(profesion, 90, y);
    y += 4;

    doc.text('Dirección de domicilio:', 30, y);
    if (direccion) {
      const direccionLines = doc.splitTextToSize(direccion, 105);
      doc.text(direccionLines, 90, y);
      y += direccionLines.length * 3.5 + 2;
    } else {
      y += 4;
    }
    y += 5;

    const monto = Number(creditData.monto_credito ?? 0);
    const plazo = Number(creditData.plazo ?? 0);
    const estadosEditablesPagare = ['Aprobado', 'Por firmar'];
    const esEditablePagare = creditData.status && estadosEditablesPagare.includes(creditData.status);
    const tasaNumber = Number(esEditablePagare
      ? (creditData.tasa?.tasa ?? creditData.tasa_anual ?? 0)
      : (creditData.tasa_anual ?? creditData.tasa?.tasa ?? 0));
    const tasaMensual = (tasaNumber / 12).toFixed(2);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Monto en números:', 30, y);
    doc.setFont('helvetica', 'normal');
    const divisaCode = creditData.divisa || 'CRC';
    doc.text(`${divisaCode}  ${formatAmount(monto)}`, 85, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('Monto en letras:', 30, y);
    doc.setFont('helvetica', 'normal');
    doc.text('____________________________________________ DE COLONES EXACTOS', 85, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Tasa de interés corriente:', 30, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tasa fija mensual del ${tasaMensual}%`, 85, y);
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('Tasa de interés moratoria:', 30, y);
    doc.setFont('helvetica', 'normal');
    const tasaMoratoria = ((tasaNumber / 12) * 1.3).toFixed(2);
    doc.text(`Tasa mensual del ${tasaMoratoria}%`, 85, y);
    y += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Forma de pago:', 30, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    const formaPago = `Cuotas mensuales, en número igual al número de meses indicados como "plazo en variables y meses". Yo, la persona indicada como "deudor" en este documento, PROMETO pagar INCONDICIONALMENTE este PAGARE a la orden de CREDIPEP, S.A. cédula jurídica 3-101-515511 entidad domiciliada en San José, San José, Sabana Norte, del ICE, 100 m oeste, 400 m norte y 50 oeste, mano izquierda casa blanca de dos pisos, # 5635. El monto de la deuda es la suma indicada como "Monto en Letras" y "Monto en Números". La tasa de interés corriente es la indicada como "tasa de interés corriente". El pago se llevará a cabo en San José, en el domicilio de la acreedora, en dinero corriente y en colones costarricenses. Los intereses se calcularán sobre la base del saldo de principal en un momento determinado y en porcentajes señalados como "tasa de interés corriente" Los pagos incluyen el capital más intereses y pagaré con la periodicidad de pago indicada. Renuncio a mi domicilio y requerimientos de pago y acepto la concesión de prórrogas sin que se me consulte ni notifique. Asimismo la falta de pago de una sola de las cuotas de capital e intereses indicadas dará derecho al acreedor a tener por vencida y exigible ejecutiva y judicialmente toda la deuda. Este título se rige por las normas del Código de Comercio vigentes acerca del "Pagaré" como título a la orden para representación de un compromiso incondicional de pago de sumas de dinero.`;
    const formaPagoLines = doc.splitTextToSize(formaPago, 175);
    doc.text(formaPagoLines, 30, y);
    y += formaPagoLines.length * 3.5 + 5;

    doc.setFont('helvetica', 'bold');
    doc.text('SOBRE LOS ABONOS EXTRAORDINARIOS Y CANCELACIÓN ANTICIPADA:', 30, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    const abonosTexto = `Se indica y aclara al deudor de este pagaré, que, por los abonos extraordinarios y cancelación anticipada antes de los primeros doce meses naturales a partir del primer día siguiente a la firma de este crédito se penalizará con tres meses de intereses corrientes, (los cuales tendrá como base de cálculo el mes en el que se realizará la cancelación y los dos meses siguientes a este).`;
    const abonosLines = doc.splitTextToSize(abonosTexto, 175);
    doc.text(abonosLines, 30, y);

    doc.save(`pagare_${creditData.numero_operacion || creditData.reference}.pdf`);
  };

  const handleFormalizar = () => {
    setFormalizacionDate(new Date());
    setFormalizarDialogOpen(true);
  };

  const handleConfirmFormalizar = async () => {
    if (!credit) return;

    try {
      await api.put(`/api/credits/${credit.id}`, {
        status: 'Formalizado',
        formalized_at: format(formalizacionDate, 'yyyy-MM-dd')
      });
      toast({
        title: 'Crédito formalizado',
        description: 'El plan de pagos se ha generado correctamente.',
      });
      setFormalizarDialogOpen(false);
      // Reload credit data
      const response = await api.get(`/api/credits/${credit.id}`);
      setCredit(response.data);
      setFormData(response.data);
    } catch (error: any) {
      console.error('Error formalizando crédito:', error);
      const message = error.response?.data?.message || 'No se pudo formalizar el crédito.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!credit) return;

    const previousStatus = credit.status;

    // No permitir editar campos críticos si el crédito ya fue formalizado (tiene formalized_at)
    if (credit.formalized_at) {
      // Validar si se intentan cambiar campos protegidos
      const camposProtegidos = ['tasa_anual', 'tasa_maxima', 'monto_credito', 'plazo'];
      const cambiosProhibidos = camposProtegidos.filter(campo =>
        formData[campo as keyof CreditItem] !== undefined &&
        formData[campo as keyof CreditItem] !== credit[campo as keyof CreditItem]
      );

      if (cambiosProhibidos.length > 0) {
        toast({
          title: "Error",
          description: `No se pueden modificar los siguientes campos en un crédito formalizado: ${cambiosProhibidos.join(', ')}`,
          variant: "destructive"
        });
        return;
      }
    }

    const isFormalizingCredit = formData.status === 'Formalizado' && previousStatus !== 'Formalizado';

    setSaving(true);
    try {
      // Incluir cargos adicionales en el payload
      const payload = {
        ...formData,
        cargos_adicionales: cargosAdicionales,
      };
      const response = await api.put(`/api/credits/${credit.id}`, payload);
      setCredit(response.data);
      setFormData(response.data);
      setIsEditMode(false);

      if (isFormalizingCredit) {
        toast({
          title: "Crédito formalizado",
          description: "El plan de pagos se ha generado correctamente."
        });
      } else {
        toast({
          title: "Éxito",
          description: "Crédito actualizado correctamente"
        });
      }

      // Recargar el crédito para obtener el plan de pagos actualizado
      await fetchCredit();
    } catch (error: any) {
      console.error("Error saving credit:", error);
      const msg = error?.response?.data?.message || "No se pudo guardar los cambios";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(credit || {});
    // Resetear cargos adicionales al valor original
    if (credit?.cargos_adicionales) {
      setCargosAdicionales(credit.cargos_adicionales);
    } else {
      setCargosAdicionales({
        comision: 0,
        transporte: 0,
        respaldo_deudor: 0,
        descuento_factura: 0,
        cancelacion_manchas: 0,
      });
    }
    setIsEditMode(false);
  };

  // --- Render ---

  if (loading) {
    return <div className="flex h-full items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!credit) {
    return (
      <div className="text-center p-8">
        <p className="text-lg">Crédito no encontrado</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/creditos">Volver a Créditos</Link>
        </Button>
      </div>
    );
  }

  // Determinar si el crédito puede ser editado
  const estadosEditables = ['Aprobado', 'Por firmar'];
  const puedeEditar = credit.status && estadosEditables.includes(credit.status);
  const mensajeEdicion = !puedeEditar
    ? `No se puede editar un crédito en estado "${credit.status}". Solo se pueden editar créditos en estado "Aprobado" o "Por firmar".`
    : (credit?.formalized_at ? 'Algunos campos no podrán modificarse porque el crédito ya fue formalizado' : 'Editar crédito');

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/creditos">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver a Créditos</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">
            Detalle del Crédito: {credit.numero_operacion || credit.reference}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isEditMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditMode(true)}
                disabled={!puedeEditar}
                title={mensajeEdicion}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
              {credit.plan_de_pagos && credit.plan_de_pagos.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
                      const cleanBase = baseUrl.replace(/\/api\/?$/, '');
                      window.open(`${cleanBase}/api/credits/${id}/plan-pdf`, '_blank');
                    }}
                    className="bg-red-600 border-red-700 text-white hover:bg-red-700"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Plan PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
                      const cleanBase = baseUrl.replace(/\/api\/?$/, '');
                      window.open(`${cleanBase}/api/credits/${id}/plan-excel`, '_blank');
                    }}
                    className="bg-green-600 border-green-700 text-white hover:bg-green-700"
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Plan Excel
                  </Button>
                </>
              )}

              <Button
                className="h-9 rounded-md bg-blue-900 text-white hover:bg-blue-800 border-0 px-3"
                onClick={() => router.push(`/dashboard/creditos/${credit.id}/pagare`)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Exportar pagaré
              </Button>

              <Button
                className="h-9 rounded-md bg-green-900 text-white hover:bg-green-800 border-0 px-3"
                onClick={() => router.push(`/dashboard/creditos/${credit.id}/hoja-cierre`)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Hoja de Cierre
              </Button>

              {!['Formalizado', 'En Mora'].includes(credit.status || '') && (
                <Button
                  variant="outline"
                  className="border-green-500 text-green-500 hover:bg-green-50 hover:text-green-600"
                  onClick={handleFormalizar}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Formalizar
                </Button>
              )}

              {['Formalizado', 'En Mora'].includes(credit.status || '') && (credit.saldo ?? 0) > 0 && !credit.refundicion_child_id && (
                <Button
                  variant="outline"
                  className="border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                  onClick={() => setRefundicionOpen(true)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refundir
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Banners de refundición */}
      {credit.cierre_motivo === 'Refundición' && credit.refundicion_child && (
        <div className="flex items-center gap-3 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm">
          <RefreshCw className="h-4 w-4 text-orange-600 flex-shrink-0" />
          <span>
            Este crédito fue <strong>refundido</strong>. Nuevo crédito:{' '}
            <Link href={`/dashboard/creditos/${credit.refundicion_child.id}`} className="font-medium text-orange-700 underline hover:text-orange-800">
              {credit.refundicion_child.reference}
            </Link>
            {credit.refundicion_saldo_absorbido != null && (
              <> — Saldo absorbido: <strong>₡{formatNumber(credit.refundicion_saldo_absorbido)}</strong></>
            )}
          </span>
        </div>
      )}

      {credit.refundicion_parent && (
        <div className="flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
          <RefreshCw className="h-4 w-4 text-blue-600 flex-shrink-0" />
          <span>
            Proviene de <strong>refundición</strong>. Crédito original:{' '}
            <Link href={`/dashboard/creditos/${credit.refundicion_parent.id}`} className="font-medium text-blue-700 underline hover:text-blue-800">
              {credit.refundicion_parent.reference}
            </Link>
            {credit.refundicion_saldo_absorbido != null && (
              <> — Saldo absorbido: <strong>₡{formatNumber(credit.refundicion_saldo_absorbido)}</strong></>
            )}
            {credit.refundicion_monto_entregado != null && (
              <> — Entregado al cliente: <strong>₡{formatNumber(credit.refundicion_monto_entregado)}</strong></>
            )}
          </span>
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="credito">Crédito</TabsTrigger>
              <TabsTrigger value="plan-pagos">Plan de Pagos</TabsTrigger>
            </TabsList>

            <TabsContent value="credito">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <div className={isPanelVisible ? 'space-y-6 lg:col-span-3' : 'space-y-6 lg:col-span-5'}>
                  {/* Main Info Card */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>
                            <Link href={`/dashboard/clientes/${credit.lead_id}`} className="hover:underline">
                              {credit.lead?.name || "Cliente Desconocido"}
                            </Link>
                          </CardTitle>
                          <CardDescription>
                            Institución: {credit.lead?.institucion_labora || "-"}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={credit.status === 'Por firmar' ? 'default' : 'secondary'}>
                            {credit.status}
                          </Badge>
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
                    </CardHeader>
                    <CardContent className="space-y-8">
                      {/* Basic Information */}
                      <div>
                        <h3 className="text-lg font-medium mb-4">Información Básica</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Número de Operación</Label>
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.numero_operacion || credit.reference || "-"}
                              </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo de credito</Label>
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.category || "-"}
                              </p>
                          </div>
                        </div>
                      </div>

                      {/* Financial Details */}
                      <div>
                        <h3 className="text-lg font-medium mb-4">Detalles Financieros</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Monto Otorgado</Label>
                              <p className="text-sm font-semibold text-primary bg-muted px-3 py-2 rounded-md">
                                ₡{formatCurrency(credit.monto_credito)}
                              </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Saldo Actual</Label>
                              {(() => {
                                const interesesVencidos = (credit.plan_de_pagos || [])
                                  .filter(p => p.estado === 'Mora')
                                  .reduce((sum, p) => sum + (Number(p.int_corriente_vencido) || 0), 0);
                                const saldoTotal = (Number(credit.saldo) || 0) + interesesVencidos;
                                return (
                                  <div>
                                    <p className="text-sm font-semibold text-primary bg-muted px-3 py-2 rounded-md">
                                      ₡{formatCurrency(saldoTotal)}
                                    </p>
                                    {interesesVencidos > 0 && (
                                      <p className="text-xs text-destructive mt-1">
                                        Incluye ₡{formatCurrency(interesesVencidos)} en intereses vencidos
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}
                          </div>
                          <div className="space-y-2">
                            <Label>Monto de Desembolso</Label>
                              <p className="text-sm font-semibold text-green-600 bg-green-50 px-3 py-2 rounded-md">
                                ₡{formatCurrency((credit.monto_credito || 0) - getTotalCargos())}
                              </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Cuota Mensual</Label>
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                ₡{formatCurrency(credit.cuota)}
                              </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Tasa Anual</Label>
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.tasa_anual ? `${credit.tasa_anual}%` : "-"}
                              </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Divisa</Label>
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.divisa || "CRC"}
                              </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Entidad Deductora</Label>
                            <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                              {(() => {
                                // Use credit's deductora_id, fallback to lead's deductora_id
                                const idDeductora = credit.deductora_id || credit.lead?.deductora_id;
                                if (!idDeductora) return "Sin asignar";
                                const encontrada = deductoras.find(d => String(d.id) === String(idDeductora));
                                return encontrada ? encontrada.nombre : idDeductora;
                              })()}
                            </p>
                          </div>
                        </div>

                        {/* Cargos Adicionales - Subsección */}
                        <div className="mt-6 pt-6 border-t">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">Deducciones</h4>
                              <p className="text-xs text-muted-foreground">Estos montos se restan del monto otorgado</p>
                            </div>
                            <div className="flex items-center gap-4">
                              {isEditMode && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={aplicarCargosDefecto}
                                  className="text-xs"
                                >
                                  Aplicar valores por defecto
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mb-4">
                            {(Object.entries(CARGOS_CONFIG) as [TipoCargoAdicional, typeof CARGOS_CONFIG[TipoCargoAdicional]][]).map(([key, config]) => {
                              const esRegular = (formData.category || credit?.category) === 'Regular';
                              const deshabilitado = config.soloRegular && !esRegular;
                              const monto = formData.monto_credito || credit?.monto_credito || 0;

                              // Calcular placeholder según configuración
                              const getPlaceholder = () => {
                                if (config.porcentaje) {
                                  return `Sugerido: ${formatCurrency(monto * config.porcentaje)}`;
                                }
                                if (config.fijo) {
                                  return formatCurrency(config.fijo);
                                }
                                return '0.00';
                              };

                              return (
                                <div key={key} className="space-y-1">
                                  <Label className={`text-xs ${deshabilitado ? 'text-muted-foreground/50' : ''}`} title={config.descripcion}>
                                    {config.label}
                                    {config.soloRegular && !esRegular && (
                                      <span className="ml-1 text-[10px] text-orange-500">(solo Regular)</span>
                                    )}
                                  </Label>
                                  {isEditMode ? (
                                    <Input
                                      type="text"
                                      value={editingCargo === key
                                        ? String(cargosAdicionales[key] || '')
                                        : (cargosAdicionales[key] ? formatCurrency(cargosAdicionales[key]) : "")}
                                      onChange={(e) => {
                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                        handleCargoChange(key, Number(raw) || 0);
                                      }}
                                      onFocus={() => setEditingCargo(key)}
                                      onBlur={() => setEditingCargo(null)}
                                      placeholder={getPlaceholder()}
                                      className={`h-9 ${deshabilitado ? 'opacity-50' : ''}`}
                                      disabled={deshabilitado}
                                      title={config.descripcion}
                                    />
                                  ) : (
                                    <p className={`text-sm bg-muted px-3 py-2 rounded-md ${deshabilitado ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                      ₡{formatCurrency(cargosAdicionales[key])}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {/* Resumen de deducciones */}
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="space-y-1">
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-muted-foreground">Total deducciones:</span>
                                <span className="font-medium text-destructive">-₡{formatCurrency(getTotalCargos())}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-muted-foreground block">Monto de desembolso</span>
                              <span className="text-lg font-bold text-primary">₡{formatCurrency(getMontoNeto())}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Dates and Terms */}
                      <div>
                        <h3 className="text-lg font-medium mb-4">Fechas y Plazos</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Fecha de Apertura</Label>
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {(() => {
                                  const f = formData.plan_de_pagos?.find(p => p.numero_cuota === 0)?.fecha_inicio;
                                  if (f) {
                                    return f instanceof Date ? f.toISOString().split('T')[0] : String(f).split('T')[0];
                                  }
                                  if (credit.opened_at) {
                                    try {
                                      return new Date(credit.opened_at).toISOString().split('T')[0];
                                    } catch {
                                      return "-";
                                    }
                                  }
                                  return "-";
                                })()}
                              </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Fecha de Culminación</Label>
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {formatDate(credit.fecha_culminacion_credito)}
                              </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Último Pago</Label>
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {formatDate(formData.fecha_ultimo_pago)}
                              </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Primera Deducción</Label>
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {formatDate(formData.primera_deduccion)}
                              </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Plazo</Label>
                            {isEditMode ? (
                              <Input
                                type="number"
                                value={formData.plazo || ""}
                                onChange={(e) => handleInputChange("plazo", parseInt(e.target.value) || 0)}
                                placeholder="Plazo en meses"
                                disabled={!!credit.formalized_at}
                                title={credit.formalized_at ? 'No se puede modificar en crédito formalizado' : ''}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.plazo ? `${credit.plazo} meses` : "-"}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Cuotas Atrasadas</Label>
                              <p className="text-sm font-semibold text-destructive bg-muted px-3 py-2 rounded-md">
                                {credit.cuotas_atrasadas || 0}
                              </p>
                          </div>
                        </div>
                      </div>

                      {/* Additional Information */}
                      <div>
                        <h3 className="text-lg font-medium mb-4">Información Adicional</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Estado</Label>
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.status || "-"}
                              </p>
                          </div>
                          <div className="space-y-2">
                            <Label>¿Tiene póliza?</Label>
                            {isEditMode ? (
                              <div className="flex items-center space-x-2 pt-2">
                                <Switch
                                  id="poliza-switch"
                                  checked={!!formData.poliza}
                                  onCheckedChange={(checked) => handleInputChange("poliza", checked)}
                                />
                                <Label htmlFor="poliza-switch" className="font-normal cursor-pointer">
                                  {formData.poliza ? "Sí" : "No"}
                                </Label>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.poliza ? "Sí" : "No"}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Responsable</Label>
                            {isEditMode ? (
                              <Select
                                value={String(formData.assigned_to ?? "")}
                                onValueChange={value => handleInputChange('assigned_to', parseInt(value)) }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar responsable" />
                                </SelectTrigger>
                                <SelectContent>
                                  {users.map(user => (
                                    <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {(() => {
                                  console.log('[DEBUG DISPLAY] ==================================');
                                  console.log('[DEBUG DISPLAY] formData.assignedTo:', formData.assignedTo);
                                  console.log('[DEBUG DISPLAY] formData.assigned_to:', formData.assigned_to);
                                  console.log('[DEBUG DISPLAY] creditTasks:', creditTasks);
                                  console.log('[DEBUG DISPLAY] creditTasks.length:', creditTasks.length);

                                  // Primero intentar mostrar el responsable del crédito
                                  if (formData.assignedTo?.name) {
                                    console.log('[DEBUG DISPLAY] Mostrando responsable del crédito:', formData.assignedTo.name);
                                    return formData.assignedTo.name;
                                  }

                                  // Si no hay, buscar en las tareas asociadas al crédito
                                  const taskWithAssignee = creditTasks.find(task => task.assignee?.name);
                                  console.log('[DEBUG DISPLAY] Tarea con assignee encontrada:', taskWithAssignee);

                                  if (taskWithAssignee?.assignee?.name) {
                                    console.log('[DEBUG DISPLAY] Mostrando responsable de tarea:', taskWithAssignee.assignee.name);
                                    return taskWithAssignee.assignee.name;
                                  }

                                  console.log('[DEBUG DISPLAY] No se encontró responsable, mostrando "-"');
                                  console.log('[DEBUG DISPLAY] ==================================');
                                  return "-";
                                })()}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Garantía</Label>
                            {isEditMode ? (
                              <Input
                                value={formData.garantia || ""}
                                onChange={(e) => handleInputChange("garantia", e.target.value)}
                                placeholder="Garantía"
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.garantia || "-"}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Descripción</Label>
                            {isEditMode ? (
                              <Textarea
                                value={formData.description || ""}
                                onChange={(e) => handleInputChange("description", e.target.value)}
                                placeholder="Descripción del crédito"
                                rows={3}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md min-h-[60px]">
                                {credit.description || "-"}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Documents Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Paperclip className="h-5 w-5" />
                        Archivos del Crédito
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CreditDocumentManager
                        creditId={credit.id}
                        initialDocuments={credit.documents?.map(doc => ({
                          id: doc.id,
                          name: doc.name,
                          notes: doc.notes || undefined,
                          path: doc.path || '',
                          url: doc.url || '',
                          mime_type: doc.mime_type || '',
                          size: doc.size || 0,
                          created_at: doc.created_at
                        })) || []}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Right Panel inside Credito Tab */}
                {isPanelVisible && (
                  <div className="space-y-6 lg:col-span-2">
                    <Card className="h-[calc(100vh-12rem)]">
                      <Tabs defaultValue="comunicaciones" className="flex h-full flex-col">
                        <TabsList className="m-2">
                          <TabsTrigger value="comunicaciones" className="gap-1">
                            <MessageSquare className="h-4 w-4" />
                            Comunicaciones
                          </TabsTrigger>
                          <TabsTrigger value="tareas" className="gap-1">
                            <ClipboardCheck className="h-4 w-4" />
                            Tareas
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent
                          value="comunicaciones"
                          className="flex-1 overflow-y-auto"
                        >
                          <CaseChat conversationId={credit.reference} />
                        </TabsContent>
                        <TabsContent value="tareas" className="flex-1 overflow-y-auto p-4">
                          <TareasTab opportunityReference={String(credit.id)} opportunityId={credit.id} />
                        </TabsContent>
                      </Tabs>
                    </Card>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="plan-pagos">
              {/* Plan de Pagos Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle>Plan de Pagos</CardTitle>
                    <CardDescription>Detalle de cuotas y movimientos históricos</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {credit.status === 'Formalizado' && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={credit.plan_de_pagos?.some(p => p.estado === 'Pagado')}
                                onClick={async () => {
                                  if (!confirm('¿Estás seguro de que deseas regenerar el plan de pagos? Esto eliminará las cuotas pendientes y creará un nuevo plan.')) return;
                                  try {
                                    setLoading(true);
                                    await api.post(`/api/credits/${id}/generate-plan-de-pagos`);
                                    toast({
                                      title: 'Plan de pagos regenerado',
                                      description: 'El plan de pagos se ha regenerado correctamente.',
                                    });
                                    await fetchCredit();
                                  } catch (error) {
                                    console.error('Error regenerando plan de pagos:', error);
                                    toast({
                                      title: 'Error',
                                      description: 'No se pudo regenerar el plan de pagos.',
                                      variant: 'destructive',
                                    });
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                              >
                                Regenerar Plan
                              </Button>
                            </div>
                          </TooltipTrigger>
                          {credit.plan_de_pagos?.some(p => p.estado === 'Pagado') && (
                            <TooltipContent>
                              <p>No se puede regenerar el plan porque existen cuotas pagadas.</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollableTableContainer className="max-h-[70vh]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="whitespace-nowrap text-xs">No. Cuota</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Proceso</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Fecha Inicio</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Fecha Corte</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Fecha Pago</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Tasa Actual</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Plazo Actual</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Cuota</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Póliza</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Int. Corriente</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Int. Corr. Vencido</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Int. Moratorio</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Amortización</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Capital</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Saldo por Pagar</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Días</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Estado</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Mora (Días)</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Fecha Mov.</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Mov. Total</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Mov. Póliza</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Mov. Int. Corr.</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Mov. Int. C. Venc.</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Mov. Int. Mora.</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Mov. Amortización</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Mov. Principal</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Mov. Caja/Usuario</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Tipo Doc.</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">No. Doc.</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Concepto</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-center">Recibo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {credit.plan_de_pagos && credit.plan_de_pagos.length > 0 ? (
                        credit.plan_de_pagos.map((payment) => (
                          <TableRow key={payment.id} className="hover:bg-muted/50">
                            <TableCell className="text-xs text-center">{payment.numero_cuota}</TableCell>
                            <TableCell className="text-xs">{payment.proceso || "-"}</TableCell>
                            <TableCell className="text-xs">{formatDate(payment.fecha_inicio ? new Date(payment.fecha_inicio).toISOString() : null)}</TableCell>
                            <TableCell className="text-xs">{formatDate(payment.fecha_corte)}</TableCell>
                            <TableCell className="text-xs">{formatDate(payment.fecha_pago)}</TableCell>
                            <TableCell className="text-xs text-center">{payment.tasa_actual || "-"}</TableCell>
                            <TableCell className="text-xs text-center">{payment.plazo_actual || "-"}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.cuota)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.poliza)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.interes_corriente)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.int_corriente_vencido ?? 0)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.interes_moratorio)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.amortizacion)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.saldo_anterior)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.saldo_nuevo)}</TableCell>
                            <TableCell className="text-xs text-center">{payment.dias || "-"}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className={`text-[10px] h-5 ${
                                payment.estado === 'Pagado' ? 'bg-green-50 text-green-700 border-green-200' :
                                payment.estado === 'Mora' ? 'bg-red-50 text-red-700 border-red-200' :
                                payment.estado === 'Parcial' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                'bg-gray-50 text-gray-700 border-gray-200'
                              }`}>
                                {payment.estado}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-center">{payment.dias_mora || "0"}</TableCell>
                            <TableCell className="text-xs">{formatDate(payment.fecha_movimiento)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.movimiento_total)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.movimiento_poliza)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.movimiento_interes_corriente)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.movimiento_int_corriente_vencido ?? 0)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.movimiento_interes_moratorio)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.movimiento_amortizacion)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.movimiento_principal)}</TableCell>
                            
                            <TableCell className="text-xs">{payment.movimiento_caja_usuario || "-"}</TableCell>
                            <TableCell className="text-xs">{payment.tipo_documento || "-"}</TableCell>
                            <TableCell className="text-xs">{payment.numero_documento || "-"}</TableCell>
                            <TableCell className="text-xs">{payment.concepto || "-"}</TableCell>
                            <TableCell className="text-xs text-center">
                              {payment.concepto && payment.concepto.startsWith('Pago') && (() => {
                                const matchingPayment = credit.payments?.find(
                                  (p: any) => p.numero_cuota === payment.numero_cuota
                                );
                                return matchingPayment ? (
                                  <Link href={`/dashboard/cobros/recibo/${matchingPayment.id}`}>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <Receipt className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                ) : null;
                              })()}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={33} className="text-center py-12">
                            <div className="flex flex-col items-center gap-4">
                              <div className="text-muted-foreground">
                                {credit.status !== 'Formalizado' ? (
                                  <>
                                    <p className="font-medium mb-2">El plan de pagos se generará al formalizar el crédito</p>
                                    <p className="text-sm">Cambia el estado a "Formalizado" para generar el plan automáticamente.</p>
                                  </>
                                ) : (
                                  <>
                                    <p className="font-medium mb-2">No hay plan de pagos generado</p>
                                    <p className="text-sm mb-4">Haz clic en el botón para generar el plan de pagos.</p>
                                    <Button
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          setLoading(true);
                                          await api.post(`/api/credits/${id}/generate-plan-de-pagos`);
                                          toast({
                                            title: 'Plan de pagos generado',
                                            description: 'El plan de pagos se ha generado correctamente.',
                                          });
                                          await fetchCredit();
                                        } catch (error: any) {
                                          console.error('Error generando plan de pagos:', error);
                                          toast({
                                            title: 'Error',
                                            description: error?.response?.data?.message || 'No se pudo generar el plan de pagos.',
                                            variant: 'destructive',
                                          });
                                        } finally {
                                          setLoading(false);
                                        }
                                      }}
                                    >
                                      Generar Plan de Pagos
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  </ScrollableTableContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modal de Refundición */}
      {credit && (
        <RefundicionModal
          open={refundicionOpen}
          onOpenChange={setRefundicionOpen}
          credit={{
            id: credit.id,
            reference: credit.reference,
            monto_credito: credit.monto_credito ?? 0,
            saldo: credit.saldo ?? 0,
            cuota: credit.cuota ?? 0,
            plazo: credit.plazo ?? 0,
            tasa_anual: credit.tasa_anual ?? 0,
            status: credit.status || '',
            tipo_credito: credit.tipo_credito ?? undefined,
            category: credit.category ?? undefined,
            lead_id: credit.lead_id,
            opportunity_id: credit.opportunity_id ?? undefined,
            deductora_id: credit.deductora?.id,
            poliza: credit.poliza ?? undefined,
            lead: credit.lead ? { id: credit.lead.id, name: credit.lead.name, cedula: credit.lead.cedula?.toString() } : undefined,
          }}
          onSuccess={fetchCredit}
        />
      )}

      {/* Modal de Formalización */}
      <Dialog open={formalizarDialogOpen} onOpenChange={setFormalizarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Formalizar Crédito</DialogTitle>
            <DialogDescription>
              Seleccione la fecha de formalización del crédito {credit?.numero_operacion}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="formalizacion-date">Fecha de Formalización</Label>
              <DatePicker
                value={formalizacionDate}
                onChange={(date) => setFormalizacionDate(date || new Date())}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormalizarDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmFormalizar}>
              Formalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CreditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <CreditDetailClient id={id} />
}