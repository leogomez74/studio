'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  PackageCheck, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Play, Navigation, Phone, Building2, RefreshCw, Camera, Image, Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import api from '@/lib/axios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/auth-guard';
import type { TareaRuta, RutaDiaria, ExternalRoute, ExternalIntegrationResult, UserOption } from './types';
import { tipoIcons, tipoLabels, prioridadColors, prioridadLabels, rutaStatusColors, rutaStatusLabels, extStatusColors } from './utils';

interface MiRutaTabProps {
  users?: UserOption[];
}

export default function MiRutaTab({ users = [] }: MiRutaTabProps) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role?.full_access === true;

  const [ruta, setRuta] = useState<RutaDiaria | null>(null);
  const [extResults, setExtResults] = useState<ExternalIntegrationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [noHayRuta, setNoHayRuta] = useState(false);
  const [selectedMensajero, setSelectedMensajero] = useState<string>('');

  // Action states
  const [showCompletarDialog, setShowCompletarDialog] = useState(false);
  const [showFallarDialog, setShowFallarDialog] = useState(false);
  const [selectedTarea, setSelectedTarea] = useState<TareaRuta | null>(null);
  const [notasCompletado, setNotasCompletado] = useState('');
  const [motivoFallo, setMotivoFallo] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [evidenciaFiles, setEvidenciaFiles] = useState<File[]>([]);
  const [uploadingEvidencia, setUploadingEvidencia] = useState(false);

  // Admin debe seleccionar mensajero antes de ver algo
  const viewingOwnRoute = !isAdmin || !selectedMensajero;

  const fetchMiRuta = useCallback(async (refresh = false) => {
    // Admin sin mensajero seleccionado: no fetch, mostrar prompt
    if (isAdmin && !selectedMensajero) {
      setRuta(null);
      setNoHayRuta(true);
      setExtResults([]);
      setLoading(false);
      return;
    }

    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const rutaParams: Record<string, string | number> = {};
      if (isAdmin && selectedMensajero) rutaParams.mensajero_id = selectedMensajero;

      const requests: Promise<unknown>[] = [
        api.get('/api/rutas-diarias/mi-ruta', { params: rutaParams }),
      ];
      // Solo cargar rutas externas para la vista propia del mensajero (no cuando admin ve otro usuario)
      if (viewingOwnRoute) {
        requests.push(api.get('/api/external-routes', { params: refresh ? { refresh: 1 } : {} }));
      }

      const results = await Promise.all(requests);
      const rutaRes = results[0] as { data: RutaDiaria & { ruta?: null } };

      if (rutaRes.data.ruta === null) {
        setNoHayRuta(true);
        setRuta(null);
      } else {
        setRuta(rutaRes.data as RutaDiaria);
        setNoHayRuta(false);
      }

      if (viewingOwnRoute && results[1]) {
        const extRes = results[1] as { data: ExternalIntegrationResult[] };
        setExtResults(Array.isArray(extRes.data) ? extRes.data : []);
      } else {
        setExtResults([]);
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar la ruta.', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, isAdmin, selectedMensajero, viewingOwnRoute]);

  useEffect(() => { fetchMiRuta(); }, [fetchMiRuta]);

  const handleIniciar = async () => {
    if (!ruta) return;
    try {
      await api.patch(`/api/rutas-diarias/${ruta.id}/iniciar`);
      toast({ title: 'Ruta iniciada' });
      fetchMiRuta();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleCompletarTarea = async () => {
    if (!selectedTarea) return;
    setActionLoading(true);
    try {
      await api.patch(`/api/tareas-ruta/${selectedTarea.id}/completar`, { notas_completado: notasCompletado || null });

      // Subir evidencias si hay archivos seleccionados
      if (evidenciaFiles.length > 0) {
        setUploadingEvidencia(true);
        for (const file of evidenciaFiles) {
          const formData = new FormData();
          formData.append('file', file);
          await api.post(`/api/tareas-ruta/${selectedTarea.id}/evidencias`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }

      toast({ title: 'Tarea completada', description: evidenciaFiles.length > 0 ? `${evidenciaFiles.length} evidencia(s) subida(s)` : undefined });
      setShowCompletarDialog(false);
      setNotasCompletado('');
      setEvidenciaFiles([]);
      fetchMiRuta();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setActionLoading(false);
      setUploadingEvidencia(false);
    }
  };

  const handleFallarTarea = async () => {
    if (!selectedTarea || !motivoFallo.trim()) return;
    setActionLoading(true);
    try {
      await api.patch(`/api/tareas-ruta/${selectedTarea.id}/fallar`, { motivo_fallo: motivoFallo });
      toast({ title: 'Tarea reportada', description: 'Vuelve a pendientes.' });
      setShowFallarDialog(false);
      setMotivoFallo('');
      fetchMiRuta();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // Rutas externas confirmadas o en progreso
  const extRoutesActivas: { route: ExternalRoute; source: string }[] = [];
  extResults.forEach(r => {
    if (r.success) {
      r.routes
        .filter(route => route.status === 'Planificada' || route.status === 'En Progreso')
        .forEach(route => extRoutesActivas.push({ route, source: r.integration_name }));
    }
  });

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const hasExtRoutes = extRoutesActivas.length > 0;

  const noData = (noHayRuta || !ruta) && !hasExtRoutes;

  const tareas = ruta?.tareas || [];
  const completadas = tareas.filter((t) => t.status === 'completada').length;
  const total = tareas.length;
  const progreso = total > 0 ? Math.round((completadas / total) * 100) : 0;
  const todasResueltas = tareas.length > 0 && tareas.every((t) => t.status === 'completada' || t.status === 'fallida' || t.status === 'cancelada');

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Admin: selector de mensajero + refresh */}
      <div className="flex items-center justify-between gap-3">
        {isAdmin && users.length > 0 ? (
          <Select value={selectedMensajero} onValueChange={setSelectedMensajero}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Seleccionar mensajero..." />
            </SelectTrigger>
            <SelectContent>
              {users.map(u => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : <div />}
        <Button variant="outline" size="sm" onClick={() => fetchMiRuta(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Empty state */}
      {noData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Navigation className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">
              {isAdmin && selectedMensajero ? 'Sin rutas para este mensajero' : 'Sin rutas asignadas'}
            </h3>
            <p className="text-muted-foreground mt-1">
              {isAdmin && !selectedMensajero ? 'Selecciona un mensajero para ver su ruta.' : 'No hay rutas confirmadas pendientes.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Header card — ruta PEP */}
      {ruta && (() => {
        const rutaDate = new Date(String(ruta.fecha).split('T')[0] + 'T00:00:00');
        const today = new Date(); today.setHours(0,0,0,0);
        const isToday = rutaDate.getTime() === today.getTime();
        const fechaLabel = rutaDate.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' });
        const mensajeroName = isAdmin && selectedMensajero ? users.find(u => String(u.id) === selectedMensajero)?.name : null;
        const titulo = mensajeroName
          ? `Ruta de ${mensajeroName}`
          : isToday ? 'Mi Ruta de Hoy' : 'Mi Próxima Ruta';
        return (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold">{titulo}</h2>
                <p className="text-sm text-muted-foreground">
                  {!isToday && <span className="font-medium text-blue-600">Planificada: </span>}
                  {fechaLabel}
                </p>
              </div>
              <Badge className={`${rutaStatusColors[ruta.status]} text-sm px-3 py-1`}>
                {rutaStatusLabels[ruta.status]}
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
            {ruta.status === 'confirmada' && (
              <Button className="w-full mt-4" size="lg" onClick={handleIniciar}>
                <Play className="h-5 w-5 mr-2" />
                Iniciar Ruta
              </Button>
            )}

            {/* Route completed message */}
            {todasResueltas && ruta.status === 'en_progreso' && (
              <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-center dark:bg-green-950/20 dark:border-green-800">
                <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
                <p className="font-medium text-green-800 dark:text-green-400">Ruta completada</p>
                <p className="text-xs text-green-600 dark:text-green-500">Todas las tareas han sido resueltas.</p>
              </div>
            )}
          </CardContent>
        </Card>
        );
      })()}

      {/* Tareas PEP */}
      {tareas.length > 0 && (
        <div className="space-y-3">
          {tareas.map((t) => {
            const isActive = t.status === 'asignada' || t.status === 'en_transito';
            const isDone = t.status === 'completada';

            return (
              <Card key={t.id} className={isDone ? 'opacity-60' : ''}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-bold ${isDone ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {isDone ? <CheckCircle2 className="h-5 w-5" /> : t.posicion}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{t.titulo}</span>
                        <Badge className={`${prioridadColors[t.prioridad]} text-xs`}>
                          {t.prioridad_override && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                          {prioridadLabels[t.prioridad]}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {tipoIcons[t.tipo]}
                          <span className="ml-1">{tipoLabels[t.tipo]}</span>
                        </Badge>
                      </div>

                      {t.descripcion && (
                        <p className="text-sm text-muted-foreground mt-1">{t.descripcion}</p>
                      )}

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

                      {t.notas_completado && (
                        <div className="mt-2 p-2 rounded bg-green-50 text-xs text-green-700 dark:bg-green-950/20 dark:text-green-400">
                          {t.notas_completado}
                        </div>
                      )}
                      {(t.evidencias_count ?? 0) > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Camera className="h-3 w-3" />
                          {t.evidencias_count} evidencia{(t.evidencias_count ?? 0) !== 1 ? 's' : ''}
                        </div>
                      )}
                      {t.motivo_fallo && (
                        <div className="mt-2 p-2 rounded bg-red-50 text-xs text-red-700 dark:bg-red-950/20 dark:text-red-400">
                          Fallo: {t.motivo_fallo}
                        </div>
                      )}

                      {isActive && (
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={() => { setSelectedTarea(t); setNotasCompletado(''); setShowCompletarDialog(true); }}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Completar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1"
                            onClick={() => { setSelectedTarea(t); setMotivoFallo(''); setShowFallarDialog(true); }}
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
      )}

      {/* Rutas externas */}
      {extRoutesActivas.map(({ route, source }) => {
        const stopsCount = route.stops?.length || 0;
        const completedStops = route.stops?.filter(s => s.status === 'Completada').length || 0;
        const extProgreso = stopsCount > 0 ? Math.round((completedStops / stopsCount) * 100) : 0;

        return (
          <Card key={`ext-${source}-${route.id}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">{route.name}</h2>
                    <Badge variant="outline" className="text-xs">{source}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {route.courier?.name && <>{route.courier.name} — </>}
                    {route.scheduled_date && new Date(route.scheduled_date).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
                <Badge className={`${extStatusColors[route.status] || 'bg-gray-100 text-gray-700'} text-sm px-3 py-1`}>
                  {route.status}
                </Badge>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paradas</span>
                  <span className="font-medium">{completedStops}/{stopsCount} completadas ({extProgreso}%)</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${extProgreso}%` }}
                  />
                </div>
              </div>
            </CardContent>

            {/* Stops como task cards */}
            {route.stops && route.stops.length > 0 && (
              <CardContent className="pt-0 space-y-2">
                {route.stops.sort((a, b) => a.sequence - b.sequence).map((stop) => {
                  const isDone = stop.status === 'Completada';
                  return (
                    <div key={stop.id} className={`flex items-start gap-3 p-3 rounded-lg border ${isDone ? 'opacity-60' : ''}`}>
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-bold ${isDone ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {isDone ? <CheckCircle2 className="h-5 w-5" /> : stop.sequence}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{stop.branch_name}</span>
                          <Badge className={`${extStatusColors[stop.status] || 'bg-gray-100 text-gray-700'} text-xs`}>{stop.status}</Badge>
                        </div>
                        {stop.address && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5"
                          >
                            <Navigation className="h-3 w-3" />
                            {stop.address}
                          </a>
                        )}
                        {stop.pickups && stop.pickups.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {stop.pickups.map(p => (
                              <div key={p.id} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1">
                                <PackageCheck className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium">{p.reference}</span>
                                <span className="text-muted-foreground">—</span>
                                <span className="truncate">{p.client_name}</span>
                                {p.document_count && (
                                  <Badge variant="outline" className="text-xs ml-auto">{p.document_count} doc{p.document_count !== 1 ? 's' : ''}</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Completar dialog */}
      <AlertDialog open={showCompletarDialog} onOpenChange={setShowCompletarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Completar tarea</AlertDialogTitle>
            <AlertDialogDescription>
              Marca &quot;{selectedTarea?.titulo}&quot; como completada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea value={notasCompletado} onChange={(e) => setNotasCompletado(e.target.value)} placeholder="Ej: Entregado en recepción a Juan Pérez" rows={3} />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Camera className="h-4 w-4" />
                Evidencia fotográfica (opcional)
              </Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setEvidenciaFiles(prev => [...prev, ...files]);
                  e.target.value = '';
                }}
              />
              {evidenciaFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {evidenciaFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5">
                      <Image className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setEvidenciaFiles(prev => prev.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setEvidenciaFiles([]); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompletarTarea} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {uploadingEvidencia ? 'Subiendo...' : 'Completar'}
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
