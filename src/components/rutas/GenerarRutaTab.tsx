'use client';

import { useState, useEffect, useCallback } from 'react';
import { PackageCheck, Truck, Loader2, AlertTriangle, Clock, Building2, ArrowUp, ArrowDown, GripVertical, RefreshCw, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';
import type { TareaRuta, ExternalIntegrationResult, ExternalStop, UserOption } from './types';
import { tipoIcons, prioridadColors, prioridadLabels, extStatusColors } from './utils';

interface SelectedExtStop {
  key: string; // unique key: `${integration_slug}-${route_id}-${stop_id}`
  branch_name: string;
  address?: string;
  integration_name: string;
  external_ref: string; // route reference
  pickups_summary: string;
}

interface Props {
  users: UserOption[];
  onGenerated: () => void;
}

export default function GenerarRutaTab({ users, onGenerated }: Props) {
  const { toast } = useToast();
  const [tareasPendientes, setTareasPendientes] = useState<TareaRuta[]>([]);
  const [extResults, setExtResults] = useState<ExternalIntegrationResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedExtStops, setSelectedExtStops] = useState<SelectedExtStop[]>([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [mensajeroId, setMensajeroId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPendientes = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const [pendientesRes, fallidasRes, extRes] = await Promise.all([
        api.get('/api/tareas-ruta', { params: { status: 'pendiente' } }),
        api.get('/api/tareas-ruta', { params: { status: 'fallida' } }),
        api.get('/api/external-routes', { params: refresh ? { refresh: 1 } : {} }),
      ]);
      setTareasPendientes([...pendientesRes.data, ...fallidasRes.data]);
      setExtResults(Array.isArray(extRes.data) ? extRes.data : []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las tareas.', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { fetchPendientes(); }, [fetchPendientes]);

  // — PEP task selection —
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setSelectedIds(selectedIds.length === tareasPendientes.length ? [] : tareasPendientes.map((t) => t.id));
  };

  const moveUp = (id: number) => {
    setSelectedIds((prev) => { const ids = [...prev]; const idx = ids.indexOf(id); if (idx > 0) [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]; return ids; });
  };

  const moveDown = (id: number) => {
    setSelectedIds((prev) => { const ids = [...prev]; const idx = ids.indexOf(id); if (idx < ids.length - 1) [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]]; return ids; });
  };

  // — External stop selection —
  const makeStopKey = (slug: string, routeId: number | string, stopId: number | string) =>
    `${slug}-${routeId}-${stopId}`;

  const buildPickupsSummary = (stop: ExternalStop): string => {
    if (!stop.pickups || stop.pickups.length === 0) return '';
    return stop.pickups.map(p => `${p.client_name} (${p.reference}${p.document_count ? `, ${p.document_count} docs` : ''})`).join('; ');
  };

  const toggleExtStop = (slug: string, integrationName: string, routeRef: string, routeId: number | string, stop: ExternalStop) => {
    const key = makeStopKey(slug, routeId, stop.id);
    setSelectedExtStops(prev => {
      const exists = prev.find(s => s.key === key);
      if (exists) return prev.filter(s => s.key !== key);
      return [...prev, {
        key,
        branch_name: stop.branch_name,
        address: stop.address,
        integration_name: integrationName,
        external_ref: routeRef,
        pickups_summary: buildPickupsSummary(stop),
      }];
    });
  };

  const isExtStopSelected = (slug: string, routeId: number | string, stopId: number | string) =>
    selectedExtStops.some(s => s.key === makeStopKey(slug, routeId, stopId));

  // — Flatten all external stops for display —
  const allExtStops = extResults.filter(r => r.success).flatMap(r =>
    r.routes.flatMap(route =>
      (route.stops || []).map(stop => ({
        integrationSlug: r.integration_slug,
        integrationName: r.integration_name,
        routeId: route.id,
        routeRef: route.reference || route.name,
        routeStatus: route.status,
        stop,
      }))
    )
  );

  const totalSelected = selectedIds.length + selectedExtStops.length;

  // — Generate —
  const handleGenerar = async () => {
    if (!mensajeroId) { toast({ title: 'Error', description: 'Selecciona un mensajero.', variant: 'destructive' }); return; }
    if (totalSelected === 0) { toast({ title: 'Error', description: 'Selecciona al menos una tarea o parada externa.', variant: 'destructive' }); return; }
    setGenerating(true);
    try {
      const payload: Record<string, unknown> = {
        fecha,
        mensajero_id: parseInt(mensajeroId),
      };
      if (selectedIds.length > 0) payload.tarea_ids = selectedIds;
      if (selectedExtStops.length > 0) {
        payload.external_stops = selectedExtStops.map(s => ({
          branch_name: s.branch_name,
          address: s.address || null,
          integration_name: s.integration_name,
          external_ref: s.external_ref,
          pickups_summary: s.pickups_summary || null,
        }));
      }
      await api.post('/api/rutas-diarias/generar', payload);
      const parts: string[] = [];
      if (selectedIds.length > 0) parts.push(`${selectedIds.length} PEP`);
      if (selectedExtStops.length > 0) parts.push(`${selectedExtStops.length} externas`);
      toast({ title: 'Ruta generada', description: `Ruta con ${parts.join(' + ')} tareas creada para ${fecha}.` });
      setSelectedIds([]);
      setSelectedExtStops([]);
      fetchPendientes();
      onGenerated();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al generar ruta.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const selectedTareas = selectedIds.map((id) => tareasPendientes.find((t) => t.id === id)).filter(Boolean) as TareaRuta[];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><PackageCheck className="h-5 w-5" />Tareas Disponibles</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fetchPendientes(true)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
          <CardDescription>Selecciona las tareas para incluir en la ruta. Orden FIFO por prioridad.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {/* PEP tasks */}
              {tareasPendientes.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Checkbox checked={selectedIds.length === tareasPendientes.length && tareasPendientes.length > 0} onCheckedChange={toggleAll} />
                    <span className="text-sm text-muted-foreground">Seleccionar todas ({tareasPendientes.length})</span>
                  </div>
                  {tareasPendientes.map((t) => (
                    <div
                      key={t.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${selectedIds.includes(t.id) ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800' : 'hover:bg-muted/50'}`}
                      onClick={() => toggleSelect(t.id)}
                    >
                      <Checkbox checked={selectedIds.includes(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {tipoIcons[t.tipo]}
                          <span className="font-medium text-sm truncate">{t.titulo}</span>
                          <Badge className={`${prioridadColors[t.prioridad]} text-xs`}>
                            {t.prioridad_override && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                            {prioridadLabels[t.prioridad]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {t.empresa_destino && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{t.empresa_destino}</span>}
                          {t.canton && <span>{t.canton}</span>}
                          {t.fecha_limite && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Límite: {new Date(t.fecha_limite).toLocaleDateString('es-CR')}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* External stops */}
              {allExtStops.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pt-3 pb-2 border-b mt-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Paradas Externas ({allExtStops.length})</span>
                  </div>
                  {allExtStops.map(({ integrationSlug, integrationName, routeId, routeRef, routeStatus, stop }) => {
                    const selected = isExtStopSelected(integrationSlug, routeId, stop.id);
                    return (
                      <div
                        key={`ext-${integrationSlug}-${routeId}-${stop.id}`}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${selected ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'hover:bg-muted/50'}`}
                        onClick={() => toggleExtStop(integrationSlug, integrationName, routeRef, routeId, stop)}
                      >
                        <Checkbox checked={selected} onCheckedChange={() => toggleExtStop(integrationSlug, integrationName, routeRef, routeId, stop)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-emerald-600" />
                            <span className="font-medium text-sm truncate">{stop.branch_name}</span>
                            <Badge variant="outline" className="text-xs shrink-0">{integrationName}</Badge>
                            <Badge className={`${extStatusColors[routeStatus] || 'bg-gray-100 text-gray-700'} text-xs`}>{routeStatus}</Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {stop.address && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{stop.address}</span>}
                            <span>Ref: {routeRef}</span>
                            {stop.pickups && stop.pickups.length > 0 && (
                              <span>{stop.pickups.length} recolección(es)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {tareasPendientes.length === 0 && allExtStops.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">No hay tareas pendientes ni paradas externas disponibles.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" />Configurar Ruta</CardTitle>
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

          {/* PEP tasks summary */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-2">Tareas PEP ({selectedIds.length})</h4>
            {selectedTareas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Selecciona tareas de la lista.</p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
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

          {/* External stops summary */}
          {selectedExtStops.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Globe className="h-4 w-4 text-emerald-600" />Paradas Externas ({selectedExtStops.length})
              </h4>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {selectedExtStops.map((s, i) => (
                  <div key={s.key} className="flex items-center gap-2 p-2 rounded border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 text-sm">
                    <span className="text-muted-foreground w-5">{selectedIds.length + i + 1}.</span>
                    <Globe className="h-3 w-3 text-emerald-600 shrink-0" />
                    <span className="flex-1 truncate">{s.branch_name}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{s.integration_name}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button className="w-full" onClick={handleGenerar} disabled={generating || totalSelected === 0}>
            {generating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Generar Ruta ({totalSelected} {totalSelected === 1 ? 'tarea' : 'tareas'})
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
