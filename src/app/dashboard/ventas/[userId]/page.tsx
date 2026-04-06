'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, ArrowLeft, Target, Banknote, Building, Star,
  Check, X, Pencil, Trash2, PlusCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { TierProgressCard } from '@/components/ventas/TierProgressCard';
import { MetaTiersForm, TIERS_DEFAULT, type TierFormItem } from '@/components/ventas/MetaTiersForm';
import { getAuthUser } from '@/lib/auth';
import api from '@/lib/axios';
import { toastSuccess, toastError } from '@/hooks/use-toast';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n);

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

interface DashboardData {
  vendedor: { id: number; name: string };
  meta_mes: any;
  tier_activo: any;
  proximo_tier: any;
  comisiones_mes: any;
  reward_points: number;
  reward_level: number;
  ranking: number;
}

interface MetaVenta {
  id: number;
  user_id: number;
  anio: number;
  mes: number;
  meta_creditos_monto: number;
  meta_creditos_cantidad: number;
  notas: string | null;
  activo: boolean;
  bonus_tiers?: TierFormItem[];
  creditos_alcanzado_monto?: number;
  creditos_alcanzado_cantidad?: number;
  tier_activo?: any;
}

interface Comision {
  id: number;
  tipo: string;
  monto_operacion: number;
  porcentaje: number;
  monto_comision: number;
  estado: string;
  fecha_operacion: string;
}

interface Visita {
  id: number;
  institucion_nombre: string | null;
  institucion?: { nombre: string } | null;
  fecha_planificada: string;
  fecha_realizada: string | null;
  status: string;
  resultado: string | null;
}

