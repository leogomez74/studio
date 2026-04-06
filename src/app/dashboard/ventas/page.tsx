'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  PlusCircle, Loader2, Target, Building, Banknote,
  ChevronLeft, ChevronRight, Check, X, Trash2, Pencil, DollarSign,
} from 'lucide-react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { getAuthUser } from '@/lib/auth';
import api from '@/lib/axios';
import { toastSuccess, toastError } from '@/hooks/use-toast';

// Componentes del módulo
import { VendedoresTable, type VendedorRow } from '@/components/ventas/VendedoresTable';
import { VendedorDashboard } from '@/components/ventas/VendedorDashboard';
import { MetaTiersForm, TIERS_DEFAULT, type TierFormItem } from '@/components/ventas/MetaTiersForm';
import { RankingStrip, type RankingEntry } from '@/components/ventas/RankingStrip';

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
  bonus_tiers?: TierFormItem[];
  creditos_alcanzado_monto?: number;
  creditos_alcanzado_cantidad?: number;
  tier_activo?: { descripcion: string; porcentaje: number } | null;
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
  user?: { id: number; name: string };
  institucion?: { id: number; nombre: string } | null;
}

interface Agent { id: number; name: string }
interface Institucion { id: number; nombre: string }

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n);

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ============================================================
// TAB METAS
// ============================================================
function MetasSection({
  metas, agents, loading, onRefresh, ranking,
}: {
  metas: MetaVenta[];
  agents: Agent[];
  loading: boolean;
  onRefresh: () => void;
  ranking: RankingEntry[];
}) {
  const now = new Date();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingMeta, setEditingMeta] = useState<MetaVenta | null>(null);
  const [form, setForm] = useState({
    user_id: '', anio: String(now.getFullYear()), mes: String(now.getMonth() + 1),
    meta_creditos_monto: '', meta_creditos_cantidad: '',
    meta_inversiones_monto: '', meta_inversiones_cantidad: '',
    notas: '',
  });
  const [tiers, setTiers] = useState<TierFormItem[]>(TIERS_DEFAULT);

  const openNew = () => {
    setEditingMeta(null);
    setForm({
      user_id: '', anio: String(now.getFullYear()), mes: String(now.getMonth() + 1),
      meta_creditos_monto: '', meta_creditos_cantidad: '',
      meta_inversiones_monto: '', meta_inversiones_cantidad: '',
      notas: '',
    });
    setTiers(TIERS_DEFAULT);
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
    setTiers(meta.bonus_tiers?.length ? meta.bonus_tiers : TIERS_DEFAULT);
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
        tiers,
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
    } finally { setSaving(false); }
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
    <div className="space-y-4">
      <RankingStrip ranking={ranking} mes={MESES[(new Date().getMonth())]} anio={now.getFullYear()} />

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
          <CardDescription>Metas mensuales de colocación por vendedor, con tiers de bonificación</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : metas.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No hay metas para este período.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {metas.map(meta => {
                const alc = meta.creditos_alcanzado_monto || 0;
                const obj = Number(meta.meta_creditos_monto);
                const pct = obj > 0 ? (alc / obj) * 100 : 0;
                return (
                  <div key={meta.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{meta.user?.name}</p>
                        <p className="text-xs text-muted-foreground">{MESES[meta.mes - 1]} {meta.anio}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {meta.tier_activo && (
                          <Badge variant="outline" className="text-xs">
                            {meta.tier_activo.descripcion} · {(meta.tier_activo.porcentaje * 100).toFixed(1)}%
                          </Badge>
                        )}
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(meta)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(meta.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Créditos: {meta.creditos_alcanzado_cantidad ?? 0} / {meta.meta_creditos_cantidad}</span>
                        <span>{fmt(alc)} / {fmt(obj)}</span>
                      </div>
                      <Progress value={Math.min(pct, 100)} className="h-1.5" />
                    </div>

                    {meta.bonus_tiers && meta.bonus_tiers.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {meta.bonus_tiers.map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {t.creditos_minimos}cr → {(Number(t.porcentaje) * 100).toFixed(1)}%
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal crear/editar meta */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMeta ? 'Editar Meta' : 'Nueva Meta de Venta'}</DialogTitle>
            <DialogDescription>Define la meta mensual y los tiers de bonificación.</DialogDescription>
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
            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2} placeholder="Notas opcionales..." />
            </div>

            {/* Tiers */}
            <MetaTiersForm tiers={tiers} onChange={setTiers} />
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
    </div>
  );
}

// ============================================================
// TAB COMISIONES
// ============================================================
function ComisionesSection({ agents, ranking }: { agents: Agent[]; ranking: RankingEntry[] }) {
  const now = new Date();
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [reglas, setReglas] = useState<ReglaComision[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterUser, setFilterUser] = useState('todos');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showReglas, setShowReglas] = useState(false);
  const [savingRegla, setSavingRegla] = useState(false);
  const [showReglaForm, setShowReglaForm] = useState(false);
  const [editingRegla, setEditingRegla] = useState<ReglaComision | null>(null);
  const [reglaForm, setReglaForm] = useState({ nombre: '', tipo: 'credito', monto_minimo: '', monto_maximo: '', porcentaje: '', activo: true });

  const user = getAuthUser();
  const isSuperAdmin = user?.role?.full_access === true;

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
    } catch {}
  };

  useEffect(() => { fetchComisiones(); }, [fetchComisiones]);

  const toggleSelect = (id: number) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const bulkAction = async (action: 'aprobar' | 'pagar') => {
    if (selected.size === 0) return;
    try {
      await api.patch(`/api/comisiones/bulk-${action}`, { ids: Array.from(selected) });
      toastSuccess(`${selected.size} comisiones ${action === 'aprobar' ? 'aprobadas' : 'pagadas'}`);
      setSelected(new Set());
      fetchComisiones();
    } catch (e: any) { toastError(e?.response?.data?.message || 'Error'); }
  };

  const handleSaveRegla = async () => {
    setSavingRegla(true);
    try {
      const payload = {
        nombre: reglaForm.nombre,
        tipo: reglaForm.tipo,
        monto_minimo: Number(reglaForm.monto_minimo),
        monto_maximo: reglaForm.monto_maximo ? Number(reglaForm.monto_maximo) : null,
        porcentaje: Number(reglaForm.porcentaje) / 100,
        activo: reglaForm.activo,
      };
      if (editingRegla) {
        await api.put(`/api/reglas-comision/${editingRegla.id}`, payload);
        toastSuccess('Regla actualizada');
      } else {
        await api.post('/api/reglas-comision', payload);
        toastSuccess('Regla creada');
      }
      setShowReglaForm(false);
      fetchReglas();
    } catch (e: any) { toastError(e?.response?.data?.message || 'Error'); }
    finally { setSavingRegla(false); }
  };

  const estadoVariant = (e: string) =>
    e === 'Pagada' ? 'default' : e === 'Aprobada' ? 'outline' : 'secondary';

  return (
    <div className="space-y-4">
      <RankingStrip ranking={ranking} mes={MESES[now.getMonth()]} anio={now.getFullYear()} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              <CardTitle>Comisiones</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => { fetchReglas(); setShowReglas(true); }}>
              Reglas de comisión base
            </Button>
          </div>
          <CardDescription>Comisiones generadas por créditos e inversiones</CardDescription>
        </CardHeader>
        <CardContent>
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
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selected.size === comisiones.length && comisiones.length > 0}
                          onCheckedChange={c => setSelected(c ? new Set(comisiones.map(x => x.id)) : new Set())}
                        />
                      </TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Monto op.</TableHead>
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
                        <TableCell className="font-medium text-sm">{c.user?.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {c.tipo === 'credito' ? 'Crédito' : 'Inversión'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{fmt(Number(c.monto_operacion))}</TableCell>
                        <TableCell className="text-right text-sm">{(Number(c.porcentaje) * 100).toFixed(2)}%</TableCell>
                        <TableCell className="text-right font-semibold text-sm">{fmt(Number(c.monto_comision))}</TableCell>
                        <TableCell className="text-sm">{new Date(c.fecha_operacion).toLocaleDateString('es-CR')}</TableCell>
                        <TableCell>
                          <Badge variant={estadoVariant(c.estado)} className="text-xs">{c.estado}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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

      {/* Modal reglas de comisión base */}
      <Dialog open={showReglas} onOpenChange={setShowReglas}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reglas de Comisión Base</DialogTitle>
            <DialogDescription>
              Porcentajes aplicados por rango de monto cuando el vendedor no ha alcanzado ningún tier de bonificación.
              {!isSuperAdmin && ' Solo el super admin puede modificarlas.'}
            </DialogDescription>
          </DialogHeader>
          {isSuperAdmin && (
            <div className="flex justify-end">
              <Button size="sm" className="gap-1" onClick={() => {
                setEditingRegla(null);
                setReglaForm({ nombre: '', tipo: 'credito', monto_minimo: '', monto_maximo: '', porcentaje: '', activo: true });
                setShowReglaForm(true);
              }}>
                <PlusCircle className="h-4 w-4" /> Nueva regla
              </Button>
            </div>
          )}
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
                  {isSuperAdmin && <TableHead className="w-16" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reglas.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nombre}</TableCell>
                    <TableCell>{r.tipo === 'credito' ? 'Crédito' : 'Inversión'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmt(Number(r.monto_minimo))} — {r.monto_maximo ? fmt(Number(r.monto_maximo)) : 'Sin tope'}
                    </TableCell>
                    <TableCell className="font-semibold">{(Number(r.porcentaje) * 100).toFixed(2)}%</TableCell>
                    <TableCell>
                      <Badge variant={r.activo ? 'default' : 'secondary'}>{r.activo ? 'Sí' : 'No'}</Badge>
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            setEditingRegla(r);
                            setReglaForm({
                              nombre: r.nombre, tipo: r.tipo,
                              monto_minimo: String(r.monto_minimo), monto_maximo: r.monto_maximo ? String(r.monto_maximo) : '',
                              porcentaje: String(Number(r.porcentaje) * 100), activo: r.activo,
                            });
                            setShowReglaForm(true);
                          }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => {
                            if (!confirm('¿Eliminar esta regla?')) return;
                            await api.delete(`/api/reglas-comision/${r.id}`);
                            fetchReglas();
                          }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
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

      {/* Modal crear/editar regla (solo super admin) */}
      {isSuperAdmin && (
        <Dialog open={showReglaForm} onOpenChange={setShowReglaForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRegla ? 'Editar Regla' : 'Nueva Regla de Comisión'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Nombre</Label>
                <Input value={reglaForm.nombre} onChange={e => setReglaForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tipo</Label>
                  <Select value={reglaForm.tipo} onValueChange={v => setReglaForm(f => ({ ...f, tipo: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credito">Crédito</SelectItem>
                      <SelectItem value="inversion">Inversión</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>% comisión</Label>
                  <Input type="number" step="0.01" value={reglaForm.porcentaje} onChange={e => setReglaForm(f => ({ ...f, porcentaje: e.target.value }))} placeholder="2.5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Monto mínimo (₡)</Label>
                  <Input type="number" value={reglaForm.monto_minimo} onChange={e => setReglaForm(f => ({ ...f, monto_minimo: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Monto máximo (₡)</Label>
                  <Input type="number" value={reglaForm.monto_maximo} onChange={e => setReglaForm(f => ({ ...f, monto_maximo: e.target.value }))} placeholder="Sin tope" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReglaForm(false)}>Cancelar</Button>
              <Button onClick={handleSaveRegla} disabled={savingRegla}>
                {savingRegla && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingRegla ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============================================================
// TAB VISITAS
// ============================================================
function VisitasSection({ agents, instituciones, ranking, canCreate = true }: {
  agents: Agent[];
  instituciones: Institucion[];
  ranking: RankingEntry[];
  canCreate?: boolean;
}) {
  const now = new Date();
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
        institucion_id: (form.institucion_id && form.institucion_id !== '__otra__') ? Number(form.institucion_id) : null,
        institucion_nombre: (!form.institucion_id || form.institucion_id === '__otra__') ? form.institucion_nombre : null,
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
    } catch (e: any) { toastError(e?.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id: number, status: string, resultado?: string) => {
    try {
      await api.patch(`/api/visitas/${id}/status`, { status, resultado });
      toastSuccess('Estado actualizado');
      fetchVisitas();
    } catch { toastError('Error al actualizar'); }
  };

  const statusVariant = (s: Visita['status']) => {
    if (s === 'Completada') return 'default' as const;
    if (s === 'Cancelada') return 'destructive' as const;
    if (s === 'Reprogramada') return 'outline' as const;
    return 'secondary' as const;
  };

  return (
    <div className="space-y-4">
      <RankingStrip ranking={ranking} mes={MESES[now.getMonth()]} anio={now.getFullYear()} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              <CardTitle>Visitas a Instituciones</CardTitle>
            </div>
            {canCreate && (
              <Button size="sm" className="gap-1" onClick={() => setShowForm(true)}>
                <PlusCircle className="h-4 w-4" /> Planificar Visita
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
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
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Institución</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visitas.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium text-sm">{v.institucion?.nombre ?? v.institucion_nombre ?? '—'}</TableCell>
                        <TableCell className="text-sm">{v.user?.name}</TableCell>
                        <TableCell className="text-sm">{new Date(v.fecha_planificada).toLocaleDateString('es-CR')}</TableCell>
                        <TableCell>
                          {v.contacto_nombre && <span className="text-sm">{v.contacto_nombre}</span>}
                          {v.contacto_telefono && <span className="text-xs text-muted-foreground block">{v.contacto_telefono}</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(v.status)} className="text-xs">{v.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {v.status === 'Planificada' && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Completar" onClick={() => {
                                  const resultado = prompt('Resultado de la visita:');
                                  if (resultado !== null) updateStatus(v.id, 'Completada', resultado);
                                }}>
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Cancelar" onClick={() => updateStatus(v.id, 'Cancelada')}>
                                  <X className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => {
                              if (!confirm('¿Eliminar esta visita?')) return;
                              await api.delete(`/api/visitas/${v.id}`);
                              fetchVisitas();
                            }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
                  <SelectItem value="__otra__">Otra (escribir nombre)</SelectItem>
                  {instituciones.map(i => <SelectItem key={i.id} value={String(i.id)}>{i.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              {(!form.institucion_id || form.institucion_id === '__otra__') && (
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
                <Input placeholder="Nombre" value={form.contacto_nombre} onChange={e => setForm(f => ({ ...f, contacto_nombre: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input placeholder="8888-8888" value={form.contacto_telefono} onChange={e => setForm(f => ({ ...f, contacto_telefono: e.target.value }))} />
              </div>
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
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function VentasPage() {
  const searchParams = useSearchParams();
  const user = getAuthUser();
  const isAdmin = user?.role?.full_access === true;
  const now = new Date();
  const anio = now.getFullYear();
  const mes = now.getMonth() + 1;
  const mesNombre = MESES[now.getMonth()];

  const [metas, setMetas] = useState<MetaVenta[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [instituciones, setInstituciones] = useState<Institucion[]>([]);
  const [loading, setLoading] = useState(true);

  // Leaderboard / ranking
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [rankingLoading, setRankingLoading] = useState(true);

  // Vista vendedor
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [visitas, setVisitas] = useState<any[]>([]);

  // Tab activo con filtro de comisiones/visitas por vendedor
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') ?? 'vendedores');
  const [filterVendedor, setFilterVendedor] = useState<string | null>(null);

  // Sincronizar tab desde URL (ej: ?tab=visitas desde VendedorDashboard)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const fetchLeaderboard = useCallback(async () => {
    setRankingLoading(true);
    try {
      const { data } = await api.get('/api/ventas/leaderboard', { params: { anio, mes } });
      setRanking(data.ranking || []);
    } catch {}
    finally { setRankingLoading(false); }
  }, [anio, mes]);

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [metasRes, agentsRes, instRes] = await Promise.all([
        api.get('/api/metas-venta', { params: { anio, mes } }),
        api.get('/api/agents'),
        api.get('/api/instituciones?activas_only=true'),
      ]);
      setMetas(metasRes.data);
      setAgents(agentsRes.data);
      setInstituciones(instRes.data);
    } catch { toastError('Error al cargar datos'); }
    finally { setLoading(false); }
  }, [anio, mes]);

  const fetchVendedorData = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const [dashRes, visitasRes, instRes, agentsRes] = await Promise.all([
        api.get('/api/ventas/dashboard'),
        api.get('/api/visitas/proximas'),
        api.get('/api/instituciones?activas_only=true'),
        api.get('/api/agents'),
      ]);
      setDashboardData(dashRes.data);
      setVisitas(visitasRes.data || []);
      setInstituciones(instRes.data || []);
      setAgents(agentsRes.data || []);
    } catch { toastError('Error al cargar tu dashboard'); }
    finally { setDashboardLoading(false); }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    if (isAdmin) fetchAdminData();
    else fetchVendedorData();
  }, [isAdmin, fetchAdminData, fetchVendedorData, fetchLeaderboard]);

  // Navegación desde VendedoresTable hacia tabs filtrados
  const handleVerComisiones = (userId: number) => {
    setFilterVendedor(String(userId));
    setActiveTab('comisiones');
  };
  const handleVerVisitas = (userId: number) => {
    setFilterVendedor(String(userId));
    setActiveTab('visitas');
  };

  // Vista del vendedor
  if (!isAdmin) {
    return (
      <ProtectedPage module="ventas">
        <div className="space-y-1 mb-6">
          <h1 className="text-2xl font-bold">Mis Ventas</h1>
          <p className="text-muted-foreground text-sm">{mesNombre} {anio}</p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="vendedores">Inicio</TabsTrigger>
            <TabsTrigger value="visitas">Mis visitas</TabsTrigger>
          </TabsList>
          <TabsContent value="vendedores">
            <VendedorDashboard
              data={dashboardData}
              loading={dashboardLoading}
              ranking={ranking}
              rankingLoading={rankingLoading}
              visitas={visitas}
              mes={mesNombre}
              anio={anio}
            />
          </TabsContent>
          <TabsContent value="visitas">
            <VisitasSection agents={agents} instituciones={instituciones} ranking={[]} canCreate={false} />
          </TabsContent>
        </Tabs>
      </ProtectedPage>
    );
  }

  // Vista del admin
  // Construir filas de VendedoresTable desde leaderboard + metas
  const vendedoresRows: VendedorRow[] = ranking.map(r => ({
    user_id: r.user_id,
    name: r.name,
    creditos_mes: r.creditos_mes,
    meta_cantidad: r.meta_cantidad,
    alcance_pct: r.alcance_pct,
    monto_colocado: (r as any).monto_colocado ?? 0,
    ticket_promedio: (r as any).ticket_promedio ?? 0,
    tasa_cierre: (r as any).tasa_cierre ?? null,
    comision_acumulada: (r as any).comision_acumulada ?? 0,
    tier_activo_nombre: r.tier_activo_nombre,
    tier_porcentaje: (r as any).tier_porcentaje ?? null,
    ultima_actividad: (r as any).ultima_actividad ?? null,
    posicion: r.posicion,
  }));

  return (
    <ProtectedPage module="ventas">
      <div className="space-y-1 mb-6">
        <h1 className="text-2xl font-bold">Ventas</h1>
        <p className="text-muted-foreground text-sm">{mesNombre} {anio}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
          <TabsTrigger value="metas">Metas</TabsTrigger>
          <TabsTrigger value="comisiones">Comisiones</TabsTrigger>
          <TabsTrigger value="visitas">Visitas</TabsTrigger>
        </TabsList>

        <TabsContent value="vendedores" className="space-y-4">
          <RankingStrip ranking={ranking} mes={mesNombre} anio={anio} loading={rankingLoading} />
          <VendedoresTable
            vendedores={vendedoresRows}
            loading={rankingLoading}
            onVerComisiones={handleVerComisiones}
            onVerVisitas={handleVerVisitas}
            onGestionarMeta={(userId) => {
              // Navegar al perfil del vendedor para gestionar metas
              window.location.href = `/dashboard/ventas/${userId}`;
            }}
            onDesactivar={async (userId, name) => {
              if (!confirm(`¿Desactivar a ${name} del módulo de ventas?`)) return;
              try {
                await api.patch(`/api/users/${userId}`, { status: 'inactive' });
                toastSuccess(`${name} desactivado`);
                fetchAdminData();
                fetchLeaderboard();
              } catch { toastError('Error al desactivar'); }
            }}
          />
        </TabsContent>

        <TabsContent value="metas">
          <MetasSection
            metas={metas}
            agents={agents}
            loading={loading}
            onRefresh={() => { fetchAdminData(); fetchLeaderboard(); }}
            ranking={ranking}
          />
        </TabsContent>

        <TabsContent value="comisiones">
          <ComisionesSection agents={agents} ranking={ranking} />
        </TabsContent>

        <TabsContent value="visitas">
          <VisitasSection agents={agents} instituciones={instituciones} ranking={ranking} />
        </TabsContent>
      </Tabs>
    </ProtectedPage>
  );
}
