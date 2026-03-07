'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  PlusCircle, Target, Building, DollarSign, Loader2, CalendarClock,
  ChevronLeft, ChevronRight, Check, X, Banknote, TrendingUp, Users,
  Pencil, Trash2,
} from 'lucide-react';
import { ProtectedPage } from "@/components/ProtectedPage";
import api from '@/lib/axios';
import { toastSuccess, toastError } from '@/hooks/use-toast';

// --- Types ---
interface MetaVenta {
  id: number;
  user_id: number;
  anio: number;
  mes: number;
  meta_creditos_monto: number;
  meta_creditos_cantidad: number;
  meta_inversiones_monto: number;
  meta_inversiones_cantidad: number;
  notas: string | null;
  activo: boolean;
  user?: { id: number; name: string };
  creditos_alcanzado_monto?: number;
  creditos_alcanzado_cantidad?: number;
  inversiones_alcanzado_monto?: number;
  inversiones_alcanzado_cantidad?: number;
}

interface Visita {
  id: number;
  user_id: number;
  institucion_id: number | null;
  institucion_nombre: string | null;
  fecha_planificada: string;
  fecha_realizada: string | null;
  status: 'Planificada' | 'Completada' | 'Cancelada' | 'Reprogramada';
  notas: string | null;
  resultado: string | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_email: string | null;
  user?: { id: number; name: string };
  institucion?: { id: number; nombre: string } | null;
}

interface Comision {
  id: number;
  user_id: number;
  tipo: 'credito' | 'inversion';
  monto_operacion: number;
  porcentaje: number;
  monto_comision: number;
  estado: 'Pendiente' | 'Aprobada' | 'Pagada';
  fecha_operacion: string;
  fecha_aprobacion: string | null;
  fecha_pago: string | null;
  notas: string | null;
  user?: { id: number; name: string };
  aprobada_por?: { id: number; name: string } | null;
}

interface ReglaComision {
  id: number;
  nombre: string;
  tipo: 'credito' | 'inversion';
  monto_minimo: number;
  monto_maximo: number | null;
  porcentaje: number;
  activo: boolean;
}

interface Agent { id: number; name: string; }
interface Institucion { id: number; nombre: string; }

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(n);

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const getVisitaVariant = (status: Visita['status']) => {
  switch (status) {
    case 'Planificada': return 'secondary' as const;
    case 'Completada': return 'default' as const;
    case 'Cancelada': return 'destructive' as const;
    case 'Reprogramada': return 'outline' as const;
  }
};