export default function VendedorPerfilPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const currentUser = getAuthUser();
  const isAdmin = currentUser?.role?.full_access === true;

  const now = new Date();
  const anio = now.getFullYear();
  const mes = now.getMonth() + 1;

  const [data, setData] = useState<DashboardData | null>(null);
  const [metas, setMetas] = useState<MetaVenta[]>([]);
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [comisionesPage, setComisionesPage] = useState(1);
  const [comisionesTotal, setComisionesTotal] = useState(1);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);

  // Meta form
  const [showMetaForm, setShowMetaForm] = useState(false);
  const [editingMeta, setEditingMeta] = useState<MetaVenta | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({ anio: String(anio), mes: String(mes), meta_creditos_monto: '', meta_creditos_cantidad: '', notas: '' });
  const [tiers, setTiers] = useState<TierFormItem[]>(TIERS_DEFAULT);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, metasRes, comisionesRes, visitasRes] = await Promise.all([
        api.get(`/api/ventas/dashboard/${userId}`),
        api.get('/api/metas-venta', { params: { user_id: userId, activo: false } }),
        api.get('/api/comisiones', { params: { user_id: userId, per_page: '15', page: comisionesPage } }),
        api.get('/api/visitas', { params: { user_id: userId, per_page: '20' } }),
      ]);
      setData(dashRes.data);
      setMetas(metasRes.data);
      setComisiones(comisionesRes.data.data || []);
      setComisionesTotal(comisionesRes.data.last_page || 1);
      setVisitas(visitasRes.data.data || []);
    } catch { toastError('Error al cargar datos del vendedor'); }
    finally { setLoading(false); }
  }, [userId, comisionesPage]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNewMeta = () => {
    setEditingMeta(null);
    setMetaForm({ anio: String(anio), mes: String(mes), meta_creditos_monto: '', meta_creditos_cantidad: '', notas: '' });
    setTiers(TIERS_DEFAULT);
    setShowMetaForm(true);
  };

  const openEditMeta = (meta: MetaVenta) => {
    setEditingMeta(meta);
    setMetaForm({
      anio: String(meta.anio), mes: String(meta.mes),
      meta_creditos_monto: String(meta.meta_creditos_monto),
      meta_creditos_cantidad: String(meta.meta_creditos_cantidad),
      notas: meta.notas || '',
    });
    setTiers(meta.bonus_tiers?.length ? meta.bonus_tiers : TIERS_DEFAULT);
    setShowMetaForm(true);
  };

  const handleSaveMeta = async () => {
    setSavingMeta(true);
    try {
      const payload = {
        user_id: Number(userId),
        anio: Number(metaForm.anio),
        mes: Number(metaForm.mes),
        meta_creditos_monto: Number(metaForm.meta_creditos_monto) || 0,
        meta_creditos_cantidad: Number(metaForm.meta_creditos_cantidad) || 0,
        notas: metaForm.notas || null,
        tiers,
      };
      if (editingMeta) {
        await api.put(`/api/metas-venta/${editingMeta.id}`, payload);
        toastSuccess('Meta actualizada');
      } else {
        await api.post('/api/metas-venta', payload);
        toastSuccess('Meta creada');
      }
      setShowMetaForm(false);
      fetchAll();
    } catch (e: any) { toastError(e?.response?.data?.message || 'Error'); }
    finally { setSavingMeta(false); }
  };

  const handleDeleteMeta = async (id: number) => {
    if (!confirm('¿Eliminar esta meta?')) return;
    try {
      await api.delete(`/api/metas-venta/${id}`);
      toastSuccess('Meta eliminada');
      fetchAll();
    } catch { toastError('Error'); }
  };

  const handleAprobarComision = async (id: number) => {
    try {
      await api.patch(`/api/comisiones/${id}/aprobar`);
      toastSuccess('Comisión aprobada');
      fetchAll();
    } catch { toastError('Error al aprobar'); }
  };

  const handlePagarComision = async (id: number) => {
    try {
      await api.patch(`/api/comisiones/${id}/pagar`);
      toastSuccess('Comisión pagada');
      fetchAll();
    } catch { toastError('Error al pagar'); }
  };

  if (!isAdmin) {
    router.push('/dashboard/ventas');
    return null;
  }

  if (loading) {
    return (
      <ProtectedPage module="ventas">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ProtectedPage>
    );
  }

  const vendedor = data?.vendedor;
  const metaActual = data?.meta_mes;
  const estadoVariant = (e: string) =>
    e === 'Pagada' ? 'default' : e === 'Aprobada' ? 'outline' : 'secondary';

  return (
    <ProtectedPage module="ventas">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/ventas')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-lg font-bold">
                {vendedor?.name?.charAt(0) ?? '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-bold">{vendedor?.name}</h1>
              <div className="flex items-center gap-2">
                {data?.tier_activo && (
                  <Badge variant="outline" className="text-xs">
                    {data.tier_activo.descripcion} · {(data.tier_activo.porcentaje * 100).toFixed(1)}%
                  </Badge>
                )}
                {data?.ranking && (
                  <Badge variant="secondary" className="text-xs">
                    Posición #{data.ranking} este mes
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Resumen del mes actual */}
        {metaActual && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Meta actual — {MESES[mes - 1]} {anio}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Créditos</span>
                    <span className="font-semibold">{metaActual.creditos_alcanzados} / {metaActual.creditos_objetivo}</span>
                  </div>
                  <Progress value={Math.min(metaActual.alcance_pct, 100)} className={metaActual.alcance_pct >= 100 ? '[&>div]:bg-green-500' : ''} />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm pt-1">
                  <div>
                    <p className="text-muted-foreground">Monto colocado</p>
                    <p className="font-semibold">{fmt(metaActual.monto_alcanzado)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Comisiones del mes</p>
                    <p className="font-semibold text-green-600">
                      {fmt((data?.comisiones_mes?.pendientes_monto ?? 0) + (data?.comisiones_mes?.aprobadas_monto ?? 0) + (data?.comisiones_mes?.pagadas_monto ?? 0))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <TierProgressCard
              tierActivo={data?.tier_activo ?? null}
              proximoTier={data?.proximo_tier ?? null}
              creditosAlcanzados={metaActual.creditos_alcanzados}
            />
          </div>
        )}

        {/* Tabs detalladas */}
        <Tabs defaultValue="metas">
          <TabsList>
            <TabsTrigger value="metas">Metas</TabsTrigger>
            <TabsTrigger value="comisiones">Comisiones</TabsTrigger>
            <TabsTrigger value="visitas">Visitas</TabsTrigger>
            <TabsTrigger value="recompensas">Recompensas</TabsTrigger>
          </TabsList>

          {/* ---- METAS ---- */}
          <TabsContent value="metas" className="space-y-4 pt-4">
            <div className="flex justify-end">
              <Button size="sm" className="gap-1" onClick={openNewMeta}>
                <PlusCircle className="h-4 w-4" /> Nueva Meta
              </Button>
            </div>

            {metas.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Sin metas registradas.</p>
            ) : (
              <div className="space-y-3">
                {metas.map(meta => {
                  const alc = meta.creditos_alcanzado_monto || 0;
                  const obj = Number(meta.meta_creditos_monto);
                  const pct = obj > 0 ? (alc / obj) * 100 : 0;
                  const isCurrent = meta.anio === anio && meta.mes === mes;
                  return (
                    <div key={meta.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{MESES[meta.mes - 1]} {meta.anio}</span>
                          {isCurrent && <Badge className="text-xs">Mes actual</Badge>}
                          {meta.tier_activo && (
                            <Badge variant="outline" className="text-xs">
                              {meta.tier_activo.descripcion} · {(meta.tier_activo.porcentaje * 100).toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMeta(meta)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteMeta(meta.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{meta.creditos_alcanzado_cantidad ?? '—'} / {meta.meta_creditos_cantidad} créditos</span>
                          <span>{fmt(alc)} / {fmt(obj)}</span>
                        </div>
                        <Progress value={Math.min(pct, 100)} className="h-1.5" />
                      </div>

                      {meta.bonus_tiers && meta.bonus_tiers.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {meta.bonus_tiers.map((t, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {t.creditos_minimos}cr → {(Number(t.porcentaje) * 100).toFixed(1)}%{t.puntos_reward ? ` +${t.puntos_reward}pts` : ''}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ---- COMISIONES ---- */}
          <TabsContent value="comisiones" className="pt-4">
            {comisiones.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Sin comisiones registradas.</p>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Monto op.</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead className="text-right">Comisión</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comisiones.map(c => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{c.tipo === 'credito' ? 'Crédito' : 'Inversión'}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">{fmt(Number(c.monto_operacion))}</TableCell>
                          <TableCell className="text-right text-sm">{(Number(c.porcentaje) * 100).toFixed(2)}%</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{fmt(Number(c.monto_comision))}</TableCell>
                          <TableCell className="text-sm">{new Date(c.fecha_operacion).toLocaleDateString('es-CR')}</TableCell>
                          <TableCell>
                            <Badge variant={estadoVariant(c.estado)} className="text-xs">{c.estado}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {c.estado === 'Pendiente' && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Aprobar" onClick={() => handleAprobarComision(c.id)}>
                                  <Check className="h-3.5 w-3.5 text-green-600" />
                                </Button>
                              )}
                              {c.estado === 'Aprobada' && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Pagar" onClick={() => handlePagarComision(c.id)}>
                                  <Check className="h-3.5 w-3.5 text-blue-600" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {comisionesTotal > 1 && (
                  <div className="flex items-center justify-end gap-2 mt-4">
                    <Button variant="outline" size="sm" disabled={comisionesPage <= 1} onClick={() => setComisionesPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">Página {comisionesPage} de {comisionesTotal}</span>
                    <Button variant="outline" size="sm" disabled={comisionesPage >= comisionesTotal} onClick={() => setComisionesPage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ---- VISITAS ---- */}
          <TabsContent value="visitas" className="pt-4">
            {visitas.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Sin visitas registradas.</p>
            ) : (
              <div className="space-y-2">
                {visitas.map(v => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{v.institucion?.nombre ?? v.institucion_nombre ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.fecha_planificada).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {v.fecha_realizada && ` · Realizada: ${new Date(v.fecha_realizada).toLocaleDateString('es-CR')}`}
                      </p>
                      {v.resultado && <p className="text-xs text-muted-foreground italic mt-1">{v.resultado}</p>}
                    </div>
                    <Badge
                      variant={v.status === 'Completada' ? 'default' : v.status === 'Cancelada' ? 'destructive' : 'secondary'}
                      className="text-xs shrink-0"
                    >
                      {v.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ---- RECOMPENSAS (solo lectura) ---- */}
          <TabsContent value="recompensas" className="pt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">Recompensas de {vendedor?.name}</CardTitle>
                </div>
                <CardDescription>Gestión completa disponible en el módulo de Recompensas.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Puntos totales</p>
                  <p className="text-3xl font-bold text-primary">{data?.reward_points?.toLocaleString() ?? 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nivel actual</p>
                  <p className="text-3xl font-bold">Nivel {data?.reward_level ?? 1}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal crear/editar meta */}
      <Dialog open={showMetaForm} onOpenChange={setShowMetaForm}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMeta ? 'Editar Meta' : 'Nueva Meta'}</DialogTitle>
            <DialogDescription>Meta de {vendedor?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Año</Label>
                <Input type="number" value={metaForm.anio} onChange={e => setMetaForm(f => ({ ...f, anio: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Mes</Label>
                <Select value={metaForm.mes} onValueChange={v => setMetaForm(f => ({ ...f, mes: v }))}>
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
                <Input type="number" value={metaForm.meta_creditos_monto} onChange={e => setMetaForm(f => ({ ...f, meta_creditos_monto: e.target.value }))} placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label>Cantidad Créditos</Label>
                <Input type="number" value={metaForm.meta_creditos_cantidad} onChange={e => setMetaForm(f => ({ ...f, meta_creditos_cantidad: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea value={metaForm.notas} onChange={e => setMetaForm(f => ({ ...f, notas: e.target.value }))} rows={2} />
            </div>
            <MetaTiersForm tiers={tiers} onChange={setTiers} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMetaForm(false)}>Cancelar</Button>
            <Button onClick={handleSaveMeta} disabled={savingMeta}>
              {savingMeta && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingMeta ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedPage>
  );
}
