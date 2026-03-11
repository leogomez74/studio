'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PackageCheck, Truck, Loader2, AlertTriangle, Clock, Building2, ArrowUp, ArrowDown, GripVertical, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';
import type { TareaRuta, ExternalIntegrationResult, UserOption } from './types';
import { tipoIcons, prioridadColors, prioridadLabels, extStatusColors } from './utils';

interface Props {
  users: UserOption[];
  onGenerated: () => void;
}

export default function GenerarRutaTab({ users, onGenerated }: Props) {
  const { toast } = useToast();
  const [tareasPendientes, setTareasPendientes] = useState<TareaRuta[]>([]);
  const [extResults, setExtResults] = useState<ExternalIntegrationResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [mensajeroId, setMensajeroId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPendientes = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const [tareasRes, extRes] = await Promise.all([
        api.get('/api/tareas-ruta', { params: { status: 'pendiente' } }),
        api.get('/api/external-routes', { params: refresh ? { refresh: 1 } : {} }),
      ]);
      setTareasPendientes(tareasRes.data);
      setExtResults(Array.isArray(extRes.data) ? extRes.data : []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las tareas.', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { fetchPendientes(); }, [fetchPendientes]);

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

  const handleGenerar = async () => {
    if (!mensajeroId) { toast({ title: 'Error', description: 'Selecciona un mensajero.', variant: 'destructive' }); return; }
    if (selectedIds.length === 0) { toast({ title: 'Error', description: 'Selecciona al menos una tarea.', variant: 'destructive' }); return; }
    setGenerating(true);
    try {
      await api.post('/api/rutas-diarias/generar', { fecha, mensajero_id: parseInt(mensajeroId), tarea_ids: selectedIds });
      toast({ title: 'Ruta generada', description: `Ruta con ${selectedIds.length} tareas creada para ${fecha}.` });
      setSelectedIds([]);
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
          ) : tareasPendientes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No hay tareas pendientes para asignar.</div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
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

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-2">Tareas seleccionadas ({selectedIds.length})</h4>
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

          <Button className="w-full" onClick={handleGenerar} disabled={generating || selectedIds.length === 0}>
            {generating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Generar Ruta ({selectedIds.length} tareas)
          </Button>

          {extResults.some(r => r.success && r.count > 0) && (
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Truck className="h-4 w-4" />Rutas Externas del Día
              </h4>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {extResults.filter(r => r.success).flatMap(r =>
                  r.routes.map(route => (
                    <div key={`ext-${r.integration_slug}-${route.id}`} className="flex items-center gap-2 p-2 rounded border text-sm">
                      <Badge variant="outline" className="text-xs shrink-0">{r.integration_name}</Badge>
                      <span className="flex-1 truncate">{route.name}</span>
                      <Badge className={`${extStatusColors[route.status] || 'bg-gray-100 text-gray-700'} text-xs`}>{route.status}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
