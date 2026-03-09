"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  PlusCircle,
  MapPin,
  PackageCheck,
  Calendar as CalendarIcon,
  Truck,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Clock,
  Filter,
  Play,
  RotateCcw,
  Navigation,
  Phone,
  Building2,
  GripVertical,
} from "lucide-react";
import { ProtectedPage } from "@/components/ProtectedPage";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/axios";

// --- Types ---

type TareaTipo = "entrega" | "recoleccion" | "tramite" | "deposito" | "otro";
type TareaPrioridad = "normal" | "urgente" | "critica";
type TareaStatus = "pendiente" | "asignada" | "en_transito" | "completada" | "fallida" | "cancelada";
type RutaStatus = "borrador" | "confirmada" | "en_progreso" | "completada";

interface TareaRuta {
  id: number;
  titulo: string;
  descripcion: string | null;
  tipo: TareaTipo;
  prioridad: TareaPrioridad;
  status: TareaStatus;
  solicitado_por: number;
  solicitante?: { id: number; name: string } | null;
  asignado_a: number | null;
  asignado?: { id: number; name: string } | null;
  ruta_diaria_id: number | null;
  ruta_diaria?: { id: number; fecha: string; status: RutaStatus } | null;
  empresa_destino: string | null;
  direccion_destino: string | null;
  provincia: string | null;
  canton: string | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  fecha_limite: string | null;
  fecha_asignada: string | null;
  posicion: number | null;
  prioridad_override: boolean;
  prioridad_por: number | null;
  completada_at: string | null;
  notas_completado: string | null;
  motivo_fallo: string | null;
  referencia_tipo: string | null;
  referencia_id: number | null;
  created_at: string;
}

interface RutaDiaria {
  id: number;
  fecha: string;
  mensajero_id: number;
  mensajero?: { id: number; name: string } | null;
  status: RutaStatus;
  total_tareas: number;
  completadas: number;
  notas: string | null;
  confirmada_por: number | null;
  confirmada_por_rel?: { id: number; name: string } | null;
  confirmada_at: string | null;
  tareas?: TareaRuta[];
  tareas_count?: number;
  completadas_count?: number;
}

interface UserOption {
  id: number;
  name: string;
  email: string;
}

// --- Helpers ---

const tipoLabels: Record<TareaTipo, string> = {
  entrega: "Entrega",
  recoleccion: "Recolección",
  tramite: "Trámite",
  deposito: "Depósito",
  otro: "Otro",
};

const tipoIcons: Record<TareaTipo, React.ReactNode> = {
  entrega: <PackageCheck className="h-4 w-4" />,
  recoleccion: <RotateCcw className="h-4 w-4" />,
  tramite: <Building2 className="h-4 w-4" />,
  deposito: <MapPin className="h-4 w-4" />,
  otro: <Clock className="h-4 w-4" />,
};

const prioridadColors: Record<TareaPrioridad, string> = {
  normal: "bg-slate-100 text-slate-700",
  urgente: "bg-amber-100 text-amber-800",
  critica: "bg-red-100 text-red-800",
};

const statusColors: Record<TareaStatus, string> = {
  pendiente: "bg-slate-100 text-slate-700",
  asignada: "bg-blue-100 text-blue-800",
  en_transito: "bg-purple-100 text-purple-800",
  completada: "bg-green-100 text-green-800",
  fallida: "bg-red-100 text-red-800",
  cancelada: "bg-gray-100 text-gray-500",
};

const rutaStatusColors: Record<RutaStatus, string> = {
  borrador: "bg-slate-100 text-slate-700",
  confirmada: "bg-blue-100 text-blue-800",
  en_progreso: "bg-purple-100 text-purple-800",
  completada: "bg-green-100 text-green-800",
};

// ==============================
// MAIN PAGE
// ==============================