// ============================================================
// RESUMEN TAB
// ============================================================
function ResumenSection({ metas, visitas, comisiones }: {
  metas: MetaVenta[];
  visitas: Visita[];
  comisiones: Comision[];
}) {
  const totalMetaCreditos = metas.reduce((s, m) => s + Number(m.meta_creditos_monto), 0);
  const totalAlcanzadoCreditos = metas.reduce((s, m) => s + (m.creditos_alcanzado_monto || 0), 0);
  const visitasPlanificadas = visitas.filter(v => v.status === 'Planificada').length;
  const visitasCompletadas = visitas.filter(v => v.status === 'Completada').length;
  const comisionesPendientes = comisiones.filter(c => c.estado === 'Pendiente');
  const totalComisionesPendientes = comisionesPendientes.reduce((s, c) => s + Number(c.monto_comision), 0);

  const proximasVisitas = visitas
    .filter(v => v.status === 'Planificada' && new Date(v.fecha_planificada) >= new Date())
    .sort((a, b) => new Date(a.fecha_planificada).getTime() - new Date(b.fecha_planificada).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meta Créditos (Mes)</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(totalAlcanzadoCreditos)}</div>
            <p className="text-xs text-muted-foreground">de {fmt(totalMetaCreditos)} meta</p>
            {totalMetaCreditos > 0 && (
              <Progress value={(totalAlcanzadoCreditos / totalMetaCreditos) * 100} className="mt-2 h-1.5" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visitas del Mes</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{visitasCompletadas}/{visitasPlanificadas + visitasCompletadas}</div>
            <p className="text-xs text-muted-foreground">completadas / total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comisiones Pendientes</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(totalComisionesPendientes)}</div>
            <p className="text-xs text-muted-foreground">{comisionesPendientes.length} comisiones por aprobar</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendedores Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(metas.map(m => m.user_id)).size}</div>
            <p className="text-xs text-muted-foreground">con meta asignada</p>
          </CardContent>
        </Card>
      </div>

      {/* Metas progress + Próximas visitas */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progreso de Metas</CardTitle>
            <CardDescription>Avance de cada vendedor en créditos colocados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {metas.length === 0 && <p className="text-sm text-muted-foreground">No hay metas definidas para este período.</p>}
            {metas.map(meta => {
              const alcanzado = meta.creditos_alcanzado_monto || 0;
              const objetivo = Number(meta.meta_creditos_monto);
              const pct = objetivo > 0 ? (alcanzado / objetivo) * 100 : 0;
              return (
                <div key={meta.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{meta.user?.name?.charAt(0) ?? '?'}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{meta.user?.name}</span>
                    </div>
                    <span className="text-muted-foreground">{fmt(alcanzado)} / {fmt(objetivo)}</span>
                  </div>
                  <Progress value={Math.min(pct, 100)} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximas Visitas</CardTitle>
            <CardDescription>Visitas planificadas pendientes</CardDescription>
          </CardHeader>
          <CardContent>
            {proximasVisitas.length === 0 && <p className="text-sm text-muted-foreground">No hay visitas planificadas.</p>}
            <div className="space-y-3">
              {proximasVisitas.map(v => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium text-sm">{v.institucion?.nombre ?? v.institucion_nombre}</p>
                    <p className="text-xs text-muted-foreground">{v.user?.name} — {new Date(v.fecha_planificada).toLocaleDateString('es-CR')}</p>
                  </div>
                  <Badge variant="secondary">
                    <CalendarClock className="mr-1 h-3 w-3" />
                    {new Date(v.fecha_planificada).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// METAS TAB
// ============================================================
function MetasSection({ metas, agents, loading, onRefresh }: {
  metas: MetaVenta[];
  agents: Agent[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingMeta, setEditingMeta] = useState<MetaVenta | null>(null);
  const [form, setForm] = useState({
    user_id: '', anio: String(new Date().getFullYear()), mes: String(new Date().getMonth() + 1),
    meta_creditos_monto: '', meta_creditos_cantidad: '',
    meta_inversiones_monto: '', meta_inversiones_cantidad: '',
    notas: '',
  });

  const openNew = () => {
    setEditingMeta(null);
    setForm({
      user_id: '', anio: String(new Date().getFullYear()), mes: String(new Date().getMonth() + 1),
      meta_creditos_monto: '', meta_creditos_cantidad: '',
      meta_inversiones_monto: '', meta_inversiones_cantidad: '',
      notas: '',
    });
    setShowForm(true);
  };

  const openEdit = (meta: MetaVenta) => {
    setEditingMeta(meta);
    setForm({
      user_id: String(meta.user_id),
      anio: String(meta.anio),
      mes: String(meta.mes),
      meta_creditos_monto: String(meta.meta_creditos_monto),
      meta_creditos_cantidad: String(meta.meta_creditos_cantidad),
      meta_inversiones_monto: String(meta.meta_inversiones_monto),
      meta_inversiones_cantidad: String(meta.meta_inversiones_cantidad),
      notas: meta.notas || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        user_id: Number(form.user_id),
        anio: Number(form.anio),
        mes: Number(form.mes),
        meta_creditos_monto: Number(form.meta_creditos_monto) || 0,
        meta_creditos_cantidad: Number(form.meta_creditos_cantidad) || 0,
        meta_inversiones_monto: Number(form.meta_inversiones_monto) || 0,
        meta_inversiones_cantidad: Number(form.meta_inversiones_cantidad) || 0,
        notas: form.notas || null,
      };
      if (editingMeta) {
        await api.put(`/api/metas-venta/${editingMeta.id}`, payload);
        toastSuccess('Meta actualizada');
      } else {
        await api.post('/api/metas-venta', payload);
        toastSuccess('Meta creada');
      }
      setShowForm(false);
      onRefresh();
    } catch (e: any) {
      toastError(e?.response?.data?.message || 'Error al guardar meta');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta meta?')) return;
    try {
      await api.delete(`/api/metas-venta/${id}`);
      toastSuccess('Meta eliminada');
      onRefresh();
    } catch { toastError('Error al eliminar'); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            <CardTitle>Metas de Venta</CardTitle>
          </div>
          <Button size="sm" className="gap-1" onClick={openNew}>
            <PlusCircle className="h-4 w-4" /> Nueva Meta
          </Button>
        </div>
        <CardDescription>Metas mensuales de colocación por vendedor</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : metas.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No hay metas definidas. Crea la primera.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {metas.map(meta => {
              const alcCreditos = meta.creditos_alcanzado_monto || 0;
              const metaCreditos = Number(meta.meta_creditos_monto);
              const pctCreditos = metaCreditos > 0 ? (alcCreditos / metaCreditos) * 100 : 0;
              return (
                <div key={meta.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{meta.user?.name?.charAt(0) ?? '?'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{meta.user?.name}</p>
                        <p className="text-sm text-muted-foreground">{MESES[meta.mes - 1]} {meta.anio}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(meta)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(meta.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Créditos: {fmt(alcCreditos)}</span>
                      <span>Meta: {fmt(metaCreditos)}</span>
                    </div>
                    <Progress value={Math.min(pctCreditos, 100)} className="mt-1 h-2" />
                  </div>
                  {Number(meta.meta_inversiones_monto) > 0 && (
                    <div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Inversiones: {fmt(meta.inversiones_alcanzado_monto || 0)}</span>
                        <span>Meta: {fmt(Number(meta.meta_inversiones_monto))}</span>
                      </div>
                      <Progress
                        value={Math.min(((meta.inversiones_alcanzado_monto || 0) / Number(meta.meta_inversiones_monto)) * 100, 100)}
                        className="mt-1 h-2"
                      />
                    </div>
                  )}
                  {meta.notas && <p className="text-xs text-muted-foreground italic">{meta.notas}</p>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Modal crear/editar meta */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMeta ? 'Editar Meta' : 'Nueva Meta de Venta'}</DialogTitle>
            <DialogDescription>Define la meta mensual de colocación para un vendedor.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Vendedor</Label>
              <Select value={form.user_id} onValueChange={v => setForm(f => ({ ...f, user_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar vendedor" /></SelectTrigger>
                <SelectContent>
                  {agents.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Año</Label>
                <Input type="number" value={form.anio} onChange={e => setForm(f => ({ ...f, anio: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Mes</Label>
                <Select value={form.mes} onValueChange={v => setForm(f => ({ ...f, mes: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Meta Créditos (₡)</Label>
                <Input type="number" value={form.meta_creditos_monto} onChange={e => setForm(f => ({ ...f, meta_creditos_monto: e.target.value }))} placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label>Cantidad Créditos</Label>
                <Input type="number" value={form.meta_creditos_cantidad} onChange={e => setForm(f => ({ ...f, meta_creditos_cantidad: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Meta Inversiones (₡)</Label>
                <Input type="number" value={form.meta_inversiones_monto} onChange={e => setForm(f => ({ ...f, meta_inversiones_monto: e.target.value }))} placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label>Cantidad Inversiones</Label>
                <Input type="number" value={form.meta_inversiones_cantidad} onChange={e => setForm(f => ({ ...f, meta_inversiones_cantidad: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Notas opcionales..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.user_id}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingMeta ? 'Actualizar' : 'Crear Meta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// VISITAS TAB
// ============================================================
function VisitasSection({ agents, instituciones, onRefresh: parentRefresh }: {
  agents: Agent[];
  instituciones: Institucion[];
  onRefresh: () => void;
}) {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterUser, setFilterUser] = useState('todos');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    user_id: '', institucion_id: '', institucion_nombre: '',
    fecha_planificada: '', notas: '',
    contacto_nombre: '', contacto_telefono: '', contacto_email: '',
  });

  const fetchVisitas = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: '15' };
      if (filterStatus !== 'todos') params.status = filterStatus;
      if (filterUser !== 'todos') params.user_id = filterUser;
      const { data } = await api.get('/api/visitas', { params });
      setVisitas(data.data || []);
      setTotalPages(data.last_page || 1);
    } catch { toastError('Error al cargar visitas'); }
    finally { setLoading(false); }
  }, [page, filterStatus, filterUser]);

  useEffect(() => { fetchVisitas(); }, [fetchVisitas]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/api/visitas', {
        user_id: Number(form.user_id),
        institucion_id: form.institucion_id ? Number(form.institucion_id) : null,
        institucion_nombre: !form.institucion_id ? form.institucion_nombre : null,
        fecha_planificada: form.fecha_planificada,
        notas: form.notas || null,
        contacto_nombre: form.contacto_nombre || null,
        contacto_telefono: form.contacto_telefono || null,
        contacto_email: form.contacto_email || null,
      });
      toastSuccess('Visita planificada');
      setShowForm(false);
      setForm({ user_id: '', institucion_id: '', institucion_nombre: '', fecha_planificada: '', notas: '', contacto_nombre: '', contacto_telefono: '', contacto_email: '' });
      fetchVisitas();
      parentRefresh();
    } catch (e: any) {
      toastError(e?.response?.data?.message || 'Error al crear visita');
    } finally { setSaving(false); }
  };

  const updateStatus = async (id: number, status: string, resultado?: string) => {
    try {
      await api.patch(`/api/visitas/${id}/status`, { status, resultado });
      toastSuccess('Estado actualizado');
      fetchVisitas();
      parentRefresh();
    } catch { toastError('Error al actualizar estado'); }
  };

  const deleteVisita = async (id: number) => {
    if (!confirm('¿Eliminar esta visita?')) return;
    try {
      await api.delete(`/api/visitas/${id}`);
      toastSuccess('Visita eliminada');
      fetchVisitas();
      parentRefresh();
    } catch { toastError('Error al eliminar'); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            <CardTitle>Visitas a Instituciones</CardTitle>
          </div>
          <Button size="sm" className="gap-1" onClick={() => setShowForm(true)}>
            <PlusCircle className="h-4 w-4" /> Planificar Visita
          </Button>
        </div>
        <CardDescription>Cronograma de visitas para captación de nuevos clientes</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-4">
          <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="Planificada">Planificada</SelectItem>
              <SelectItem value="Completada">Completada</SelectItem>
              <SelectItem value="Cancelada">Cancelada</SelectItem>
              <SelectItem value="Reprogramada">Reprogramada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterUser} onValueChange={v => { setFilterUser(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los vendedores</SelectItem>
              {agents.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : visitas.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No hay visitas registradas.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Institución</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitas.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.institucion?.nombre ?? v.institucion_nombre ?? '—'}</TableCell>
                    <TableCell>{v.user?.name}</TableCell>
                    <TableCell>{new Date(v.fecha_planificada).toLocaleDateString('es-CR')}</TableCell>
                    <TableCell>
                      {v.contacto_nombre && <span className="text-sm">{v.contacto_nombre}</span>}
                      {v.contacto_telefono && <span className="text-xs text-muted-foreground block">{v.contacto_telefono}</span>}
                    </TableCell>
                    <TableCell><Badge variant={getVisitaVariant(v.status)}>{v.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {v.status === 'Planificada' && (
                          <>
                            <Button variant="ghost" size="icon" title="Completar" onClick={() => {
                              const resultado = prompt('Resultado de la visita:');
                              if (resultado !== null) updateStatus(v.id, 'Completada', resultado);
                            }}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Cancelar" onClick={() => updateStatus(v.id, 'Cancelada')}>
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" title="Eliminar" onClick={() => deleteVisita(v.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Modal nueva visita */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Planificar Visita</DialogTitle>
            <DialogDescription>Agenda una visita a una institución.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Vendedor</Label>
              <Select value={form.user_id} onValueChange={v => setForm(f => ({ ...f, user_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar vendedor" /></SelectTrigger>
                <SelectContent>
                  {agents.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Institución</Label>
              <Select value={form.institucion_id} onValueChange={v => setForm(f => ({ ...f, institucion_id: v, institucion_nombre: '' }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar institución" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Otra (escribir nombre)</SelectItem>
                  {instituciones.map(i => <SelectItem key={i.id} value={String(i.id)}>{i.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              {!form.institucion_id && (
                <Input placeholder="Nombre de la institución" value={form.institucion_nombre} onChange={e => setForm(f => ({ ...f, institucion_nombre: e.target.value }))} />
              )}
            </div>
            <div className="grid gap-2">
              <Label>Fecha planificada</Label>
              <Input type="date" value={form.fecha_planificada} onChange={e => setForm(f => ({ ...f, fecha_planificada: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Contacto</Label>
                <Input placeholder="Nombre del contacto" value={form.contacto_nombre} onChange={e => setForm(f => ({ ...f, contacto_nombre: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input placeholder="8888-8888" value={form.contacto_telefono} onChange={e => setForm(f => ({ ...f, contacto_telefono: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Notas opcionales..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.user_id || !form.fecha_planificada || (!form.institucion_id && !form.institucion_nombre)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Planificar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// COMISIONES TAB
// ============================================================
function ComisionesSection({ agents }: { agents: Agent[] }) {
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [reglas, setReglas] = useState<ReglaComision[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterUser, setFilterUser] = useState('todos');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showReglas, setShowReglas] = useState(false);

  const fetchComisiones = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: '20' };
      if (filterEstado !== 'todos') params.estado = filterEstado;
      if (filterUser !== 'todos') params.user_id = filterUser;
      const { data } = await api.get('/api/comisiones', { params });
      setComisiones(data.data || []);
      setTotalPages(data.last_page || 1);
    } catch { toastError('Error al cargar comisiones'); }
    finally { setLoading(false); }
  }, [page, filterEstado, filterUser]);

  const fetchReglas = async () => {
    try {
      const { data } = await api.get('/api/reglas-comision');
      setReglas(data);
    } catch { }
  };

  useEffect(() => { fetchComisiones(); }, [fetchComisiones]);
  useEffect(() => { fetchReglas(); }, []);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkAction = async (action: 'aprobar' | 'pagar') => {
    if (selected.size === 0) return;
    try {
      await api.patch(`/api/comisiones/bulk-${action}`, { ids: Array.from(selected) });
      toastSuccess(`${selected.size} comisiones ${action === 'aprobar' ? 'aprobadas' : 'pagadas'}`);
      setSelected(new Set());
      fetchComisiones();
    } catch (e: any) {
      toastError(e?.response?.data?.message || 'Error en acción masiva');
    }
  };

  const getEstadoVariant = (estado: string) => {
    switch (estado) {
      case 'Pendiente': return 'secondary' as const;
      case 'Aprobada': return 'outline' as const;
      case 'Pagada': return 'default' as const;
      default: return 'secondary' as const;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              <CardTitle>Comisiones</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => { fetchReglas(); setShowReglas(true); }}>
              Reglas de Comisión
            </Button>
          </div>
          <CardDescription>Comisiones generadas por créditos e inversiones</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtros y acciones masivas */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Select value={filterEstado} onValueChange={v => { setFilterEstado(v); setPage(1); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Pendiente">Pendiente</SelectItem>
                <SelectItem value="Aprobada">Aprobada</SelectItem>
                <SelectItem value="Pagada">Pagada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterUser} onValueChange={v => { setFilterUser(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {agents.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {selected.size > 0 && (
              <div className="flex gap-2 ml-auto">
                <Button size="sm" variant="outline" onClick={() => bulkAction('aprobar')}>
                  <Check className="mr-1 h-4 w-4" /> Aprobar ({selected.size})
                </Button>
                <Button size="sm" onClick={() => bulkAction('pagar')}>
                  <DollarSign className="mr-1 h-4 w-4" /> Pagar ({selected.size})
                </Button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : comisiones.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No hay comisiones registradas.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={selected.size === comisiones.length && comisiones.length > 0}
                        onCheckedChange={(checked) => {
                          setSelected(checked ? new Set(comisiones.map(c => c.id)) : new Set());
                        }}
                      />
                    </TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Monto Operación</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Comisión</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comisiones.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                      </TableCell>
                      <TableCell className="font-medium">{c.user?.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.tipo === 'credito' ? 'Crédito' : 'Inversión'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmt(Number(c.monto_operacion))}</TableCell>
                      <TableCell className="text-right">{(Number(c.porcentaje) * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(Number(c.monto_comision))}</TableCell>
                      <TableCell>{new Date(c.fecha_operacion).toLocaleDateString('es-CR')}</TableCell>
                      <TableCell><Badge variant={getEstadoVariant(c.estado)}>{c.estado}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal reglas de comisión */}
      <Dialog open={showReglas} onOpenChange={setShowReglas}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reglas de Comisión</DialogTitle>
            <DialogDescription>Porcentajes aplicados según tipo y monto de operación.</DialogDescription>
          </DialogHeader>
          {reglas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No hay reglas configuradas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Rango</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Activa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reglas.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nombre}</TableCell>
                    <TableCell>{r.tipo === 'credito' ? 'Crédito' : 'Inversión'}</TableCell>
                    <TableCell className="text-sm">
                      {fmt(Number(r.monto_minimo))} — {r.monto_maximo ? fmt(Number(r.monto_maximo)) : 'Sin tope'}
                    </TableCell>
                    <TableCell>{(Number(r.porcentaje) * 100).toFixed(2)}%</TableCell>
                    <TableCell>
                      <Badge variant={r.activo ? 'default' : 'secondary'}>{r.activo ? 'Sí' : 'No'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReglas(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function VentasPage() {
  const [metas, setMetas] = useState<MetaVenta[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [instituciones, setInstituciones] = useState<Institucion[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const anio = now.getFullYear();
  const mes = now.getMonth() + 1;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [metasRes, visitasRes, comisionesRes, agentsRes, instRes] = await Promise.all([
        api.get('/api/metas-venta', { params: { anio, mes } }),
        api.get('/api/visitas', { params: { anio, mes, per_page: 100 } }),
        api.get('/api/comisiones', { params: { anio, mes, per_page: 100 } }),
        api.get('/api/agents'),
        api.get('/api/instituciones?activas_only=true'),
      ]);
      setMetas(metasRes.data);
      setVisitas(visitasRes.data?.data || visitasRes.data || []);
      setComisiones(comisionesRes.data?.data || comisionesRes.data || []);
      setAgents(agentsRes.data);
      setInstituciones(instRes.data);
    } catch {
      toastError('Error al cargar datos de ventas');
    } finally {
      setLoading(false);
    }
  }, [anio, mes]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <ProtectedPage module="ventas">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage module="ventas">
      <Tabs defaultValue="resumen" className="space-y-6">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="metas">Metas</TabsTrigger>
          <TabsTrigger value="visitas">Visitas</TabsTrigger>
          <TabsTrigger value="comisiones">Comisiones</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <ResumenSection metas={metas} visitas={visitas} comisiones={comisiones} />
        </TabsContent>

        <TabsContent value="metas">
          <MetasSection metas={metas} agents={agents} loading={false} onRefresh={fetchAll} />
        </TabsContent>

        <TabsContent value="visitas">
          <VisitasSection agents={agents} instituciones={instituciones} onRefresh={fetchAll} />
        </TabsContent>

        <TabsContent value="comisiones">
          <ComisionesSection agents={agents} />
        </TabsContent>
      </Tabs>
    </ProtectedPage>
  );
}