export default function RutasPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pendientes");
  const [users, setUsers] = useState<UserOption[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get("/api/agents");
      setUsers(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  return (
    <ProtectedPage module="rutas">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rutas</h1>
            <p className="text-muted-foreground">Gestión de tareas logísticas y rutas de mensajería</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pendientes">
              <PackageCheck className="h-4 w-4 mr-1" />
              Tareas Pendientes
            </TabsTrigger>
            <TabsTrigger value="generar">
              <PlusCircle className="h-4 w-4 mr-1" />
              Generar Ruta
            </TabsTrigger>
            <TabsTrigger value="activas">
              <Truck className="h-4 w-4 mr-1" />
              Rutas Activas
            </TabsTrigger>
            <TabsTrigger value="historial">
              <CalendarIcon className="h-4 w-4 mr-1" />
              Historial
            </TabsTrigger>
            <TabsTrigger value="mi-ruta">
              <Navigation className="h-4 w-4 mr-1" />
              Mi Ruta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendientes">
            <TareasPendientesTab users={users} toast={toast} />
          </TabsContent>
          <TabsContent value="generar">
            <GenerarRutaTab users={users} toast={toast} onGenerated={() => setActiveTab("activas")} />
          </TabsContent>
          <TabsContent value="activas">
            <RutasActivasTab toast={toast} />
          </TabsContent>
          <TabsContent value="historial">
            <HistorialTab />
          </TabsContent>
          <TabsContent value="mi-ruta">
            <MiRutaTab />
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedPage>
  );
}

// ==============================
// TAB 1: TAREAS PENDIENTES
// ==============================

function TareasPendientesTab({ users, toast }: { users: UserOption[]; toast: ReturnType<typeof useToast>["toast"] }) {
  const [tareas, setTareas] = useState<TareaRuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTarea, setEditingTarea] = useState<TareaRuta | null>(null);
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterPrioridad, setFilterPrioridad] = useState<string>("todos");
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    tipo: "entrega" as TareaTipo,
    prioridad: "normal" as TareaPrioridad,
    empresa_destino: "",
    direccion_destino: "",
    provincia: "",
    canton: "",
    contacto_nombre: "",
    contacto_telefono: "",
    fecha_limite: "",
  });

  const fetchTareas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/tareas-ruta", { params: { status: "pendiente" } });
      setTareas(res.data);
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar las tareas.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchTareas(); }, [fetchTareas]);

  const filteredTareas = tareas.filter((t) => {
    if (filterTipo !== "todos" && t.tipo !== filterTipo) return false;
    if (filterPrioridad !== "todos" && t.prioridad !== filterPrioridad) return false;
    return true;
  });

  const resetForm = () => {
    setForm({ titulo: "", descripcion: "", tipo: "entrega", prioridad: "normal", empresa_destino: "", direccion_destino: "", provincia: "", canton: "", contacto_nombre: "", contacto_telefono: "", fecha_limite: "" });
    setEditingTarea(null);
  };

  const openCreate = () => { resetForm(); setShowDialog(true); };

  const openEdit = (t: TareaRuta) => {
    setEditingTarea(t);
    setForm({
      titulo: t.titulo,
      descripcion: t.descripcion || "",
      tipo: t.tipo,
      prioridad: t.prioridad,
      empresa_destino: t.empresa_destino || "",
      direccion_destino: t.direccion_destino || "",
      provincia: t.provincia || "",
      canton: t.canton || "",
      contacto_nombre: t.contacto_nombre || "",
      contacto_telefono: t.contacto_telefono || "",
      fecha_limite: t.fecha_limite || "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) {
      toast({ title: "Error", description: "El título es requerido.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, fecha_limite: form.fecha_limite || null, descripcion: form.descripcion || null };
      if (editingTarea) {
        await api.put(`/api/tareas-ruta/${editingTarea.id}`, payload);
        toast({ title: "Tarea actualizada" });
      } else {
        await api.post("/api/tareas-ruta", payload);
        toast({ title: "Tarea creada" });
      }
      setShowDialog(false);
      resetForm();
      fetchTareas();
    } catch {
      toast({ title: "Error", description: "No se pudo guardar la tarea.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/tareas-ruta/${id}`);
      toast({ title: "Tarea eliminada" });
      fetchTareas();
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Tareas Pendientes
          </CardTitle>
          <CardDescription>
            Tareas ordenadas por prioridad (FIFO). {filteredTareas.length} tarea{filteredTareas.length !== 1 ? "s" : ""}.
          </CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusCircle className="h-4 w-4 mr-1" />
          Nueva Tarea
        </Button>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[150px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                {Object.entries(tipoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Select value={filterPrioridad} onValueChange={setFilterPrioridad}>
            <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Toda prioridad</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
              <SelectItem value="critica">Crítica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filteredTareas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No hay tareas pendientes.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Tarea</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Fecha Límite</TableHead>
                <TableHead>Solicitado por</TableHead>
                <TableHead className="w-[100px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTareas.map((t, i) => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{t.titulo}</div>
                    {t.descripcion && <div className="text-xs text-muted-foreground line-clamp-1">{t.descripcion}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {tipoIcons[t.tipo]}
                      <span className="text-sm">{tipoLabels[t.tipo]}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={prioridadColors[t.prioridad]}>
                      {t.prioridad_override && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {t.prioridad}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{t.empresa_destino || "-"}</div>
                    {t.canton && <div className="text-xs text-muted-foreground">{t.canton}, {t.provincia}</div>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.fecha_limite ? new Date(t.fecha_limite + "T12:00:00").toLocaleDateString("es-CR") : "-"}
                  </TableCell>
                  <TableCell className="text-sm">{t.solicitante?.name || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}>
                        <XCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTarea ? "Editar Tarea" : "Nueva Tarea de Ruta"}</DialogTitle>
            <DialogDescription>
              {editingTarea ? "Modifica los datos de la tarea." : "Crea una nueva tarea para asignar a una ruta."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: Entregar cheque a CCSS" />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TareaTipo })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(tipoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={form.prioridad} onValueChange={(v) => setForm({ ...form, prioridad: v as TareaPrioridad })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Empresa / Institución destino</Label>
              <Input value={form.empresa_destino} onChange={(e) => setForm({ ...form, empresa_destino: e.target.value })} placeholder="Ej: CCSS San José" />
            </div>
            <div>
              <Label>Dirección destino</Label>
              <Input value={form.direccion_destino} onChange={(e) => setForm({ ...form, direccion_destino: e.target.value })} placeholder="Ej: Av 2, Calle 5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Provincia</Label>
                <Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} />
              </div>
              <div>
                <Label>Cantón</Label>
                <Input value={form.canton} onChange={(e) => setForm({ ...form, canton: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contacto</Label>
                <Input value={form.contacto_nombre} onChange={(e) => setForm({ ...form, contacto_nombre: e.target.value })} placeholder="Nombre" />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={form.contacto_telefono} onChange={(e) => setForm({ ...form, contacto_telefono: e.target.value })} placeholder="8888-8888" />
              </div>
            </div>
            <div>
              <Label>Fecha límite</Label>
              <Input type="date" value={form.fecha_limite} onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingTarea ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ==============================
// TAB 2: GENERAR RUTA
// ==============================

function GenerarRutaTab({ users, toast, onGenerated }: { users: UserOption[]; toast: ReturnType<typeof useToast>["toast"]; onGenerated: () => void }) {
  const [tareasPendientes, setTareasPendientes] = useState<TareaRuta[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [mensajeroId, setMensajeroId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchPendientes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/tareas-ruta", { params: { status: "pendiente" } });
      setTareasPendientes(res.data);
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar las tareas.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchPendientes(); }, [fetchPendientes]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === tareasPendientes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tareasPendientes.map((t) => t.id)));
    }
  };

  const moveUp = (id: number) => {
    const ids = Array.from(selectedIds);
    const idx = ids.indexOf(id);
    if (idx > 0) {
      [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
      setSelectedIds(new Set(ids));
    }
  };

  const moveDown = (id: number) => {
    const ids = Array.from(selectedIds);
    const idx = ids.indexOf(id);
    if (idx < ids.length - 1) {
      [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
      setSelectedIds(new Set(ids));
    }
  };

  const handleGenerar = async () => {
    if (!mensajeroId) {
      toast({ title: "Error", description: "Selecciona un mensajero.", variant: "destructive" });
      return;
    }
    if (selectedIds.size === 0) {
      toast({ title: "Error", description: "Selecciona al menos una tarea.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      await api.post("/api/rutas-diarias/generar", {
        fecha,
        mensajero_id: parseInt(mensajeroId),
        tarea_ids: Array.from(selectedIds),
      });
      toast({ title: "Ruta generada", description: `Ruta con ${selectedIds.size} tareas creada para ${fecha}.` });
      setSelectedIds(new Set());
      fetchPendientes();
      onGenerated();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Error al generar ruta.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const selectedTareas = tareasPendientes.filter((t) => selectedIds.has(t.id));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Left: Available tasks */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Tareas Disponibles
          </CardTitle>
          <CardDescription>Selecciona las tareas para incluir en la ruta. Orden FIFO por prioridad.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : tareasPendientes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No hay tareas pendientes para asignar.</div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  checked={selectedIds.size === tareasPendientes.length && tareasPendientes.length > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm text-muted-foreground">Seleccionar todas ({tareasPendientes.length})</span>
              </div>
              {tareasPendientes.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${selectedIds.has(t.id) ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800" : "hover:bg-muted/50"}`}
                  onClick={() => toggleSelect(t.id)}
                >
                  <Checkbox checked={selectedIds.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {tipoIcons[t.tipo]}
                      <span className="font-medium text-sm truncate">{t.titulo}</span>
                      <Badge className={`${prioridadColors[t.prioridad]} text-xs`}>
                        {t.prioridad_override && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                        {t.prioridad}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {t.empresa_destino && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{t.empresa_destino}</span>}
                      {t.canton && <span>{t.canton}</span>}
                      {t.fecha_limite && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Límite: {new Date(t.fecha_limite + "T12:00:00").toLocaleDateString("es-CR")}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: Route config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Configurar Ruta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Fecha de ruta</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <Label>Mensajero</Label>
            <Select value={mensajeroId} onValueChange={setMensajeroId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar mensajero" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-2">Tareas seleccionadas ({selectedIds.size})</h4>
            {selectedTareas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Selecciona tareas de la lista.</p>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {selectedTareas.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded border text-sm">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground w-5">{i + 1}.</span>
                    <span className="flex-1 truncate">{t.titulo}</span>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); moveUp(t.id); }}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); moveDown(t.id); }}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button className="w-full" onClick={handleGenerar} disabled={generating || selectedIds.size === 0}>
            {generating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Generar Ruta ({selectedIds.size} tareas)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ==============================
// TAB 3: RUTAS ACTIVAS
// ==============================

function RutasActivasTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [rutas, setRutas] = useState<RutaDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRuta, setSelectedRuta] = useState<RutaDiaria | null>(null);
  const [showCompletarDialog, setShowCompletarDialog] = useState(false);
  const [showFallarDialog, setShowFallarDialog] = useState(false);
  const [selectedTarea, setSelectedTarea] = useState<TareaRuta | null>(null);
  const [notasCompletado, setNotasCompletado] = useState("");
  const [motivoFallo, setMotivoFallo] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRutas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/rutas-diarias", {
        params: { status: undefined }, // all non-completed
      });
      // Filter to non-completed
      const activas = (res.data as RutaDiaria[]).filter((r) => r.status !== "completada");
      setRutas(activas);
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar las rutas.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchRutas(); }, [fetchRutas]);

  const fetchRutaDetail = async (id: number) => {
    try {
      const res = await api.get(`/api/rutas-diarias/${id}`);
      setSelectedRuta(res.data);
    } catch {
      toast({ title: "Error", description: "No se pudo cargar la ruta.", variant: "destructive" });
    }
  };

  const handleConfirmar = async (id: number) => {
    try {
      await api.patch(`/api/rutas-diarias/${id}/confirmar`);
      toast({ title: "Ruta confirmada" });
      fetchRutas();
      if (selectedRuta?.id === id) fetchRutaDetail(id);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleIniciar = async (id: number) => {
    try {
      await api.patch(`/api/rutas-diarias/${id}/iniciar`);
      toast({ title: "Ruta iniciada" });
      fetchRutas();
      if (selectedRuta?.id === id) fetchRutaDetail(id);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleCompletarTarea = async () => {
    if (!selectedTarea) return;
    setActionLoading(true);
    try {
      await api.patch(`/api/tareas-ruta/${selectedTarea.id}/completar`, { notas_completado: notasCompletado || null });
      toast({ title: "Tarea completada" });
      setShowCompletarDialog(false);
      setNotasCompletado("");
      if (selectedRuta) fetchRutaDetail(selectedRuta.id);
      fetchRutas();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleFallarTarea = async () => {
    if (!selectedTarea || !motivoFallo.trim()) return;
    setActionLoading(true);
    try {
      await api.patch(`/api/tareas-ruta/${selectedTarea.id}/fallar`, { motivo_fallo: motivoFallo });
      toast({ title: "Tarea reportada como fallida", description: "Vuelve a tareas pendientes." });
      setShowFallarDialog(false);
      setMotivoFallo("");
      if (selectedRuta) fetchRutaDetail(selectedRuta.id);
      fetchRutas();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Left: Route list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Rutas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : rutas.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No hay rutas activas.</p>
          ) : (
            <div className="space-y-2">
              {rutas.map((r) => (
                <div
                  key={r.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedRuta?.id === r.id ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30" : "hover:bg-muted/50"}`}
                  onClick={() => fetchRutaDetail(r.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{new Date(r.fecha + "T12:00:00").toLocaleDateString("es-CR", { weekday: "short", day: "numeric", month: "short" })}</span>
                    <Badge className={rutaStatusColors[r.status]}>{r.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {r.mensajero?.name || "Sin asignar"} — {r.completadas_count ?? r.completadas}/{r.tareas_count ?? r.total_tareas} tareas
                  </div>
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${((r.completadas_count ?? r.completadas) / Math.max(r.tareas_count ?? r.total_tareas, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: Route detail */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Detalle de Ruta</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedRuta ? (
            <p className="text-center py-12 text-muted-foreground">Selecciona una ruta para ver sus tareas.</p>
          ) : (
            <div className="space-y-4">
              {/* Actions */}
              <div className="flex items-center gap-2">
                {selectedRuta.status === "borrador" && (
                  <Button size="sm" onClick={() => handleConfirmar(selectedRuta.id)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Confirmar Ruta
                  </Button>
                )}
                {selectedRuta.status === "confirmada" && (
                  <Button size="sm" onClick={() => handleIniciar(selectedRuta.id)}>
                    <Play className="h-4 w-4 mr-1" />
                    Iniciar Ruta
                  </Button>
                )}
                <div className="ml-auto text-sm text-muted-foreground">
                  {selectedRuta.tareas?.filter((t) => t.status === "completada").length || 0} / {selectedRuta.tareas?.length || 0} completadas
                </div>
              </div>

              {/* Tasks list */}
              <div className="space-y-2">
                {selectedRuta.tareas?.map((t) => (
                  <div key={t.id} className={`p-3 rounded-lg border ${t.status === "completada" ? "opacity-60 bg-green-50/50 dark:bg-green-950/10" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-bold shrink-0">
                        {t.posicion}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {tipoIcons[t.tipo]}
                          <span className="font-medium text-sm">{t.titulo}</span>
                          <Badge className={`${statusColors[t.status]} text-xs`}>{t.status}</Badge>
                        </div>
                        {t.empresa_destino && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            {t.empresa_destino}
                          </div>
                        )}
                        {t.direccion_destino && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.direccion_destino)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 mt-1 text-xs text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Navigation className="h-3 w-3" />
                            {t.direccion_destino}
                          </a>
                        )}
                        {t.contacto_nombre && (
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{t.contacto_nombre}</span>
                            {t.contacto_telefono && (
                              <a href={`tel:${t.contacto_telefono}`} className="flex items-center gap-1 text-blue-600">
                                <Phone className="h-3 w-3" />
                                {t.contacto_telefono}
                              </a>
                            )}
                          </div>
                        )}
                        {t.notas_completado && (
                          <div className="mt-1 text-xs text-green-700">Nota: {t.notas_completado}</div>
                        )}
                        {t.motivo_fallo && (
                          <div className="mt-1 text-xs text-red-600">Motivo fallo: {t.motivo_fallo}</div>
                        )}
                      </div>
                      {/* Action buttons for active tasks */}
                      {(t.status === "asignada" || t.status === "en_transito") && (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-green-700 border-green-300"
                            onClick={() => { setSelectedTarea(t); setShowCompletarDialog(true); }}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Completar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-red-600 border-red-300"
                            onClick={() => { setSelectedTarea(t); setShowFallarDialog(true); }}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Fallar
                          </Button>
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

      {/* Completar dialog */}
      <AlertDialog open={showCompletarDialog} onOpenChange={setShowCompletarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Completar tarea</AlertDialogTitle>
            <AlertDialogDescription>
              Marca &quot;{selectedTarea?.titulo}&quot; como completada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label>Notas (opcional)</Label>
            <Textarea value={notasCompletado} onChange={(e) => setNotasCompletado(e.target.value)} placeholder="Ej: Entregado en recepción a Juan" rows={2} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompletarTarea} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Completar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fallar dialog */}
      <AlertDialog open={showFallarDialog} onOpenChange={setShowFallarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reportar tarea fallida</AlertDialogTitle>
            <AlertDialogDescription>
              La tarea &quot;{selectedTarea?.titulo}&quot; volverá a pendientes para re-asignación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label>Motivo *</Label>
            <Textarea value={motivoFallo} onChange={(e) => setMotivoFallo(e.target.value)} placeholder="Ej: Oficina cerrada, no había personal" rows={2} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFallarTarea} disabled={actionLoading || !motivoFallo.trim()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {actionLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Reportar Fallo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==============================
// TAB 4: HISTORIAL
// ==============================

function HistorialTab() {
  const { toast } = useToast();
  const [rutas, setRutas] = useState<RutaDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRuta, setSelectedRuta] = useState<RutaDiaria | null>(null);

  const fetchHistorial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/rutas-diarias");
      setRutas(res.data);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchHistorial(); }, [fetchHistorial]);

  const fetchDetail = async (id: number) => {
    try {
      const res = await api.get(`/api/rutas-diarias/${id}`);
      setSelectedRuta(res.data);
    } catch { /* ignore */ }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Historial de Rutas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : rutas.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No hay rutas registradas.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {rutas.map((r) => (
                <div
                  key={r.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedRuta?.id === r.id ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30" : "hover:bg-muted/50"}`}
                  onClick={() => fetchDetail(r.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {new Date(r.fecha + "T12:00:00").toLocaleDateString("es-CR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <Badge className={rutaStatusColors[r.status]}>{r.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {r.mensajero?.name} — {r.completadas_count ?? r.completadas}/{r.tareas_count ?? r.total_tareas} tareas
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Detalle</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedRuta ? (
            <p className="text-center py-12 text-muted-foreground">Selecciona una ruta.</p>
          ) : (
            <div className="space-y-2">
              {selectedRuta.tareas?.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-bold shrink-0">
                    {t.posicion}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {tipoIcons[t.tipo]}
                      <span className="font-medium text-sm">{t.titulo}</span>
                    </div>
                    {t.empresa_destino && <div className="text-xs text-muted-foreground">{t.empresa_destino}</div>}
                  </div>
                  <Badge className={statusColors[t.status]}>{t.status}</Badge>
                  {t.completada_at && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(t.completada_at).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==============================
// TAB 5: MI RUTA (Vista Mensajero)
// ==============================

function MiRutaTab() {
  const { toast } = useToast();
  const [ruta, setRuta] = useState<RutaDiaria | null>(null);
  const [loading, setLoading] = useState(true);
  const [noHayRuta, setNoHayRuta] = useState(false);

  // Action states
  const [showCompletarDialog, setShowCompletarDialog] = useState(false);
  const [showFallarDialog, setShowFallarDialog] = useState(false);
  const [selectedTarea, setSelectedTarea] = useState<TareaRuta | null>(null);
  const [notasCompletado, setNotasCompletado] = useState("");
  const [motivoFallo, setMotivoFallo] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchMiRuta = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/rutas-diarias/mi-ruta");
      if (res.data.ruta === null) {
        setNoHayRuta(true);
        setRuta(null);
      } else {
        setRuta(res.data);
        setNoHayRuta(false);
      }
    } catch {
      toast({ title: "Error", description: "No se pudo cargar tu ruta.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchMiRuta(); }, [fetchMiRuta]);

  const handleIniciar = async () => {
    if (!ruta) return;
    try {
      await api.patch(`/api/rutas-diarias/${ruta.id}/iniciar`);
      toast({ title: "Ruta iniciada" });
      fetchMiRuta();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleCompletarTarea = async () => {
    if (!selectedTarea) return;
    setActionLoading(true);
    try {
      await api.patch(`/api/tareas-ruta/${selectedTarea.id}/completar`, { notas_completado: notasCompletado || null });
      toast({ title: "Tarea completada" });
      setShowCompletarDialog(false);
      setNotasCompletado("");
      fetchMiRuta();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleFallarTarea = async () => {
    if (!selectedTarea || !motivoFallo.trim()) return;
    setActionLoading(true);
    try {
      await api.patch(`/api/tareas-ruta/${selectedTarea.id}/fallar`, { motivo_fallo: motivoFallo });
      toast({ title: "Tarea reportada", description: "Vuelve a pendientes." });
      setShowFallarDialog(false);
      setMotivoFallo("");
      fetchMiRuta();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (noHayRuta || !ruta) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <Navigation className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Sin ruta para hoy</h3>
          <p className="text-muted-foreground mt-1">No tienes una ruta asignada para el día de hoy.</p>
        </CardContent>
      </Card>
    );
  }

  const tareas = ruta.tareas || [];
  const completadas = tareas.filter((t) => t.status === "completada").length;
  const total = tareas.length;
  const progreso = total > 0 ? Math.round((completadas / total) * 100) : 0;
  const todasResueltas = tareas.every((t) => t.status === "completada" || t.status === "fallida" || t.status === "cancelada");

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold">Mi Ruta de Hoy</h2>
              <p className="text-sm text-muted-foreground">
                {new Date(ruta.fecha + "T12:00:00").toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
            <Badge className={`${rutaStatusColors[ruta.status]} text-sm px-3 py-1`}>
              {ruta.status === "en_progreso" ? "En Progreso" : ruta.status}
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-medium">{completadas}/{total} completadas ({progreso}%)</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>

          {/* Start route button */}
          {ruta.status === "confirmada" && (
            <Button className="w-full mt-4" size="lg" onClick={handleIniciar}>
              <Play className="h-5 w-5 mr-2" />
              Iniciar Ruta
            </Button>
          )}

          {/* Route completed message */}
          {todasResueltas && ruta.status === "en_progreso" && (
            <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-center dark:bg-green-950/20 dark:border-green-800">
              <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
              <p className="font-medium text-green-800 dark:text-green-400">Ruta completada</p>
              <p className="text-xs text-green-600 dark:text-green-500">Todas las tareas han sido resueltas.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task cards */}
      <div className="space-y-3">
        {tareas.map((t) => {
          const isActive = t.status === "asignada" || t.status === "en_transito";
          const isDone = t.status === "completada";

          return (
            <Card key={t.id} className={isDone ? "opacity-60" : ""}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  {/* Position number */}
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-bold ${isDone ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                    {isDone ? <CheckCircle2 className="h-5 w-5" /> : t.posicion}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{t.titulo}</span>
                      <Badge className={`${prioridadColors[t.prioridad]} text-xs`}>
                        {t.prioridad_override && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                        {t.prioridad}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {tipoIcons[t.tipo]}
                        <span className="ml-1">{tipoLabels[t.tipo]}</span>
                      </Badge>
                    </div>

                    {t.descripcion && (
                      <p className="text-sm text-muted-foreground mt-1">{t.descripcion}</p>
                    )}

                    {/* Destination info */}
                    <div className="mt-2 space-y-1">
                      {t.empresa_destino && (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{t.empresa_destino}</span>
                        </div>
                      )}
                      {t.direccion_destino && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.direccion_destino)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                        >
                          <Navigation className="h-4 w-4 shrink-0" />
                          {t.direccion_destino}
                        </a>
                      )}
                      {t.contacto_nombre && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">{t.contacto_nombre}</span>
                          {t.contacto_telefono && (
                            <a href={`tel:${t.contacto_telefono}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                              <Phone className="h-3.5 w-3.5" />
                              {t.contacto_telefono}
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Completion notes */}
                    {t.notas_completado && (
                      <div className="mt-2 p-2 rounded bg-green-50 text-xs text-green-700 dark:bg-green-950/20 dark:text-green-400">
                        {t.notas_completado}
                      </div>
                    )}
                    {t.motivo_fallo && (
                      <div className="mt-2 p-2 rounded bg-red-50 text-xs text-red-700 dark:bg-red-950/20 dark:text-red-400">
                        Fallo: {t.motivo_fallo}
                      </div>
                    )}

                    {/* Action buttons */}
                    {isActive && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => { setSelectedTarea(t); setNotasCompletado(""); setShowCompletarDialog(true); }}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Completar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => { setSelectedTarea(t); setMotivoFallo(""); setShowFallarDialog(true); }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          No Completada
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Completar dialog */}
      <AlertDialog open={showCompletarDialog} onOpenChange={setShowCompletarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Completar tarea</AlertDialogTitle>
            <AlertDialogDescription>
              Marca &quot;{selectedTarea?.titulo}&quot; como completada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label>Notas (opcional)</Label>
            <Textarea value={notasCompletado} onChange={(e) => setNotasCompletado(e.target.value)} placeholder="Ej: Entregado en recepción a Juan Pérez" rows={3} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompletarTarea} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Completar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fallar dialog */}
      <AlertDialog open={showFallarDialog} onOpenChange={setShowFallarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No se pudo completar</AlertDialogTitle>
            <AlertDialogDescription>
              La tarea volverá a pendientes para re-asignación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label>Motivo *</Label>
            <Textarea value={motivoFallo} onChange={(e) => setMotivoFallo(e.target.value)} placeholder="Ej: Oficina cerrada, no había personal autorizado" rows={3} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFallarTarea} disabled={actionLoading || !motivoFallo.trim()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {actionLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Reportar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
